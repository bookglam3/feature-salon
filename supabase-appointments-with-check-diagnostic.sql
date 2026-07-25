-- ═══════════════════════════════════════════════════════════════
-- Diagnostic: isolate which with_check clause anon actually fails on
-- ═══════════════════════════════════════════════════════════════
-- Dry-run TEST 1 failed with 42501 (RLS violation) — NOT 42703
-- (undefined column). That error can only occur once every column
-- reference has already resolved successfully, so the columns in the
-- INSERT are not the problem (independently confirmed: live schema
-- via PostgREST introspection has client_name/client_email/
-- client_phone/service_id/staff_id/date_time exactly as used —
-- no customer_name/appointment_date/appointment_time/stylist_id
-- anywhere).
--
-- Leading hypothesis: the with_check's two EXISTS subqueries against
-- `salons` and `services` are themselves ordinary SELECTs, and are
-- therefore gated by THOSE tables' own RLS as seen by anon — not a
-- privileged lookup. If salons' anon-visible SELECT policy requires
-- something beyond bare row existence that this throwaway salon
-- doesn't have set, the EXISTS check comes back false even though the
-- salon is genuinely there. This script isolates exactly which of the
-- two EXISTS clauses (if either) is false under the anon role, using
-- the same throwaway salon/service setup as the dry-run — no
-- appointments INSERT attempted here, so nothing can violate RLS and
-- abort the transaction early; every check runs and reports.

BEGIN;

DO $$
DECLARE
  owner_a uuid := gen_random_uuid();
  salon_a uuid;
  svc_a   uuid;
  r RECORD;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', owner_a, 'authenticated', 'authenticated',
    'diag-owner-' || substr(owner_a::text,1,8) || '@example.invalid',
    crypt('throwaway-' || owner_a::text, gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(),
    '', '', '', ''
  );

  INSERT INTO salons (id, name, slug, owner_id, owner_email, plan)
    VALUES (gen_random_uuid(), 'Diag Salon', 'diag-salon-' || substr(owner_a::text,1,8), owner_a, 'diag-owner-' || substr(owner_a::text,1,8) || '@example.invalid', 'starter')
    RETURNING id INTO salon_a;

  INSERT INTO services (id, salon_id, name, price, duration_minutes, price_type)
    VALUES (gen_random_uuid(), salon_a, 'Diag Service', 40, 45, 'fixed')
    RETURNING id INTO svc_a;

  RAISE NOTICE '── salon_a=%, svc_a=% ──', salon_a, svc_a;

  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  FOR r IN
    SELECT
      EXISTS (SELECT 1 FROM salons WHERE id = salon_a)                              AS salon_exists_to_anon,
      EXISTS (SELECT 1 FROM services s WHERE s.id = svc_a AND s.salon_id = salon_a) AS service_exists_to_anon
  LOOP
    RAISE NOTICE 'salon_exists_to_anon = %   service_exists_to_anon = %', r.salon_exists_to_anon, r.service_exists_to_anon;
    IF NOT r.salon_exists_to_anon THEN
      RAISE NOTICE '→ salons'' anon SELECT policy is hiding this row from anon. That is the bug — the with_check''s EXISTS against salons needs a different approach (e.g. SECURITY DEFINER helper, or relax the salons anon SELECT policy) not a column rename.';
    END IF;
    IF NOT r.service_exists_to_anon THEN
      RAISE NOTICE '→ services'' anon SELECT policy (archived_at IS NULL AND is_online_bookable) is hiding this row from anon. Check whether the DRY-RUN service actually has is_online_bookable = true.';
    END IF;
  END LOOP;

  RESET ROLE;
END $$;

ROLLBACK;
-- ^ Nothing persists. Report back which of the two booleans came back
-- false (or both) — that tells us exactly which clause of
-- anon_insert_appointments' with_check to fix, and how.
