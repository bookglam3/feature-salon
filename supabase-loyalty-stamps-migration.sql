-- ═══════════════════════════════════════════════════════════════════
-- Visit-based loyalty (stamp card) — v1
--
-- ADDITIVE ONLY. Creates three new tables, one new column on
-- appointments, one view, indexes and RLS policies. It does not drop
-- anything, does not modify any existing row except to populate the
-- new appointments.completed_at column for rows that are already
-- status = 'completed'.
--
-- loyalty_points and loyalty_transactions are deliberately LEFT IN
-- PLACE. The app stops writing to them, but the data stays.
--
-- Run this whole file once, top to bottom, in the Supabase SQL editor.
-- The sections are ordered by dependency:
--   1. appointments.completed_at   (the view depends on it)
--   2. backfill completed_at       (must precede any UI read)
--   3. loyalty_settings
--   4. loyalty_cards               (the view depends on it)
--   5. loyalty_redemptions
--   6. indexes
--   7. loyalty_progress view       (depends on 1 + 4)
--   8. RLS
-- Every statement is idempotent, so re-running is safe.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. appointments.completed_at ──────────────────────────────────
-- When the visit was actually marked complete. Distinct from date_time
-- (when it was scheduled): an owner may mark an old appointment
-- complete today, and the stamp must count from today, not from the
-- appointment date — otherwise it would land behind an existing
-- redemption watermark and be silently ignored.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;


-- ─── 2. Backfill completed_at ──────────────────────────────────────
-- Existing completed appointments have no completion timestamp. The
-- best available approximation is the appointment time itself.
-- Only touches rows that are already 'completed' AND have no value,
-- so it is safe to re-run and never overwrites a real timestamp.
UPDATE appointments
   SET completed_at = date_time
 WHERE status = 'completed'
   AND completed_at IS NULL;


-- ─── 3. loyalty_settings ───────────────────────────────────────────
-- One row per salon. Absence of a row means the programme has never
-- been configured, which the app treats as "off".
CREATE TABLE IF NOT EXISTS loyalty_settings (
  salon_id            uuid PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
  enabled             boolean NOT NULL DEFAULT false,
  visits_required     int     NOT NULL DEFAULT 5
                              CHECK (visits_required BETWEEN 2 AND 100),
  reward_type         text    NOT NULL DEFAULT 'custom'
                              CHECK (reward_type IN
                                ('free_service','amount_off','percent_off','custom')),
  -- SET NULL, not CASCADE: deleting a service must not delete the
  -- salon's entire loyalty configuration.
  reward_service_id   uuid REFERENCES services(id) ON DELETE SET NULL,
  reward_value        numeric(10,2) CHECK (reward_value IS NULL OR reward_value >= 0),
  reward_description  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Each reward_type requires its own field to be present. Enforced in
  -- the database so a malformed row cannot produce a reward the app
  -- cannot describe to a client.
  CONSTRAINT loyalty_settings_reward_shape CHECK (
    (reward_type = 'free_service' AND reward_service_id IS NOT NULL)
    OR (reward_type = 'amount_off'  AND reward_value IS NOT NULL)
    OR (reward_type = 'percent_off' AND reward_value IS NOT NULL
                                    AND reward_value <= 100)
    OR (reward_type = 'custom'      AND reward_description IS NOT NULL
                                    AND btrim(reward_description) <> '')
  )
);


-- ─── 4. loyalty_cards ──────────────────────────────────────────────
-- Per client, per salon. Holds ONLY the redemption watermark and the
-- redeemed tally — never a visit counter. Visits are always computed
-- (see the view in section 7), so they cannot drift out of step with
-- the appointments they are derived from.
--
-- Natural key is (salon_id, client_email) because appointments carry
-- no client_id FK; client_email is stored already-normalised to
-- lower(btrim(...)) by the application.
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id          uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_email      text NOT NULL,
  client_name       text,
  last_redeemed_at  timestamptz,
  rewards_redeemed  int NOT NULL DEFAULT 0 CHECK (rewards_redeemed >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_cards_email_normalised CHECK (client_email = lower(btrim(client_email))),
  CONSTRAINT loyalty_cards_salon_email_key UNIQUE (salon_id, client_email)
);


