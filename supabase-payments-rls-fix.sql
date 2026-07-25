-- ═══════════════════════════════════════════════════════════════
-- Fix payments RLS — replace the wide-open policy (no TO clause,
-- defaults to PUBLIC = anon AND authenticated) with owner-read-only;
-- writes stay service-role-only, unaffected by RLS either way.
-- ═══════════════════════════════════════════════════════════════
-- Verified before writing this:
--   - The only writer of `payments` is app/api/stripe-webhook/route.ts,
--     exclusively via SUPABASE_SERVICE_ROLE_KEY (one client for the
--     whole file, lines 67-70) — service role bypasses RLS entirely,
--     unaffected by anything below.
--   - Grepped the entire app/ tree: nothing client-side reads or
--     writes `payments` directly. app/dashboard/payments/page.tsx does
--     not query this table at all — it derives payment info from
--     appointments.payment_status. The owner-read policy below is
--     added for correctness / future use, not because anything live
--     needs it today — so this migration has zero functional risk.
--   - payments.appointment_id is nullable (ON DELETE SET NULL) — a
--     payment row can become orphaned if its appointment is deleted.
--     Orphaned rows are invisible under the owner-read policy below
--     (nothing to join through); they remain fully visible to the
--     service role regardless.

BEGIN;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- Idempotent — already ON per the tracked migration files, re-asserted
-- here so this migration is correct standalone regardless of what's
-- actually live.

DROP POLICY IF EXISTS "Allow all on payments" ON payments;

CREATE POLICY "payments_owner_read" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a JOIN salons sa ON sa.id = a.salon_id
      WHERE a.id = payments.appointment_id AND sa.owner_id = auth.uid()
    )
  );

-- No anon policy. No authenticated INSERT/UPDATE/DELETE policy —
-- writes happen exclusively via the service-role webhook, which RLS
-- never restricts regardless of what policies exist here.

COMMIT;
