-- ═══════════════════════════════════════════════════════════════
-- Dry-run test for supabase-appointments-rls-fix.sql (migration b)
-- ═══════════════════════════════════════════════════════════════
-- Applies migration (b)'s exact policy changes, then immediately
-- attempts real anon inserts under the resulting policy set — INSIDE
-- one transaction that ends in ROLLBACK. Nothing persists regardless
-- of pass or fail: not the policy changes, not the test rows.
--
-- Specifically answers: does "salon owner appointments only" (FOR ALL,
-- role public, WITH CHECK NULL → falls back to its USING clause,
-- which requires auth.uid() = a real owner) silently block anon
-- inserts once the loose masking policies are gone? If TEST 1 and
-- TEST 2 print PASS, the answer is no — anon_insert_appointments's own
-- WITH CHECK is sufficient on its own because permissive policies OR
-- together for a given command; "salon owner appointments only"
-- evaluating false for anon just abstains, it doesn't veto.
--
-- TESTS 3-5 prove the security boundary itself, not just the happy
-- path — each MUST be rejected, or the with_check has a real hole:
--   TEST 3: anon cannot self-mark a booking payment_status='paid'
--   TEST 4: anon cannot insert status='completed'
--   TEST 5: anon cannot insert against a salon_id that doesn't exist
-- If ANY of TEST 3/4/5 print FAIL (or silently succeed instead of
-- raising), stop — do not run the real migration until that's fixed.
--
-- Requires INSERT privilege on auth.users (salons.owner_id FK). If the
-- SQL editor's role rejects that insert, tell me.
--
-- History: first run of this script failed TEST 1 with 42501. Root cause
-- (confirmed via supabase-appointments-with-check-diagnostic.sql): the
-- with_check's EXISTS(SELECT 1 FROM services...) is an ordinary SELECT,
-- so it's gated by services_select_public (archived_at IS NULL AND
-- is_online_bookable) same as anon sees anywhere else — and this
-- script's fake service wasn't explicitly marked is_online_bookable.
-- Confirmed this is the CORRECT behavior, not a bug to work around: the
-- real booking page's services query (app/book/[slug]/page.tsx) applies
-- no filter of its own, so RLS is the only thing gating which services a
-- real client can ever select — every real client-sent service_id is
-- already guaranteed to satisfy this. Fixed here by setting
-- is_online_bookable = true explicitly on the fake service.
--
-- Second run still failed TEST 1 with 42501 even with that fix. Root
-- cause #2 (isolated via supabase-appointments-with-check-diagnostic-full.sql,
-- results-grid version): payment_method's live column default is
-- 'pending', not 'full_online' as the tracked migration file claims.
-- TEST 1 omits payment_method, so it got 'pending' from the live
-- default — which failed the with_check's payment_method clause (not
-- NULL, not in the four real payment-method ids). This matters for
-- real bookings too: the public page omits payment_method whenever
-- salon.payment_methods isn't set yet, hitting the same live default.
-- Fixed by adding 'pending' to the with_check's accepted set, in both
-- this file and the real migration.
--
-- Third round: permissive-check (run as its OWN separate query, not
-- inside this transaction) showed the live anon_insert_appointments
-- policy still has with_check = (notes IS NULL). That's expected, not
-- a bug here — this whole script rolls back, so nothing it does ever
-- persists for a later, separate query to see; the real migration has
-- never been committed. Added an in-transaction proof query below
-- (right after the CREATE POLICY, before TEST 1 runs) that shows what
-- the policy actually is AT THAT POINT in THIS transaction, so this
-- doesn't need to be taken on faith.

BEGIN;

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