-- ─── 5. loyalty_redemptions ────────────────────────────────────────
-- Append-only audit trail. reward_snapshot records what the reward
-- WAS at redemption time, so later settings changes cannot rewrite
-- history.
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id             uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_email         text NOT NULL,
  client_name          text,
  redeemed_at          timestamptz NOT NULL DEFAULT now(),
  redeemed_by          uuid,
  visits_at_redemption int  NOT NULL,
  reward_snapshot      jsonb
);


-- ─── 6. Indexes ────────────────────────────────────────────────────
-- The counting index. Matches the view's join and filter exactly:
-- salon, normalised email, status, completion time.
CREATE INDEX IF NOT EXISTS idx_appointments_loyalty_count
  ON appointments (salon_id, lower(btrim(client_email)), status, completed_at);

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_salon
  ON loyalty_cards (salon_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_salon_time
  ON loyalty_redemptions (salon_id, redeemed_at DESC);


-- ─── 7. loyalty_progress view ──────────────────────────────────────
-- Single definition of "how many visits does this client have", shared
-- by the dashboard and the email routes so the two can never disagree.
--
-- Base is completed appointments (not loyalty_cards) so a client who
-- has visited but never redeemed still appears — they have progress
-- without ever needing a card row.
--
-- security_invoker = true so the querying user's RLS applies rather
-- than the view owner's.
DROP VIEW IF EXISTS loyalty_progress;
CREATE VIEW loyalty_progress
WITH (security_invoker = true) AS
SELECT
  a.salon_id,
  lower(btrim(a.client_email))                       AS client_email,
  max(a.client_name)                                 AS client_name,
  -- Visits since the last redemption. A NULL watermark (no card, or
  -- never redeemed) means every completed visit counts.
  count(*) FILTER (
    WHERE a.completed_at IS NOT NULL
      AND a.completed_at > COALESCE(c.last_redeemed_at, '-infinity'::timestamptz)
  )                                                  AS visits,
  max(a.completed_at)                                AS last_visit_at,
  count(*)                                           AS lifetime_visits,
  COALESCE(c.rewards_redeemed, 0)                    AS rewards_redeemed,
  c.last_redeemed_at                                 AS last_redeemed_at
FROM appointments a
LEFT JOIN loyalty_cards c
       ON c.salon_id     = a.salon_id
      AND c.client_email = lower(btrim(a.client_email))
WHERE a.status = 'completed'
  AND a.client_email IS NOT NULL
  AND btrim(a.client_email) <> ''
GROUP BY
  a.salon_id,
  lower(btrim(a.client_email)),
  c.rewards_redeemed,
  c.last_redeemed_at;


-- ─── 8. RLS ────────────────────────────────────────────────────────
-- Salon-owner scoped, authenticated role only. Deliberately NOT the
-- USING (true) pattern used by payments/loyalty_points elsewhere in
-- this project — that pattern lets any authenticated user read every
-- salon's rows.
--
-- The service role bypasses RLS entirely, so the email routes continue
-- to work without a policy of their own.

ALTER TABLE loyalty_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_settings_owner ON loyalty_settings;
CREATE POLICY loyalty_settings_owner ON loyalty_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM salons s
     WHERE s.id = loyalty_settings.salon_id
       AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM salons s
     WHERE s.id = loyalty_settings.salon_id
       AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS loyalty_cards_owner ON loyalty_cards;
CREATE POLICY loyalty_cards_owner ON loyalty_cards
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM salons s
     WHERE s.id = loyalty_cards.salon_id
       AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM salons s
     WHERE s.id = loyalty_cards.salon_id
       AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS loyalty_redemptions_owner ON loyalty_redemptions;
CREATE POLICY loyalty_redemptions_owner ON loyalty_redemptions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM salons s
     WHERE s.id = loyalty_redemptions.salon_id
       AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM salons s
     WHERE s.id = loyalty_redemptions.salon_id
       AND s.owner_id = auth.uid()));


-- ─── Verification (read-only; run after the above) ─────────────────
-- Expect: 3 tables, 1 view, 3 policies, and completed_at populated for
-- every completed appointment.
--
-- SELECT count(*) AS completed_without_timestamp
--   FROM appointments WHERE status = 'completed' AND completed_at IS NULL;
--   -- expect 0
--
-- SELECT tablename, policyname, roles, cmd
--   FROM pg_policies WHERE tablename LIKE 'loyalty_%' ORDER BY tablename;
--   -- expect loyalty_cards / loyalty_redemptions / loyalty_settings,
--   -- each {authenticated}, cmd ALL
--
-- SELECT * FROM loyalty_progress LIMIT 5;
