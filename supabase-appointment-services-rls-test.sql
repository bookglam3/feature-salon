-- ═══════════════════════════════════════════════════════════════
-- Cross-salon RLS isolation test — appointment_services
-- ═══════════════════════════════════════════════════════════════
-- SAFE TO RUN AGAINST PRODUCTION: wrapped in BEGIN...ROLLBACK, nothing
-- persists regardless of pass or fail. Same method as
-- supabase-service-menu-rls-test.sql: SET LOCAL ROLE + request.jwt.claims
-- simulates a real PostgREST-authenticated (or anon) request.
--
-- Requires INSERT privilege on auth.users (salons.owner_id has a FK
-- there). If the SQL editor's role rejects that insert, tell me.

BEGIN;

DO $$
DECLARE
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  salon_a uuid;
  salon_b uuid;
  svc_a   uuid;
  svc_b   uuid;
  appt_a  uuid;
  line_a  uuid;
  n       int;
BEGIN
  -- ── Setup (as service-role / postgres — bypasses RLS) ──────────
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES
  (
    '00000000-0000-0000-0000-000000000000', owner_a, 'authenticated', 'authenticated',
    'rls-test-a-' || substr(owner_a::text,1,8) || '@example.invalid',
    crypt('throwaway-' || owner_a::text, gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', owner_b, 'authenticated', 'authenticated',
    'rls-test-b-' || substr(owner_b::text,1,8) || '@example.invalid',
    crypt('throwaway-' || owner_b::text, gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(),
    '', '', '', ''
  );

  INSERT INTO salons (id, name, slug, owner_id, owner_email, plan)
    VALUES (gen_random_uuid(), 'RLS Test Salon A', 'rls-test-salon-a-' || substr(owner_a::text,1,8), owner_a, 'rls-test-a-' || substr(owner_a::text,1,8) || '@example.invalid', 'starter')
    RETURNING id INTO salon_a;
  INSERT INTO salons (id, name, slug, owner_id, owner_email, plan)
    VALUES (gen_random_uuid(), 'RLS Test Salon B', 'rls-test-salon-b-' || substr(owner_b::text,1,8), owner_b, 'rls-test-b-' || substr(owner_b::text,1,8) || '@example.invalid', 'starter')
    RETURNING id INTO salon_b;

  INSERT INTO services (id, salon_id, name, price, duration_minutes, price_type)
    VALUES (gen_random_uuid(), salon_a, 'RLS Test Service A', 40, 45, 'fixed')
    RETURNING id INTO svc_a;
  INSERT INTO services (id, salon_id, name, price, duration_minutes, price_type)
    VALUES (gen_random_uuid(), salon_b, 'RLS Test Service B', 40, 45, 'fixed')
    RETURNING id INTO svc_b;

  INSERT INTO appointments (id, salon_id, client_name, client_email, client_phone, service_id, date_time, status, payment_status)
    VALUES (gen_random_uuid(), salon_a, 'Test Client', 'client@example.invalid', '+447700900000', svc_a, now() + interval '1 day', 'pending', 'pending')
    RETURNING id INTO appt_a;

  RAISE NOTICE '── Setup complete: salon_a=%, salon_b=%, appt_a=%', salon_a, salon_b, appt_a;

  -- ═══════════════════════════════════════════════════════════
  -- TEST 1: anon can insert a line item when appointment + service
  -- belong to the SAME salon — the real public-booking-page path
  -- ═══════════════════════════════════════════════════════════
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  INSERT INTO appointment_services (id, appointment_id, service_id, name, price, duration_minutes)
    VALUES (gen_random_uuid(), appt_a, svc_a, 'RLS Test Service A', 40, 45)
    RETURNING id INTO line_a;
  RAISE NOTICE 'PASS: anon inserted a same-salon line item (id=%)', line_a;

  -- ═══════════════════════════════════════════════════════════
  -- TEST 2: anon CANNOT insert a line item pairing Salon A's
  -- appointment with Salon B's service — the tenant-consistency
  -- check that appointments' own anon-insert policy (WITH CHECK
  -- (true)) does not enforce
  -- ═══════════════════════════════════════════════════════════
  BEGIN
    INSERT INTO appointment_services (id, appointment_id, service_id, name, price, duration_minutes)
      VALUES (gen_random_uuid(), appt_a, svc_b, 'Cross-salon injection', 40, 45);
    RAISE EXCEPTION 'FAIL: anon inserted a line item mixing Salon A''s appointment with Salon B''s service';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: cross-salon line item insert rejected (%)', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════════════
  -- TEST 3: anon cannot SELECT line items at all — no public read
  -- policy exists on this table (unlike services/categories)
  -- ═══════════════════════════════════════════════════════════
  SELECT count(*) INTO n FROM appointment_services WHERE id = line_a;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: anon could SELECT a booking line item (got % rows)', n; END IF;
  RAISE NOTICE 'PASS: anon cannot SELECT any appointment_services rows';

  -- ═══════════════════════════════════════════════════════════
  -- TEST 4: Salon B's owner cannot see or touch Salon A's line item
  -- ═══════════════════════════════════════════════════════════
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM appointment_services WHERE id = line_a;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: Salon B owner could SELECT Salon A''s line item (got % rows)', n; END IF;
  RAISE NOTICE 'PASS: Salon B owner cannot SELECT Salon A''s line item';

  UPDATE appointment_services SET price = 999999 WHERE id = line_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: Salon B owner UPDATEd Salon A''s line item (% rows affected)', n; END IF;
  RAISE NOTICE 'PASS: Salon B owner''s UPDATE on Salon A''s line item affected 0 rows';

  DELETE FROM appointment_services WHERE id = line_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: Salon B owner DELETEd Salon A''s line item (% rows affected)', n; END IF;
  RAISE NOTICE 'PASS: Salon B owner''s DELETE on Salon A''s line item affected 0 rows';

  -- ═══════════════════════════════════════════════════════════
  -- TEST 5: Salon A's owner CAN see and manage their own line item
  -- (sanity — proves the policy isn't just blocking everyone)
  -- ═══════════════════════════════════════════════════════════
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM appointment_services WHERE id = line_a;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Salon A owner could not SELECT their own line item (got % rows)', n; END IF;
  RAISE NOTICE 'PASS: Salon A owner can SELECT their own line item';

  UPDATE appointment_services SET sort_order = 1 WHERE id = line_a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Salon A owner could not UPDATE their own line item (% rows affected)', n; END IF;
  RAISE NOTICE 'PASS: Salon A owner can UPDATE their own line item';

  RESET ROLE;
  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE 'ALL TESTS PASSED';
  RAISE NOTICE '══════════════════════════════════════════════';
END $$;

ROLLBACK;
-- ^ Nothing above persists. "ALL TESTS PASSED" with no exceptions means
-- tenant isolation and the anon-insert consistency check both hold. Any
-- RAISE EXCEPTION output is a real, specific failure — copy it back to me.
