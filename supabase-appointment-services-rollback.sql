-- Reverses supabase-appointment-services-migration.sql.
-- Purely additive migration → purely subtractive rollback.
--
-- Safe at any point BEFORE app code starts writing to this table
-- (Step 3 onward in the multi-service build). Once real multi-service
-- bookings exist as appointment_services rows, dropping the table
-- deletes that data — confirm nothing has started writing to it
-- (check `SELECT count(*) FROM appointment_services` first) before
-- running this past that point.

BEGIN;
DROP POLICY IF EXISTS "appointment_services_anon_insert" ON appointment_services;
DROP POLICY IF EXISTS "appointment_services_owner_all"   ON appointment_services;
DROP TABLE IF EXISTS appointment_services;
COMMIT;
