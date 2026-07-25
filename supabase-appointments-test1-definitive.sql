-- ═══════════════════════════════════════════════════════════════
-- Definitive TEST 1 diagnostic — survives the 42501 instead of being
-- destroyed by it.
-- ═══════════════════════════════════════════════════════════════
-- Root cause of why nothing has been visible: TEST 1's insert (unlike
-- TEST 3/4/5) was never wrapped in its own BEGIN/EXCEPTION — so its
-- 42501 propagated and aborted the WHOLE transaction, and Supabase's
-- SQL editor doesn't render earlier statements' results once a later
-- statement in the same submission errors (confirmed by you actually
-- hitting this). Fixed here two ways:
--   1. anon_insert_appointments' with_check is captured into a TEMP
--      TABLE row immediately after CREATE POLICY — a stored value,
--      not a separate top-level SELECT that a later abort can hide.
--   2. TEST 1's insert is now wrapped in its own local BEGIN/EXCEPTION
--      (same pattern TEST 3/4/5 already use), so a 42501 there is
--      caught and recorded, not propagated.
-- Everything — the with_check text, the insert outcome, full error
-- MESSAGE/DETAIL/HINT/SQLSTATE if it failed, and all six with_check
-- clauses evaluated individually — lands in one temp table, read out
-- by ONE final top-level SELECT that runs after every risky operation
-- is already safely contained. Nothing persists: BEGIN/ROLLBACK wraps
-- the whole thing, and CREATE TEMP TABLE is transactional DDL.

BEGIN;

CREATE TEMP TABLE diag_results (ord int, key text, value text);
GRANT SELECT, INSERT ON diag_results TO anon;

-- ── Apply migration (b) exactly ──────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access" ON appointments;
DROP POLICY IF EXISTS "Allow authenticated delete"       ON appointments;
DROP POLICY IF EXISTS "Allow authenticated select"       ON appointments;
DROP POLICY IF EXISTS "Allow authenticated update"       ON appointments;
DROP POLICY IF EXISTS "Allow anon select"                ON appointments;
DROP POLICY IF EXISTS "Allow public read appointments"   ON appointments;
DROP POLICY IF EXISTS "Allow anon insert"                ON appointments;
DROP POLICY IF EXISTS "Allow authenticated insert"       ON appointments;
DROP POLICY IF EXISTS "Public can insert appointments"   ON appointments;

DROP POLICY IF EXISTS "anon_insert_appointments" ON appointments;
CREATE POLICY "anon_insert_appointments" ON appointments
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM salons WHERE id = appointments.salon_id)
    AND EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = appointments.service_id AND s.salon_id = appointments.salon_id
    )
    AND (
      appointments.staff_id IS NULL
      OR EXISTS (
        SELECT 1 FROM staff st
        WHERE st.id = appointments.staff_id AND st.salon_id = appointments.salon_id
      )
    )
    AND appointments.status IN ('pending', 'confirmed')
    AND appointments.payment_status IN ('pending', 'pay_at_salon')
    AND (
      appointments.payment_method IS NULL
      OR appointments.payment_method IN ('full_online','deposit_online','custom_deposit','pay_at_salon','pending')
    )
  );

-- ── Capture the with_check as a STORED VALUE, right after CREATE,
-- immune to anything that fails later ────────────────────────────
INSERT INTO diag_results (ord, key, value)
SELECT 0, 'with_check_immediately_after_create', with_check
FROM pg_policies
WHERE tablename = 'appointments' AND policyname = 'anon_insert_appointments';

DO $$
DECLARE
  owner_a  uuid := '99999999-9999-9999-9999-999999999999';
  salon_a  uuid := '11111111-1111-1111-1111-111111111111';
  svc_a    uuid := '22222222-2222-2222-2222-222222222222';
  err_message  text;
  err_detail   text;
  err_hint     text;
  err_sqlstate text;
  pm_default   text;
