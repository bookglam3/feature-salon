-- DO NOT RUN — this policy rejects real bookings, root cause unresolved as of
-- 2026-07-25. See booking diagnostic (app/book/[slug]/page.tsx console.log
-- BOOKING PAYLOAD / error message/code/details/hint). RLS on appointments is
-- currently DISABLED as the live stopgap — do not re-enable it with this
-- policy in place.

-- ═══════════════════════════════════════════════════════════════
-- EMERGENCY FIX — appointments RLS blocking all bookings
-- ═══════════════════════════════════════════════════════════════
-- Drops EVERY policy on appointments except the 8 already confirmed
-- correct this session (5 owner_*, 3 RBAC) — regardless of what
-- emergency policies were added under unknown names, and regardless
-- of whether any of them are RESTRICTIVE (a permissive WITH CHECK
-- (true) cannot override a RESTRICTIVE policy — that's the most
-- likely reason the emergency policy didn't fix it). Then creates ONE
-- correct, properly-scoped anon insert policy. This COMMITS for real.
--
-- Run this exact file in the Supabase SQL editor now.

BEGIN;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'appointments'
      AND policyname NOT IN (
        'salon owner appointments only',
        'owner_select_appointments',
        'owner_update_appointments',
        'owner_delete_appointments',
        'owner_insert_appointments',
        'super_admin full access on appointments',
        'ops_manager read appointments',
        'developer read staging appointments'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON appointments', pol.policyname);
  END LOOP;
END $$;

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

SELECT policyname, cmd, permissive, roles, with_check
FROM pg_policies WHERE tablename = 'appointments' ORDER BY cmd, policyname;

COMMIT;
