-- Reverses supabase-appointments-rls-fix.sql.
--
-- Restores the 9 dropped policies and reverts anon_insert_appointments
-- to its original with_check. Does NOT touch the 5 owner_* policies or
-- the 3 RBAC policies — the fix migration never modified those, so
-- there is nothing to roll back for them.
--
-- Exact source: "Allow anon insert", "Allow anon select", "Allow
-- authenticated full access" match supabase-FIX-appointments-rls.sql.
-- "Allow authenticated delete/update/select" and "Allow public read
-- appointments" are reconstructed from the live pg_policies output
-- reported back (cmd/role/qual=true only) — no tracked source exists.
-- "Allow authenticated insert" and "Public can insert appointments"
-- are reconstructed from name + the same qual=true pattern as every
-- other loose policy on this table — their exact original role/check
-- was not individually confirmed, only that they existed and were loose.
-- The original anon_insert_appointments with_check, (notes IS NULL), was
-- confirmed directly from the live policy report before this migration.

BEGIN;

DROP POLICY IF EXISTS "anon_insert_appointments" ON appointments;
CREATE POLICY "anon_insert_appointments" ON appointments
  FOR INSERT TO anon WITH CHECK (notes IS NULL);

CREATE POLICY "Allow anon insert" ON appointments
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated insert" ON appointments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public can insert appointments" ON appointments
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow anon select" ON appointments
  FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read appointments" ON appointments
  FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated select" ON appointments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated full access" ON appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON appointments
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete" ON appointments
  FOR DELETE TO authenticated USING (true);

COMMIT;
