-- 2026-11-05 — Bookings: prices from the services table + close the public insert doors
--
-- Two holes, closed together in ONE transaction (all or nothing):
--
-- 1. create_booking_with_services stored whatever the booking page sent in
--    p_line_items. A crafted request could send a lower price (create-payment-
--    intent then charges it) or a shorter duration (the slot check then sees a
--    shorter booking, so the slot could be double booked). Now p_line_items is
--    used only for service_id and sort_order; name, price, duration_minutes and
--    price_is_from come from services. Only the two blocks marked
--    "CHANGED 2026-11-05" differ from the live version; every guard, the staff
--    locking, the slot check and the drift check are unchanged. Same signature,
--    so the booking page needs no change and permissions stay as they are.
--
-- 2. anon could skip the function altogether: insert an appointment directly
--    (no slot check) and then appointment_services rows with any price. The two
--    policies that allowed it are dropped. Nothing in the app inserts with the
--    public key any more — the booking page only calls the function (SECURITY
--    DEFINER, so it doesn't need these policies). Owner and admin policies stay.
--
-- Run by hand in the Supabase SQL editor, in this order:
--   1. pre-checks A–E below; send me the two lines from D (they complete the rollback);
--   2. this whole file — once;
--   3. after-checks 1–4 at the bottom; optionally the self-undoing test file.
-- Rollback: sql/2026-11-05-booking-prices-and-insert-lockdown-rollback.sql
--
-- ── Pre-checks (read-only — run each one first, nothing changes) ────────────
--
-- A. services columns. Expect duration_minutes, name, price, price_is_from, and
--    NO "duration" column. If "duration" is listed, stop and tell me.
--
-- select column_name, data_type, is_nullable from information_schema.columns
-- where table_schema = 'public' and table_name = 'services'
--   and column_name in ('name', 'price', 'duration_minutes', 'duration', 'price_is_from')
-- order by 1;
--
-- B. Services the server would treat differently from the page. Expect 0 rows,
--    or only test services (no duration → 30 minutes, same as the page today).
--
-- select id, salon_id, name, price, duration_minutes, price_is_from
-- from public.services
-- where name is null or price is null or duration_minutes is null;
--
-- C. Every policy on the two tables, in full (incl. "salon owner appointments only").
--    Its USING must require the salon's owner (auth.uid()) — otherwise anon could
--    still insert through it once the two policies below are dropped.
--
-- select tablename, policyname, permissive, cmd, roles, qual as using_expression, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename in ('appointments', 'appointment_services')
-- order by 1, 2;
--
-- D. The two policies this file drops, as ready-made CREATE POLICY lines. Send me
--    both lines: they go into the rollback file BEFORE this file is run.
--
-- select format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
--          policyname, schemaname, tablename, permissive, cmd,
--          (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
--             from unnest(roles::text[]) r),
--          case when qual is not null then ' USING (' || qual || ')' else '' end,
--          case when with_check is not null then ' WITH CHECK (' || with_check || ')' else '' end) as create_statement
-- from pg_policies
-- where schemaname = 'public'
--   and ((tablename = 'appointments' and policyname = 'anon_insert_appointments')
--     or (tablename = 'appointment_services' and policyname = 'appointment_services_anon_insert'));
--
-- E. The public booking page can still use the function after the drop. Expect
--    security_definer = true, anon_can_execute = true, the function owner = the
--    tables' owner, and rls_forced_on_owner = false for both tables.
--
-- select p.proname, pg_get_userbyid(p.proowner) as function_owner, r.rolbypassrls as owner_bypasses_rls,
--        p.prosecdef as security_definer, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
-- where n.nspname = 'public' and p.proname = 'create_booking_with_services';
--
-- select c.relname, pg_get_userbyid(c.relowner) as table_owner,
--        c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced_on_owner
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname in ('appointments', 'appointment_services');
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
BEGIN
  -- ── Guards 1-9: cheap, no locking needed — fail fast before ever
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

-- Plain DROP (no IF EXISTS): if either policy isn't there, the whole file stops
-- and nothing changes.
DROP POLICY anon_insert_appointments ON public.appointments;
DROP POLICY appointment_services_anon_insert ON public.appointment_services;

commit;

-- ── After running (read-only) ────────────────────────────────────────────────
-- 1. New function is live — expect updated = true:
--
-- select pg_get_functiondef(p.oid) like '%CHANGED 2026-11-05%' as updated
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'create_booking_with_services';
--
-- 2. The two public insert policies are gone. Expect only owner / admin ones:
--    owner_insert_appointments, "salon owner appointments only",
--    "super_admin full access on appointments", appointment_services_owner_all.
--
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename in ('appointments', 'appointment_services')
--   and cmd in ('INSERT', 'ALL')
-- order by 1, 2;
--
-- 3. The public can still book through the function — expect true:
--
-- select has_function_privilege('anon', 'public.create_booking_with_services(uuid, uuid, uuid, text, text, text, uuid, uuid, timestamptz, text, text, text, jsonb)', 'EXECUTE') as anon_can_execute;
--
-- 4. After a test booking — every row should show matches = true:
--
-- select a.created_at, a.id as appointment_id, x.name, x.price, s.price as service_price,
--        x.duration_minutes, coalesce(s.duration_minutes, 30) as service_minutes,
--        a.end_time - a.date_time as booked_length,
--        (x.name = s.name and x.price = s.price
--         and x.duration_minutes = coalesce(s.duration_minutes, 30)) as matches
-- from public.appointment_services x
-- join public.appointments a on a.id = x.appointment_id
-- join public.services s on s.id = x.service_id
-- where a.created_at > now() - interval '1 day'
-- order by a.created_at desc
-- limit 20;
