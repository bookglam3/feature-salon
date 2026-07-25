-- Reverses supabase-payments-rls-fix.sql — restores the exact original
-- policy found in supabase-payments-migration.sql / supabase-MASTER-
-- migration.sql. Does not disable RLS (ALTER TABLE ... DISABLE ROW
-- LEVEL SECURITY) since RLS being enabled was already the pre-existing
-- tracked state before this migration touched anything.

BEGIN;

DROP POLICY IF EXISTS "payments_owner_read" ON payments;

CREATE POLICY "Allow all on payments" ON payments
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
