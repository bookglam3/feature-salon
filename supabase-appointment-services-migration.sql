-- ═══════════════════════════════════════════════════════════════
-- appointment_services — line items for multi-service appointments
-- ═══════════════════════════════════════════════════════════════
-- Additive only. Does NOT touch appointments.service_id — that stays
-- exactly as-is (nullable FK, "primary/first service") and stays
-- populated by every existing write path unchanged. Nothing in the
-- app reads or writes this table yet — see multi_service_appointment_
-- spec.md. Safe to run against production with zero behavior change.
--
-- Price/duration are SNAPSHOTS taken at booking time (name/price/
-- duration_minutes columns, not FKs re-resolved later) — if a salon
-- edits a service's price after a client booked it, the booking must
-- keep showing what was actually charged, not today's catalogue price.
--
-- RLS mirrors the service_categories/clients/services pattern from
-- supabase-service-menu-migration-A.sql — walking the FK chain via
-- appointments.salon_id — explicitly NOT the appointments/payments
-- USING(true) pattern (see rls_appointments_payments_leak memory: a
-- real, separate, unfixed cross-tenant PII leak on those two tables —
-- not replicated here, and not fixed here either; that's its own task).
--
-- Unlike services/categories, this table has NO public SELECT policy.
-- Booking line items are not catalogue data — who booked what should
-- never be publicly readable. Anon gets INSERT only, scoped to "the
-- service being attached must belong to the same salon as the
-- appointment" — tighter than the current WITH CHECK (true) anon-insert
-- policy on appointments itself, which enforces no such consistency.

BEGIN;

CREATE TABLE IF NOT EXISTS appointment_services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id        uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  name              text NOT NULL,
  price             numeric(10,2) NOT NULL CHECK (price >= 0),
  duration_minutes  int NOT NULL CHECK (duration_minutes > 0),
  sort_order        int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_services_appointment_idx
  ON appointment_services (appointment_id);
CREATE INDEX IF NOT EXISTS appointment_services_service_idx
  ON appointment_services (service_id);

ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

-- Owner: full access to their own salon's line items, resolved via
-- appointments.salon_id (no direct salon_id column on this table).
CREATE POLICY "appointment_services_owner_all" ON appointment_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a JOIN salons sa ON sa.id = a.salon_id
      WHERE a.id = appointment_services.appointment_id AND sa.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a JOIN salons sa ON sa.id = a.salon_id
      WHERE a.id = appointment_services.appointment_id AND sa.owner_id = auth.uid()
    )
  );

-- Anon: INSERT only — the public booking page creates these at booking
-- time, unauthenticated, same as it does for appointments itself.
-- WITH CHECK enforces the appointment and service belong to the same
-- salon; no anon SELECT/UPDATE/DELETE exists at all.
CREATE POLICY "appointment_services_anon_insert" ON appointment_services
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a JOIN services s ON s.salon_id = a.salon_id
      WHERE a.id = appointment_services.appointment_id AND s.id = appointment_services.service_id
    )
  );

COMMIT;