BEGIN
  -- ── Setup as postgres/service role — bypasses RLS ───────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', owner_a, 'authenticated', 'authenticated',
    'test1final-owner@example.invalid',
    crypt('throwaway-test1final', gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(),
    '', '', '', ''
  );

  INSERT INTO salons (id, name, slug, owner_id, owner_email, plan)
    VALUES (salon_a, 'Test1Final Salon', 'test1final-salon', owner_a, 'test1final-owner@example.invalid', 'starter');

  INSERT INTO services (id, salon_id, name, price, duration_minutes, price_type, is_online_bookable)
    VALUES (svc_a, salon_a, 'Test1Final Service', 40, 45, 'fixed', true);

  -- ── Switch to anon ────────────────────────────────────────────────
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- ── TEST 1's EXACT insert — now exception-safe, same pattern as
  -- TEST 3/4/5 already use, so a 42501 here is caught, not propagated ──
  BEGIN
    INSERT INTO appointments (id, salon_id, client_name, client_email, client_phone, service_id, staff_id, date_time, status, payment_status, notes)
      VALUES (gen_random_uuid(), salon_a, 'Dry Run Client A', 'dryrun-a@example.invalid', '+447700900000', svc_a, NULL, now() + interval '1 day', 'confirmed', 'pay_at_salon', 'Please use the side entrance');
    INSERT INTO diag_results VALUES (1, 'test1_insert_result', 'SUCCEEDED');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      err_message  = MESSAGE_TEXT,
      err_detail   = PG_EXCEPTION_DETAIL,
      err_hint     = PG_EXCEPTION_HINT,
      err_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO diag_results VALUES (1, 'test1_insert_result', 'FAILED');
    INSERT INTO diag_results VALUES (2, 'test1_sqlstate', err_sqlstate);
    INSERT INTO diag_results VALUES (3, 'test1_message',  err_message);
    INSERT INTO diag_results VALUES (4, 'test1_detail',   COALESCE(err_detail, '(none)'));
    INSERT INTO diag_results VALUES (5, 'test1_hint',     COALESCE(err_hint, '(none)'));
  END;

  -- ── Every with_check clause, evaluated individually, regardless of
  -- TEST 1's outcome above ─────────────────────────────────────────
  INSERT INTO diag_results VALUES (10, 'clause1_salon_exists',
    (EXISTS (SELECT 1 FROM salons WHERE id = salon_a))::text);

  INSERT INTO diag_results VALUES (11, 'clause2_service_exists',
    (EXISTS (SELECT 1 FROM services s WHERE s.id = svc_a AND s.salon_id = salon_a))::text);

  INSERT INTO diag_results VALUES (12, 'clause3_staff_null_branch',
    (true)::text); -- staff_id is NULL in TEST 1's insert, this branch is always true for it

  INSERT INTO diag_results VALUES (13, 'clause4_status_ok',
    ('confirmed' IN ('pending','confirmed'))::text);

  INSERT INTO diag_results VALUES (14, 'clause5_payment_status_ok',
    ('pay_at_salon' IN ('pending','pay_at_salon'))::text);

  SELECT column_default INTO pm_default
    FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'payment_method';
  INSERT INTO diag_results VALUES (15, 'live_payment_method_default', COALESCE(pm_default, '(NULL)'));
  INSERT INTO diag_results VALUES (16, 'clause6_payment_method_ok',
    (
      pm_default IS NULL
      OR trim(both '''' from split_part(pm_default, '::', 1))
         IN ('full_online','deposit_online','custom_deposit','pay_at_salon','pending')
    )::text);

  RESET ROLE;
END $$;

-- ── Capture with_check AGAIN, after everything — confirms nothing
-- changed it mid-transaction ─────────────────────────────────────
INSERT INTO diag_results (ord, key, value)
SELECT 20, 'with_check_after_test', with_check
FROM pg_policies
WHERE tablename = 'appointments' AND policyname = 'anon_insert_appointments';

-- ── THE answer — every risky operation above is already safely
-- contained, so this WILL show in the Results grid ────────────────
SELECT ord, key, value FROM diag_results ORDER BY ord;

ROLLBACK;
-- ^ Nothing persists — temp table, fake user/salon/service, policy
-- changes, all undo. The row set above already reached the client.
