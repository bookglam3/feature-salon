-- ═══════════════════════════════════════════════════════════════
-- TEST 1, but: (a) catches the exact failure with full MESSAGE/
-- DETAIL/HINT/SQLSTATE, and (b) evaluates ALL SIX with_check clauses
-- individually (not just 4 — clause 6, payment_method, is exactly
-- what the last two rounds missed). Everything lands in the Results
-- grid via a temp table, since RAISE NOTICE doesn't show in Supabase's
-- editor and a DO block can't return a result set directly.
-- ═══════════════════════════════════════════════════════════════
-- Nothing persists: CREATE TEMP TABLE is DDL, which is transactional
-- in Postgres — the whole BEGIN...ROLLBACK undoes it along with the
-- fake user/salon/service and the exception-catching insert attempt.

BEGIN;

CREATE TEMP TABLE diag_results (ord int, key text, value text);
-- anon needs explicit access to write into this — it's a fresh temp
-- table, not covered by whatever standing grants anon has on public
-- schema tables.
GRANT SELECT, INSERT ON diag_results TO anon;

DO $$
DECLARE
  owner_a  uuid := '99999999-9999-9999-9999-999999999999';
  salon_a  uuid := '11111111-1111-1111-1111-111111111111';
  svc_a    uuid := '22222222-2222-2222-2222-222222222222';
  err_message  text;
  err_detail   text;
  err_hint     text;
  err_sqlstate text;
  err_context  text;
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
    'test1diag-owner@example.invalid',
    crypt('throwaway-test1diag', gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(),
    '', '', '', ''
  );

  INSERT INTO salons (id, name, slug, owner_id, owner_email, plan)
    VALUES (salon_a, 'Test1Diag Salon', 'test1diag-salon', owner_a, 'test1diag-owner@example.invalid', 'starter');

  INSERT INTO services (id, salon_id, name, price, duration_minutes, price_type, is_online_bookable)
    VALUES (svc_a, salon_a, 'Test1Diag Service', 40, 45, 'fixed', true);

  -- ── Switch to anon ────────────────────────────────────────────────
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- ── Attempt the EXACT TEST 1 insert, catch everything ────────────
  BEGIN
    INSERT INTO appointments (id, salon_id, client_name, client_email, client_phone, service_id, staff_id, date_time, status, payment_status, notes)
      VALUES (gen_random_uuid(), salon_a, 'Diag Client', 'diag@example.invalid', '+447700900099', svc_a, NULL, now() + interval '1 day', 'confirmed', 'pay_at_salon', 'Please use the side entrance');
    INSERT INTO diag_results VALUES (0, 'insert_result', 'SUCCEEDED — no error at all');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      err_message  = MESSAGE_TEXT,
      err_detail   = PG_EXCEPTION_DETAIL,
      err_hint     = PG_EXCEPTION_HINT,
      err_sqlstate = RETURNED_SQLSTATE,
      err_context  = PG_EXCEPTION_CONTEXT;
    INSERT INTO diag_results VALUES (0, 'insert_result', 'FAILED');
    INSERT INTO diag_results VALUES (1, 'sqlstate', err_sqlstate);
    INSERT INTO diag_results VALUES (2, 'message',  err_message);
    INSERT INTO diag_results VALUES (3, 'detail',   COALESCE(err_detail, '(none)'));
    INSERT INTO diag_results VALUES (4, 'hint',     COALESCE(err_hint, '(none)'));
    INSERT INTO diag_results VALUES (5, 'context',  COALESCE(err_context, '(none)'));
  END;

  -- ── Every clause of the real with_check, evaluated individually ──
  -- (regardless of whether the insert above succeeded or failed)
  INSERT INTO diag_results VALUES (10, 'clause1_salon_exists',
    (EXISTS (SELECT 1 FROM salons WHERE id = salon_a))::text);

  INSERT INTO diag_results VALUES (11, 'clause2_service_exists',
    (EXISTS (SELECT 1 FROM services s WHERE s.id = svc_a AND s.salon_id = salon_a))::text);

  INSERT INTO diag_results VALUES (12, 'clause3_staff_null_or_belongs',
    (NULL::uuid IS NULL)::text);  -- TEST 1 sends staff_id=NULL, this branch is always true for it

  INSERT INTO diag_results VALUES (13, 'clause4_status_in_allowed',
    ('confirmed' IN ('pending','confirmed'))::text);

  INSERT INTO diag_results VALUES (14, 'clause5_payment_status_in_allowed',
    ('pay_at_salon' IN ('pending','pay_at_salon'))::text);

  -- clause 6 needs the REAL default, not an assumption — read it live
  INSERT INTO diag_results VALUES (15, 'clause6_payment_method_in_allowed',
    (
      SELECT (column_default IS NULL OR trim(both '''' from split_part(column_default, '::', 1)) IN ('full_online','deposit_online','custom_deposit','pay_at_salon','pending'))
      FROM information_schema.columns
      WHERE table_name = 'appointments' AND column_name = 'payment_method'
    )::text);

  INSERT INTO diag_results VALUES (16, 'live_payment_method_default',
    (SELECT column_default FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'payment_method'));

  RESET ROLE;
END $$;

SELECT key, value FROM diag_results ORDER BY ord;

ROLLBACK;
-- ^ Nothing persists — temp table, fake user/salon/service, and the
-- insert attempt (successful or not) all undo. The rows already
-- reached the Results grid before this ran.