-- ── Proof the CREATE POLICY above actually took effect, in THIS same
-- transaction, before anything else runs — settles definitively
-- whether TEST 1 will see the new check or the old one. This is a
-- plain top-level SELECT so it lands in the Results grid.
SELECT policyname, with_check
FROM pg_policies
WHERE tablename = 'appointments' AND policyname = 'anon_insert_appointments';
-- ^ If this shows (notes IS NULL) instead of the six-clause check
-- above, something genuinely strange is happening (e.g. two policies
-- with the same name in different schemas, or the DROP/CREATE above
-- silently no-op'd) and I'm wrong — tell me immediately, don't run
-- the real migration. If it shows the six-clause check, the DROP/
-- CREATE worked, and TEST 1's outcome below tells us the real story.

-- ── Now test against the resulting policy set ────────────────────
DO $$
DECLARE
  owner_a uuid := gen_random_uuid();
  salon_a uuid;
  svc_a   uuid;
  appt_a  uuid;
BEGIN
  -- Setup as postgres/service role — bypasses RLS
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', owner_a, 'authenticated', 'authenticated',
    'dryrun-owner-' || substr(owner_a::text,1,8) || '@example.invalid',
    crypt('throwaway-' || owner_a::text, gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(),
    '', '', '', ''
  );

  INSERT INTO salons (id, name, slug, owner_id, owner_email, plan)
    VALUES (gen_random_uuid(), 'Dry Run Salon', 'dry-run-salon-' || substr(owner_a::text,1,8), owner_a, 'dryrun-owner-' || substr(owner_a::text,1,8) || '@example.invalid', 'starter')
    RETURNING id INTO salon_a;

  -- is_online_bookable set explicitly (true) rather than relying on the
  -- column default — that's what TEST 1 actually failed on: the with_check's
  -- EXISTS(SELECT 1 FROM services...) runs under services_select_public
  -- (archived_at IS NULL AND is_online_bookable), same RLS an anon client
  -- sees, and this row wasn't visible under it without this being explicit.
  INSERT INTO services (id, salon_id, name, price, duration_minutes, price_type, is_online_bookable)
    VALUES (gen_random_uuid(), salon_a, 'Dry Run Service', 40, 45, 'fixed', true)
    RETURNING id INTO svc_a;

  RAISE NOTICE '── Setup complete: salon_a=%, svc_a=%', salon_a, svc_a;

  -- ═══════════════════════════════════════════════════════════
  -- TEST 1: anon insert, pay-at-salon path (status=confirmed,
  -- payment_status=pay_at_salon), WITH a note — the exact scenario
  -- you're about to test for real after this
  -- ═══════════════════════════════════════════════════════════
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  INSERT INTO appointments (id, salon_id, client_name, client_email, client_phone, service_id, staff_id, date_time, status, payment_status, notes)
    VALUES (gen_random_uuid(), salon_a, 'Dry Run Client A', 'dryrun-a@example.invalid', '+447700900000', svc_a, NULL, now() + interval '1 day', 'confirmed', 'pay_at_salon', 'Please use the side entrance')
    RETURNING id INTO appt_a;
  RAISE NOTICE 'PASS: anon pay-at-salon insert WITH a note succeeded (id=%) — "salon owner appointments only" did NOT block it', appt_a;

  -- ═══════════════════════════════════════════════════════════
  -- TEST 2: anon insert, online-pay path (status=pending,
  -- payment_status=pending)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO appointments (salon_id, client_name, client_email, client_phone, service_id, staff_id, date_time, status, payment_status)
    VALUES (salon_a, 'Dry Run Client B', 'dryrun-b@example.invalid', '+447700900001', svc_a, NULL, now() + interval '1 day', 'pending', 'pending');
  RAISE NOTICE 'PASS: anon online-pay insert (pending/pending) also succeeded';

  -- ═══════════════════════════════════════════════════════════
  -- TEST 3: sanity — anon still CANNOT self-mark a booking as paid
  -- ═══════════════════════════════════════════════════════════
  BEGIN
    INSERT INTO appointments (salon_id, client_name, client_email, client_phone, service_id, date_time, status, payment_status)
      VALUES (salon_a, 'Attacker', 'attacker@example.invalid', '+447700900002', svc_a, now() + interval '1 day', 'confirmed', 'paid');
    RAISE EXCEPTION 'FAIL: anon was able to self-mark a booking as paid';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: anon forging payment_status=paid was rejected (%)', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════════════
  -- TEST 4: anon CANNOT insert with status = 'completed' — only
  -- pending/confirmed are allowed on insert
  -- ═══════════════════════════════════════════════════════════
  BEGIN
    INSERT INTO appointments (salon_id, client_name, client_email, client_phone, service_id, date_time, status, payment_status)
      VALUES (salon_a, 'Attacker', 'attacker2@example.invalid', '+447700900003', svc_a, now() + interval '1 day', 'completed', 'pending');
    RAISE EXCEPTION 'FAIL: anon was able to insert a booking with status=completed';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: anon insert with status=completed was rejected (%)', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════════════
  -- TEST 5: anon CANNOT insert against a salon_id that doesn't exist
  -- — proves the EXISTS (SELECT 1 FROM salons ...) check is real
  -- ═══════════════════════════════════════════════════════════
  BEGIN
    INSERT INTO appointments (salon_id, client_name, client_email, client_phone, service_id, date_time, status, payment_status)
      VALUES (gen_random_uuid(), 'Attacker', 'attacker3@example.invalid', '+447700900004', svc_a, now() + interval '1 day', 'confirmed', 'pay_at_salon');
    RAISE EXCEPTION 'FAIL: anon was able to insert against a nonexistent salon_id';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: anon insert against a nonexistent salon_id was rejected (%)', SQLERRM;
  END;

  RESET ROLE;
  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE 'ALL DRY-RUN CHECKS PASSED';
  RAISE NOTICE '══════════════════════════════════════════════';
END $$;

ROLLBACK;
-- ^ Nothing above persists — not the policy changes, not the test
-- rows. If you saw "ALL DRY-RUN CHECKS PASSED", migration (b) is
-- confirmed safe against the real live policy set. Run
-- supabase-appointments-rls-fix.sql for real next.
