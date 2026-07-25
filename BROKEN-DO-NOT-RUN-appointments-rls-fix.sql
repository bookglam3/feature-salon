-- DO NOT RUN — this policy rejects real bookings, root cause unresolved as of
-- 2026-07-25. See booking diagnostic (app/book/[slug]/page.tsx console.log
-- BOOKING PAYLOAD / error message/code/details/hint). RLS on appointments is
-- currently DISABLED as the live stopgap — do not re-enable it with this
-- policy in place.

-- ═══════════════════════════════════════════════════════════════
-- Fix appointments RLS — drop every loose/duplicate policy, keep the
-- 5 already-correct owner_* policies and the 3 function-gated RBAC
-- policies untouched, replace the existing anon insert policy's weak
-- with_check with one that actually enforces tenant/business-logic
-- consistency.
-- ═══════════════════════════════════════════════════════════════
-- Full live policy map confirmed via:
--   SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
--   WHERE tablename = 'appointments' ORDER BY cmd, policyname;
--
-- DROP (9) — loose (qual/with_check = true) or exact duplicates of
-- another loose policy. None of these have a role/subquery/function
-- condition that can ever evaluate false for a real request:
--   Allow authenticated full access   (ALL,    authenticated, true)
--   Allow authenticated delete        (DELETE, authenticated, true)
--   Allow authenticated select        (SELECT, authenticated, true)
--   Allow authenticated update        (UPDATE, authenticated, true)
--   Allow anon select                 (SELECT, anon,          true)
--   Allow public read appointments    (SELECT, anon,          true)  -- dup of the above
--   Allow anon insert                 (INSERT, anon,          true)
--   Allow authenticated insert        (INSERT, authenticated, true)  -- dup, owner_insert_appointments already covers this correctly
--   Public can insert appointments    (INSERT, public,        true)  -- dup
--
-- KEEP, untouched (5) — already salon→owner scoped, confirmed correct:
--   salon owner appointments only, owner_select_appointments,
--   owner_update_appointments, owner_delete_appointments,
--   owner_insert_appointments
--
-- KEEP, untouched (3) — function-gated (is_super_admin() / is_admin_role()),
-- confirmed real: is_admin_role checks admin_users.is_active, both are
-- SECURITY DEFINER, only active admins ever match:
--   super_admin full access on appointments, ops_manager read appointments,
--   developer read staging appointments
--
-- REPLACE (1) — anon_insert_appointments already exists and is the real
-- anon insert path (not a new policy). Its current with_check is just
-- (notes IS NULL) — the public booking page never sends `notes` (zero
-- references in app/book/[slug]/page.tsx; appointments.notes has no
-- column DEFAULT, so an omitted column inserts NULL), so this has never
-- actually blocked a real booking. But it does nothing else: as written
-- it permits service_id/staff_id from a different salon than salon_id,
-- and arbitrary status/payment_status values. Replaced below with a
-- check built from exactly what the public booking page's insert sends
-- (app/book/[slug]/page.tsx handleProceedToPayment) — salon/service/
-- staff tenant consistency + status/payment_status/payment_method enums
-- — with no constraint on notes at all (any value passes, including a
-- future non-null one).
--
-- CORRECTION (post dry-run): payment_method's live column default is
-- 'pending', not 'full_online' as the tracked supabase-MASTER-migration.sql
-- claims (live-vs-tracked-file drift, confirmed via information_schema.
-- columns). The real public booking page omits payment_method entirely
-- when salon.payment_methods isn't set yet (hasMigration false) — that
-- row then gets payment_method='pending' from the live default, same as
-- every payment_method-omitted insert. The allowed set below now
-- includes 'pending' alongside the four real payment method ids so this
-- case is accepted, not silently rejected.
--
-- Verified separately: Stripe webhook (app/api/stripe-webhook/route.ts)
-- reads/writes `appointments` exclusively via SUPABASE_SERVICE_ROLE_KEY,
-- one client for the whole file — RLS never applies to it, unaffected
-- by anything here. check_slot_available is SECURITY DEFINER, so
-- dropping the loose anon-select policies does not weaken the double-
-- booking guard at submit time — it only removes the two direct anon
-- SELECTs used purely to grey out already-taken times in the UI before
-- submit (loadBookedSlots in the booking page, loadAvailability in the
-- reschedule page). Client reschedule/cancel goes through a token-
-- validated server route, not a direct client update — no anon UPDATE/
-- DELETE policy exists today and none is added here.
--
-- STATUS AS OF 2026-07-25: applying this policy (via this file or via
-- BROKEN-DO-NOT-RUN-appointments-EMERGENCY-fix.sql) took production
-- down — real bookings were rejected with 42501 even though the dry-run
-- and a definitive isolated test both showed every with_check clause
-- evaluating true. Root cause not yet found; the real booking payload
-- and the real Postgres error (message/code/details/hint) were never
-- actually captured because the app was swallowing them — a diagnostic
-- build (console.log BOOKING PAYLOAD + full error logging, in
-- app/book/[slug]/page.tsx) was shipped to capture both on the next
-- controlled test. RLS on appointments is disabled in production right
-- now as the stopgap. Do not run this file until the real payload/error
-- has been captured and the actual failing clause identified.

BEGIN;

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

COMMIT;
