-- 2026-11-06 — ROLLBACK for sql/2026-11-06-booking-payment-guard.sql
--
-- Puts create_booking_with_services back exactly as it was after 2026-11-05
-- (the function text below is copied unchanged from
-- sql/2026-11-05-booking-prices-and-insert-lockdown.sql): guard 10 goes, prices
-- and durations still come from the services table, the public insert doors stay
-- closed. Same signature, so permissions and the booking page are untouched.
-- Run the whole file in the Supabase SQL editor.

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

commit;

-- After running — expect ONE row: is_2026_11_05_version = true.
--
-- select md5(p.prosrc) = '0e81f9fcd5fdbb0bffb9359ab61f6d99' as is_2026_11_05_version
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'create_booking_with_services';
