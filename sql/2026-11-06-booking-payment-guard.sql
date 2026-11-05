-- 2026-11-06 — Bookings: the payment fields must be ones the booking page would send
--
-- create_booking_with_services stored whatever status / payment_status /
-- payment_method it was sent, as long as each was a known word. So anyone could
-- call it themselves and book a CONFIRMED "pay at salon" slot at a salon that
-- only takes online payment (no deposit, no card), or an online booking at a
-- salon that can't take online payments yet (a slot blocked by a booking that
-- can never be paid).
--
-- New guard 10 (marked "CHANGED 2026-11-06") only lets through exactly what the
-- booking page itself sends for one of the payment options it offers that salon:
--   • Pay at Salon — only if the salon switched it on, or the salon can't take
--     online payments yet (then the page offers only that);
--   • full payment / 50% deposit / the salon's own deposit % — as "pending"
--     (waiting for the card payment), and only if the salon's Stripe account
--     can take payments; a charge that rounds to 0p is confirmed, as on the page;
--   • payment_method = the option chosen (empty for salons that never saved
--     payment settings — as the page sends it).
-- The same rules are in app/lib/payments/bookingPayment.ts (the page and
-- create-payment-intent use them). Everything else in the function is unchanged:
-- same signature and permissions, so the booking page keeps working as it is.
--
-- Run by hand in the Supabase SQL editor, in this order:
--   1. pre-checks A–E below (read-only); tell me if any result is not as expected;
--   2. this whole file — once;
--   3. after-checks 1–3 at the bottom; then the self-undoing test file.
-- Rollback: sql/2026-11-06-booking-payment-guard-rollback.sql
--
-- ── Pre-checks (read-only — run each one first, nothing changes) ────────────
--
-- A. The live function is exactly the 2026-11-05 version (the rollback puts that
--    back). Expect ONE row: is_2026_11_05_version = true, already_changed = false.
--
-- select md5(p.prosrc) = '0e81f9fcd5fdbb0bffb9359ab61f6d99' as is_2026_11_05_version,
--        p.prosrc like '%CHANGED 2026-11-06%' as already_changed
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'create_booking_with_services';
--
-- B. The columns guard 10 reads. Expect 6 rows: payment_methods jsonb (or json) in
--    BOTH public_salons and salons, stripe_account_id text, charges_enabled
--    boolean, price numeric, price_is_from boolean.
--
-- select table_name, column_name, data_type from information_schema.columns
-- where table_schema = 'public'
--   and ((table_name in ('salons', 'public_salons') and column_name = 'payment_methods')
--     or (table_name = 'salons' and column_name in ('stripe_account_id', 'charges_enabled'))
--     or (table_name = 'services' and column_name in ('price', 'price_is_from')))
-- order by 1, 2;
--
-- C. The booking page reads the settings from public_salons; guard 10 reads them
--    from salons. They must be the same. Expect 0.
--
-- select count(*) as salons_that_differ
-- from public.salons s join public.public_salons v on v.id = s.id
-- where s.payment_methods::jsonb is distinct from v.payment_methods::jsonb;
--
-- D. Saved settings the dashboard couldn't have saved (a switch that isn't
--    true/false, or a deposit % that isn't a number 1–100). Expect 0 rows; if
--    there are any, send them to me before going on.
--
-- select s.slug, s.payment_methods
-- from public.salons s
-- where s.payment_methods is not null
--   and (jsonb_typeof(s.payment_methods::jsonb) <> 'object'
--        or exists (select 1 from jsonb_each(s.payment_methods::jsonb) e
--                   where (e.key in ('full_online', 'deposit_online', 'pay_at_salon', 'custom_deposit')
--                          and jsonb_typeof(e.value) <> 'boolean')
--                      or (e.key = 'deposit_percent'
--                          and not (jsonb_typeof(e.value) = 'number'
--                                   and (e.value #>> '{}')::numeric between 1 and 100))));
--
-- E. For information: "pay at salon" bookings from the last 30 days at salons
--    that DON'T offer Pay at Salon and CAN take online payments. Guard 10 refuses
--    bookings like these from now on. Bookings you made yourself in the
--    dashboard, and free services, can show here too — they are not affected.
--    Any others are the hole being closed. Send me the count.
--
-- select a.created_at, s.slug, a.status, a.payment_status, a.payment_method,
--        (select sum(x.price) from public.appointment_services x where x.appointment_id = a.id) as total
-- from public.appointments a join public.salons s on s.id = a.salon_id
-- where a.created_at > now() - interval '30 days'
--   and a.payment_status = 'pay_at_salon'
--   and coalesce(s.stripe_account_id, '') <> '' and s.charges_enabled is true
--   and coalesce(s.payment_methods::jsonb -> 'pay_at_salon', 'false'::jsonb) <> 'true'::jsonb
-- order by a.created_at desc
-- limit 50;
--
-- ── Change ───────────────────────────────────────────────────────────────────

begin;

CREATE OR REPLACE FUNCTION public.create_booking_with_services(p_id uuid, p_review_token uuid, p_salon_id uuid, p_client_name text, p_client_email text, p_client_phone text, p_service_id uuid, p_staff_id uuid, p_date_time timestamp with time zone, p_status text, p_payment_status text, p_payment_method text, p_line_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_duration     int;
  v_end_time           timestamptz;
  v_active_staff        int;
  v_inline_available    boolean;
  v_inline_total_busy   int;
  v_inline_busy_direct  int;
  v_inline_busy_other   int;
  v_inline_busy_null    int;
  v_oracle_available     boolean;
  -- CHANGED 2026-11-06: for guard 10
  v_pm                 jsonb;
  v_pm_obj             jsonb;
  v_has_saved          boolean;
  v_online_ready       boolean;
  v_full_on            boolean;
  v_deposit_on         boolean;
  v_at_salon_on        boolean;
  v_custom_on          boolean;
  v_custom_pct         numeric;
  v_total_price        numeric;
  v_any_from           boolean;
  v_option_ids         text[] := '{}';
  v_option_pcts        numeric[] := '{}';
  v_confirmed          boolean;
  v_payment_ok         boolean := false;
BEGIN
  -- ── Guards 1-10: cheap, no locking needed — fail fast before ever
  -- taking a lock or touching a row. ─────────────────────────────

  -- 1: salon exists
  IF NOT EXISTS (SELECT 1 FROM salons WHERE id = p_salon_id) THEN
    RAISE EXCEPTION 'INVALID_SALON';
  END IF;

  -- 2: primary service belongs to salon
  IF NOT EXISTS (SELECT 1 FROM services WHERE id = p_service_id AND salon_id = p_salon_id) THEN
    RAISE EXCEPTION 'INVALID_SERVICE';
  END IF;

  -- 3: staff, if given, belongs to salon
  IF p_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff WHERE id = p_staff_id AND salon_id = p_salon_id
  ) THEN
    RAISE EXCEPTION 'INVALID_STAFF';
  END IF;

  -- 4: status
  IF p_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  -- 5: payment_status
  IF p_payment_status NOT IN ('pending', 'pay_at_salon') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS';
  END IF;

  -- 6: payment_method
  IF p_payment_method IS NOT NULL
     AND p_payment_method NOT IN ('full_online', 'deposit_online', 'custom_deposit', 'pay_at_salon', 'pending') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;

  -- 7: line items non-empty ("always write line items" — this is the
  -- enforcement point, not just a client-side convention)
  IF p_line_items IS NULL OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_LINE_ITEMS';
  END IF;

  -- 8: every line item belongs to the same salon (inline equivalent of
  -- appointment_service_salon_match — see header note on why this
  -- isn't a direct reuse)
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_line_items)
      AS x(service_id uuid, name text, price numeric, duration_minutes int, price_is_from boolean, sort_order int)
    WHERE NOT EXISTS (SELECT 1 FROM services s WHERE s.id = x.service_id AND s.salon_id = p_salon_id)
  ) THEN
    RAISE EXCEPTION 'LINE_ITEM_SALON_MISMATCH';
  END IF;

  -- 9: primary service_id should be one of the line items — SOFT.
  -- Line items are the source of truth; a mismatched "primary" pointer
  -- is a data-quality issue worth a log entry, not grounds to reject an
  -- otherwise-valid booking.
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_line_items)
      AS x(service_id uuid, name text, price numeric, duration_minutes int, price_is_from boolean, sort_order int)
    WHERE x.service_id = p_service_id
  ) THEN
    RAISE WARNING 'PRIMARY_SERVICE_NOT_IN_LINE_ITEMS: appointment_id=%, p_service_id=%', p_id, p_service_id;
  END IF;

  -- CHANGED 2026-11-06 — 10: status, payment_status and payment_method must
  -- be exactly what the booking page sends for one of the payment options it
  -- offers this salon. Before this, anyone could book a confirmed "pay at
  -- salon" slot at a salon that only takes online payment, by sending those
  -- values themselves. Mirrors bookingPaymentAllowed() in
  -- app/lib/payments/bookingPayment.ts — keep the two the same
  -- (scripts/db-tests/booking-payment-db-test.mjs checks they agree).
  SELECT s.payment_methods::jsonb,
         COALESCE(s.stripe_account_id, '') <> '' AND s.charges_enabled IS TRUE
    INTO v_pm, v_online_ready
    FROM salons s WHERE s.id = p_salon_id;

  -- The salon's settings as the page reads them: the defaults, overridden by
  -- whatever was saved; each switch is on if JavaScript would treat it as true.
  v_has_saved := v_pm IS NOT NULL AND CASE jsonb_typeof(v_pm)
                   WHEN 'null' THEN false
                   WHEN 'boolean' THEN v_pm = 'true'::jsonb
                   WHEN 'number' THEN (v_pm #>> '{}')::numeric <> 0
                   WHEN 'string' THEN v_pm #>> '{}' <> ''
                   ELSE true END;
  v_pm_obj := CASE WHEN jsonb_typeof(v_pm) = 'object' THEN v_pm ELSE '{}'::jsonb END;
  SELECT COALESCE(bool_or(f.is_on) FILTER (WHERE f.k = 'full_online'), true),
         COALESCE(bool_or(f.is_on) FILTER (WHERE f.k = 'deposit_online'), true),
         COALESCE(bool_or(f.is_on) FILTER (WHERE f.k = 'pay_at_salon'), false),
         COALESCE(bool_or(f.is_on) FILTER (WHERE f.k = 'custom_deposit'), false)
    INTO v_full_on, v_deposit_on, v_at_salon_on, v_custom_on
    FROM (SELECT e.key AS k,
                 CASE jsonb_typeof(e.value)
                   WHEN 'null' THEN false
                   WHEN 'boolean' THEN e.value = 'true'::jsonb
                   WHEN 'number' THEN (e.value #>> '{}')::numeric <> 0
                   WHEN 'string' THEN e.value #>> '{}' <> ''
                   ELSE true END AS is_on
            FROM jsonb_each(v_pm_obj) e) f;
  v_custom_pct := CASE
                    WHEN NOT (v_pm_obj ? 'deposit_percent') THEN 50
                    WHEN jsonb_typeof(v_pm_obj -> 'deposit_percent') = 'number'
                         AND (v_pm_obj ->> 'deposit_percent')::numeric > 0
                         AND (v_pm_obj ->> 'deposit_percent')::numeric <= 100
                      THEN (v_pm_obj ->> 'deposit_percent')::numeric
                  END;

  -- Total price and "from £X" flag of the booked services, from the services table.
  SELECT COALESCE(SUM(COALESCE(s.price, 0)), 0), COALESCE(bool_or(COALESCE(s.price_is_from, false)), false)
    INTO v_total_price, v_any_from
    FROM jsonb_to_recordset(p_line_items) AS x(service_id uuid, sort_order int)
    JOIN services s ON s.id = x.service_id AND s.salon_id = p_salon_id;

  -- The options the page offers while it shows online payment (salon ready,
  -- or the page couldn't find out yet): no full payment for a "from" price;
  -- Pay at Salon if that leaves nothing.
  IF v_full_on AND NOT v_any_from THEN
    v_option_ids := v_option_ids || 'full_online'::text;     v_option_pcts := v_option_pcts || 100::numeric;
  END IF;
  IF v_deposit_on THEN
    v_option_ids := v_option_ids || 'deposit_online'::text;  v_option_pcts := v_option_pcts || 50::numeric;
  END IF;
  IF v_custom_on AND v_custom_pct IS NOT NULL THEN
    v_option_ids := v_option_ids || 'custom_deposit'::text;  v_option_pcts := v_option_pcts || v_custom_pct;
  END IF;
  IF v_at_salon_on THEN
    v_option_ids := v_option_ids || 'pay_at_salon'::text;    v_option_pcts := v_option_pcts || 0::numeric;
  END IF;
  IF v_any_from AND cardinality(v_option_ids) = 0 THEN
    v_option_ids := ARRAY['pay_at_salon']; v_option_pcts := ARRAY[0::numeric];
  END IF;

  -- What the page sends for each: Pay at Salon, or a charge that rounds to
  -- 0p, is confirmed straight away; anything else waits for the online
  -- payment, which only a salon that can take online payments may get.
  -- (floor(x + 0.5) rounds exactly like JavaScript's Math.round.)
  FOR i IN 1 .. cardinality(v_option_ids) LOOP
    v_confirmed := v_option_ids[i] = 'pay_at_salon'
                   OR floor(floor(v_total_price * 100 + 0.5) * v_option_pcts[i] / 100 + 0.5) = 0;
    IF p_status = (CASE WHEN v_confirmed THEN 'confirmed' ELSE 'pending' END)
       AND p_payment_status = (CASE WHEN v_confirmed THEN 'pay_at_salon' ELSE 'pending' END)
       AND p_payment_method IS NOT DISTINCT FROM (CASE WHEN v_has_saved THEN v_option_ids[i] END)
       AND (v_confirmed OR v_online_ready) THEN
      v_payment_ok := true;
    END IF;
  END LOOP;
  -- Every option switched off: the page books it as confirmed, nothing to pay.
  IF cardinality(v_option_ids) = 0
     AND p_status = 'confirmed' AND p_payment_status = 'pay_at_salon'
     AND p_payment_method IS NOT DISTINCT FROM (CASE WHEN v_has_saved THEN 'full_online' END) THEN
    v_payment_ok := true;
  END IF;
  -- Salon can't take online payments: the page offers only Pay at Salon.
  IF NOT v_online_ready
     AND p_status = 'confirmed' AND p_payment_status = 'pay_at_salon'
     AND p_payment_method IS NOT DISTINCT FROM (CASE WHEN v_has_saved THEN 'pay_at_salon' END) THEN
    v_payment_ok := true;
  END IF;

  IF NOT v_payment_ok THEN
    IF p_payment_status = 'pending' AND NOT v_online_ready THEN
      RAISE EXCEPTION 'ONLINE_PAYMENTS_UNAVAILABLE';
    END IF;
    RAISE EXCEPTION 'PAYMENT_OPTION_NOT_ALLOWED';
  END IF;

  -- ── Lock the relevant staff row(s) BEFORE deciding availability —
  -- that's what makes a second concurrent caller wait rather than race.
  IF p_staff_id IS NOT NULL THEN
    PERFORM 1 FROM staff WHERE id = p_staff_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM staff WHERE salon_id = p_salon_id AND active = true FOR UPDATE;
  END IF;

  -- CHANGED 2026-11-05: total duration comes from the services table, not
  -- from the client. Same 30-minute fallback the booking page uses for a
  -- service with no duration. One row per line item, so a service added
  -- twice counts twice (as before).
  SELECT COALESCE(SUM(COALESCE(s.duration_minutes, 30)), 0)
    INTO v_total_duration
    FROM jsonb_to_recordset(p_line_items) AS x(service_id uuid, sort_order int)
    JOIN services s ON s.id = x.service_id AND s.salon_id = p_salon_id;

  v_end_time := p_date_time + (v_total_duration || ' minutes')::interval;

  -- ── INLINE decision (authoritative — runs under the lock above).
  -- Deliberate, faithful duplicate of check_slot_available's capacity-
  -- pool logic. Keep any future change to that function's formula
  -- mirrored here, or the drift check below will start firing on every
  -- booking. ──────────────────────────────────────────────────────
  v_active_staff := (SELECT COUNT(*) FROM staff WHERE salon_id = p_salon_id AND active = true);

  IF p_staff_id IS NULL THEN
    SELECT COUNT(*) INTO v_inline_total_busy
    FROM appointments
    WHERE salon_id = p_salon_id
      AND date_time < v_end_time
      AND COALESCE(end_time, date_time + interval '30 minutes') > p_date_time
      AND status != 'cancelled';

    v_inline_available := v_inline_total_busy < v_active_staff;
  ELSE
    SELECT COUNT(*) INTO v_inline_busy_direct
    FROM appointments
    WHERE salon_id = p_salon_id AND staff_id = p_staff_id
      AND date_time < v_end_time
      AND COALESCE(end_time, date_time + interval '30 minutes') > p_date_time
      AND status != 'cancelled';

    IF v_inline_busy_direct > 0 THEN
      v_inline_available := false;
    ELSE
      SELECT COUNT(*) INTO v_inline_busy_other
      FROM appointments
      WHERE salon_id = p_salon_id AND staff_id IS NOT NULL AND staff_id != p_staff_id
        AND date_time < v_end_time
        AND COALESCE(end_time, date_time + interval '30 minutes') > p_date_time
        AND status != 'cancelled';

      SELECT COUNT(*) INTO v_inline_busy_null
      FROM appointments
      WHERE salon_id = p_salon_id AND staff_id IS NULL
        AND date_time < v_end_time
        AND COALESCE(end_time, date_time + interval '30 minutes') > p_date_time
        AND status != 'cancelled';

      v_inline_available := (v_active_staff - v_inline_busy_other) > v_inline_busy_null;
    END IF;
  END IF;

  -- ── ORACLE cross-check (independent — the existing, already-tested
  -- function, unmodified). Both must agree. ──────────────────────────
  SELECT check_slot_available(
    p_salon_id         => p_salon_id,
    p_date_time        => p_date_time,
    p_staff_id         => p_staff_id,
    p_duration_minutes => v_total_duration
  ) INTO v_oracle_available;

  IF v_inline_available IS DISTINCT FROM v_oracle_available THEN
    RAISE EXCEPTION 'SLOT_CHECK_DRIFT_DETECTED: inline=% oracle=% (appointment_id=%)', v_inline_available, v_oracle_available, p_id;
  END IF;

  IF NOT v_inline_available THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
  END IF;

  -- ── Write. Both inserts succeed together or neither does — no
  -- separate COMMIT between them, this is still one function call. ──
  INSERT INTO appointments (
    id, review_token, salon_id, client_name, client_email, client_phone,
    service_id, staff_id, date_time, end_time, status, payment_status, payment_method
  ) VALUES (
    p_id, p_review_token, p_salon_id, p_client_name, p_client_email, p_client_phone,
    p_service_id, p_staff_id, p_date_time, v_end_time, p_status, p_payment_status, p_payment_method
  );

  -- CHANGED 2026-11-05: name, price, duration and the "from" flag come from
  -- the services table; only service_id and sort_order come from the client.
  INSERT INTO appointment_services (id, appointment_id, service_id, name, price, duration_minutes, price_is_from, sort_order)
  SELECT gen_random_uuid(), p_id, x.service_id, s.name, s.price, COALESCE(s.duration_minutes, 30), COALESCE(s.price_is_from, false), x.sort_order
  FROM jsonb_to_recordset(p_line_items)
    AS x(service_id uuid, sort_order int)
  JOIN services s ON s.id = x.service_id AND s.salon_id = p_salon_id;

  RETURN p_id;
END;
$function$;

commit;

-- ── After running (read-only) ────────────────────────────────────────────────
-- 1. The new function is live — expect ONE row: is_2026_11_06_version = true.
--
-- select md5(p.prosrc) = '7ae5a64ab28f77730691089060bb9909' as is_2026_11_06_version
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'create_booking_with_services';
--
-- 2. The public can still book through it, with the same rights as before —
--    expect security_definer = true, anon_can_execute = true,
--    settings = {search_path=public}.
--
-- select p.prosecdef as security_definer, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
--        p.proconfig as settings
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'create_booking_with_services';
--
-- 3. Run sql/2026-11-06-booking-payment-guard-test.sql (self-undoing, saves
--    nothing). Expect: PAYMENT GUARD TESTS: 14 passed, 0 failed. Nothing was saved.
