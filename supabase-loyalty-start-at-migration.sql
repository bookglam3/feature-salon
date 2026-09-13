-- ═══════════════════════════════════════════════════════════════════
-- Loyalty fix A — counting starts when the programme starts
--
-- Problem: loyalty_progress counts every completed appointment since the
-- client's last redemption. loyalty_cards is empty, so every client
-- resolves to COALESCE(NULL,'-infinity') = all history. Combined with the
-- appointments.completed_at backfill, switching the programme on would
-- instantly present a large share of Anita Love Hair's ~640 clients as
-- owed a free service.
--
-- ADDITIVE. One new column on loyalty_settings + one view replacement.
-- The only write is to populate the NEW column on existing rows. No
-- existing column or row data is modified. loyalty_cards and
-- loyalty_redemptions are untouched.
--
-- FAILS CLOSED by construction:
--   * every EXISTING settings row is given a concrete start of now(), so
--     no salon already configured can suddenly count its back-catalogue
--   * a NULL loyalty_start_at means "never started" and counts NOTHING
--     (the 'infinity' fallback below), not "count everything"
--   * honouring history is therefore never the default — it requires the
--     deliberate, per-salon UPDATE documented at the bottom
--
-- Run top to bottom. Idempotent. Rollback at the end.
--
-- ORDER: run this migration BEFORE deploying the app change. The app
-- writes loyalty_start_at on first enable, which errors if the column
-- does not exist yet.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. New column ─────────────────────────────────────────────────
-- Deliberately NULLABLE and with NO default. NULL is meaningful: it
-- means "the programme has never been switched on for this salon", which
-- the view treats as "count nothing". A DEFAULT now() would instead start
-- the clock when the settings row is created, which is not the same
-- moment — an owner can configure the programme months before enabling
-- it, and those months must not silently become earned stamps.
ALTER TABLE loyalty_settings
  ADD COLUMN IF NOT EXISTS loyalty_start_at timestamptz;


-- ─── 2. Backfill EXISTING rows with a concrete value ───────────────
-- Any salon that already has a settings row may already be enabled, so
-- it must start counting from now rather than from its history. This is
-- the fail-closed step: it can never grant a stamp that did not exist a
-- moment ago. Safe to re-run — it only touches rows still NULL, so it
-- cannot overwrite a real start date on a second run.
UPDATE loyalty_settings
   SET loyalty_start_at = now()
 WHERE loyalty_start_at IS NULL;


-- ─── 3. loyalty_progress: bounded by BOTH watermarks ───────────────
-- Note the deliberate asymmetry in the two COALESCE fallbacks:
--
--   last_redeemed_at -> '-infinity'  no redemption yet, so count
--                                    everything since the programme start
--   loyalty_start_at ->  'infinity'  no settings row at all, so the
--                                    programme has never run: count
--                                    NOTHING. This is the fail-closed
--                                    default. '-infinity' here would
--                                    reintroduce the original bug for any
--                                    salon without a settings row.
--
-- GREATEST() of the two means a visit counts only if it happened after
-- the programme started AND after that client's last reward.
CREATE OR REPLACE VIEW loyalty_progress
WITH (security_invoker = true) AS
SELECT
  a.salon_id,
  lower(btrim(a.client_email))                       AS client_email,
  max(a.client_name)                                 AS client_name,
  count(*) FILTER (
    WHERE a.completed_at IS NOT NULL
      AND a.completed_at > GREATEST(
            COALESCE(c.last_redeemed_at,  '-infinity'::timestamptz),
            COALESCE(ls.loyalty_start_at,  'infinity'::timestamptz)
          )
  )                                                  AS visits,
  max(a.completed_at)                                AS last_visit_at,
  count(*)                                           AS lifetime_visits,
  COALESCE(c.rewards_redeemed, 0)                    AS rewards_redeemed,
  c.last_redeemed_at                                 AS last_redeemed_at,
  ls.loyalty_start_at                                AS loyalty_start_at
