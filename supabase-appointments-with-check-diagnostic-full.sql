-- ═══════════════════════════════════════════════════════════════
-- Full clause-by-clause diagnostic — RESULTS-GRID VERSION
-- ═══════════════════════════════════════════════════════════════
-- RAISE NOTICE doesn't surface in Supabase's SQL editor UI (it shows
-- "Success, no rows returned" even when NOTICEs fired) — a DO block
-- has no way to return a visible result set at all, since PL/pgSQL
-- has no bare SELECT-without-INTO/RETURN QUERY inside a DO block.
-- Rewritten so the actual diagnostic values come from a genuine
-- top-level SELECT (outside any DO/plpgsql block), which DOES land in
-- the Results grid. A SELECT's results are returned to the client as
-- soon as it runs — the later ROLLBACK undoes the data changes (the
-- fake salon/service/user), not the already-returned query result.
--
-- Setup uses FIXED throwaway UUIDs (not gen_random_uuid()) specifically
-- so the id values can be hardcoded into the final SELECT after the
-- role switch — there is no way to carry a PL/pgSQL variable from
-- inside a DO block out to a separate top-level statement.

BEGIN;

-- ── Setup as postgres/service role — bypasses RLS. Side effects only,
-- no visible output from this block (that's fine, the real answer is
-- the SELECT below). ───────────────────────────────────────────────
DO $$
DECLARE
  owner_a uuid := '99999999-9999-9999-9999-999999999999';
  salon_a uuid := '11111111-1111-1111-1111-111111111111';
  svc_a   uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', owner_a, 'authenticated', 'authenticated',
    'diag3-owner@example.invalid',
    crypt('throwaway-diag3', gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(),
    '', '', '', ''
  );

  INSERT INTO salons (id, name, slug, owner_id, owner_email, plan)
    VALUES (salon_a, 'Diag3 Salon', 'diag3-salon', owner_a, 'diag3-owner@example.invalid', 'starter');

  INSERT INTO services (id, salon_id, name, price, duration_minutes, price_type, is_online_bookable)
    VALUES (svc_a, salon_a, 'Diag3 Service', 40, 45, 'fixed', true);
END $$;

-- ── Switch to anon — plain top-level SET, applies to every statement
-- after it for the rest of this transaction ──────────────────────────
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

-- ── THE diagnostic — one row, lands in the Results grid ──────────────
SELECT
  EXISTS (SELECT 1 FROM salons WHERE id = '11111111-1111-1111-1111-111111111111'::uuid) AS a_salon,
  EXISTS (
    SELECT 1 FROM services
    WHERE id = '22222222-2222-2222-2222-222222222222'::uuid
      AND salon_id = '11111111-1111-1111-1111-111111111111'::uuid
  ) AS b_svc,
  ('confirmed' IN ('pending','confirmed'))       AS c_status,
  ('pay_at_salon' IN ('pending','pay_at_salon')) AS d_pay,
  EXISTS (SELECT 1 FROM services WHERE id = '22222222-2222-2222-2222-222222222222'::uuid) AS svc_visible_to_anon,
  EXISTS (SELECT 1 FROM salons   WHERE id = '11111111-1111-1111-1111-111111111111'::uuid) AS salon_visible_to_anon,
  (
    SELECT column_default FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'payment_method'
  ) AS payment_method_default;

RESET ROLE;

ROLLBACK;
-- ^ Nothing persists — the fake user/salon/service and the role switch
-- all undo. The row from the SELECT above already reached the Results
-- grid before this ran. Whichever of a_salon/b_svc/c_status/d_pay is
-- false is the with_check clause causing TEST 1's 42501. If all four
-- are true, check svc_visible_to_anon/salon_visible_to_anon (should
-- both be true and match a_salon/b_svc — if not, something about the
-- fake row setup is off) and payment_method_default (must be NULL or
-- one of full_online/deposit_online/custom_deposit/pay_at_salon, or
-- TEST 1's omitted payment_method column is the real culprit).