FROM appointments a
LEFT JOIN loyalty_cards c
       ON c.salon_id     = a.salon_id
      AND c.client_email = lower(btrim(a.client_email))
LEFT JOIN loyalty_settings ls
       ON ls.salon_id    = a.salon_id
WHERE a.status = 'completed'
  AND a.client_email IS NOT NULL
  AND btrim(a.client_email) <> ''
GROUP BY
  a.salon_id,
  lower(btrim(a.client_email)),
  c.rewards_redeemed,
  c.last_redeemed_at,
  ls.loyalty_start_at;


-- ─── Verification (read-only; run after the above) ─────────────────
--
-- SELECT count(*) AS settings_without_start
--   FROM loyalty_settings WHERE loyalty_start_at IS NULL;
--   -- expect 0 (every existing row was backfilled)
--
-- SELECT count(*) AS clients_at_or_over_threshold
--   FROM loyalty_progress p
--   JOIN loyalty_settings ls ON ls.salon_id = p.salon_id
--  WHERE p.visits >= ls.visits_required;
--   -- expect 0 — no completed visit can post-date a start_at of now()
--
-- SELECT salon_id, count(*) AS rows, sum(visits) AS total_visits
--   FROM loyalty_progress GROUP BY salon_id ORDER BY total_visits DESC;
--   -- expect total_visits = 0 for every salon immediately after running


-- ─── Honouring history: DELIBERATE, per salon, never the default ───
-- Only after confirming with the owner what they are agreeing to owe.
-- Check the exposure FIRST:
--
--   WITH per_client AS (
--     SELECT lower(btrim(client_email)) AS e, count(*) AS visits
--       FROM appointments
--      WHERE salon_id = '<uuid>' AND status = 'completed'
--        AND client_email IS NOT NULL AND btrim(client_email) <> ''
--      GROUP BY 1)
--   SELECT count(*) FILTER (WHERE visits >= 5) AS would_be_owed_at_5
--     FROM per_client;
--
-- Then, and only then:
--   UPDATE loyalty_settings SET loyalty_start_at = '-infinity'::timestamptz
--    WHERE salon_id = '<uuid>';
-- Or from a chosen date:
--   UPDATE loyalty_settings SET loyalty_start_at = '2026-01-01T00:00:00Z'
--    WHERE salon_id = '<uuid>';


-- ─── ROLLBACK ───────────────────────────────────────────────────────
-- Restores the previous view verbatim, then drops the column.
-- NOTE: rolling back restores the count-all-history behaviour.
--
-- CREATE OR REPLACE VIEW loyalty_progress
-- WITH (security_invoker = true) AS
-- SELECT
--   a.salon_id,
--   lower(btrim(a.client_email))                       AS client_email,
--   max(a.client_name)                                 AS client_name,
--   count(*) FILTER (
--     WHERE a.completed_at IS NOT NULL
--       AND a.completed_at > COALESCE(c.last_redeemed_at, '-infinity'::timestamptz)
--   )                                                  AS visits,
--   max(a.completed_at)                                AS last_visit_at,
--   count(*)                                           AS lifetime_visits,
--   COALESCE(c.rewards_redeemed, 0)                    AS rewards_redeemed,
--   c.last_redeemed_at                                 AS last_redeemed_at
-- FROM appointments a
-- LEFT JOIN loyalty_cards c
--        ON c.salon_id     = a.salon_id
--       AND c.client_email = lower(btrim(a.client_email))
-- WHERE a.status = 'completed'
--   AND a.client_email IS NOT NULL
--   AND btrim(a.client_email) <> ''
-- GROUP BY
--   a.salon_id,
--   lower(btrim(a.client_email)),
--   c.rewards_redeemed,
--   c.last_redeemed_at;
--
-- ALTER TABLE loyalty_settings DROP COLUMN IF EXISTS loyalty_start_at;
