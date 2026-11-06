-- 2026-11-06 — Every 5 minutes, release online bookings that weren't paid within 30 minutes
--
-- A client who starts an online booking and never pays leaves a "pending"
-- booking that holds the slot for good. This schedules a Supabase pg_cron job
-- that calls the app every 5 minutes:
--   POST https://featuresalon.co.uk/api/cron/expire-pending-bookings
-- The app (not this SQL) does the work: for each booking that started an online
-- payment more than 30 minutes ago and still isn't paid, it closes the Stripe
-- payment FIRST and then cancels the booking. It never touches pay-at-salon,
-- paid, confirmed or owner-made bookings (only bookings with a saved
-- PaymentIntent have one, and only online bookings get one).
--
-- The call is protected by a random secret made here and kept in Supabase
-- Vault; the same value goes into Vercel as PENDING_BOOKINGS_CRON_SECRET.
-- No table, column or function is changed.
--
-- Order:
--   0. The app change (PR "expire pending bookings") is merged and live.
--   1. Pre-checks A–F below (read-only). pg_cron, pg_net and Vault must be on:
--      Supabase → Database → Extensions.
--   2. This whole file — once.
--   3. After-checks 1–4 at the bottom (1 gives the secret for Vercel).
-- Until the secret is in Vercel, each call is answered "not set" and changes
-- nothing — safe to leave running in between.
-- Rollback: sql/2026-11-06-expire-pending-bookings-rollback.sql
--
-- ── Pre-checks (read-only — run each one first, nothing changes) ────────────
--
-- A. The three extensions are installed. Expect 3 rows, each with an
--    installed_version (not empty). If one is empty, switch it on in
--    Supabase → Database → Extensions first.
--
-- select name, installed_version from pg_available_extensions
-- where name in ('pg_cron', 'pg_net', 'supabase_vault')
-- order by name;
--
-- B. The columns the app's cleanup reads. Expect 5 rows; created_at has a
--    default like now(), payment_intent_id is text.
--
-- select column_name, data_type, column_default from information_schema.columns
-- where table_schema = 'public' and table_name = 'appointments'
--   and column_name in ('status', 'payment_status', 'payment_method', 'payment_intent_id', 'created_at')
-- order by column_name;
--
-- C. What the first run would cancel. Expect 0 rows (PaymentIntent ids are only
--    saved from this change on). If there are rows, send them to me first.
--
-- select a.id, s.slug, a.created_at, a.date_time, a.payment_status, a.payment_intent_id
-- from public.appointments a join public.salons s on s.id = a.salon_id
-- where a.status = 'pending' and a.payment_status in ('pending', 'failed')
--   and a.payment_intent_id is not null and a.created_at < now() - interval '30 minutes'
-- order by a.created_at;
--
-- D. For information: future bookings still "pending" with no PaymentIntent
--    saved. The cleanup does NOT touch these — older abandoned online bookings
--    look exactly like owner-made "pending" bookings. Send me the counts; we
--    can go through them by hand.
--
-- select s.slug, count(*) as pending_unpaid_future, min(a.created_at) as oldest_created
-- from public.appointments a join public.salons s on s.id = a.salon_id
-- where a.status = 'pending' and a.payment_status in ('pending', 'failed')
--   and a.payment_intent_id is null and a.date_time > now()
-- group by s.slug
-- order by 2 desc;
--
-- E. No job with this name yet. Expect 0 rows.
--
-- select jobid, jobname, schedule, active from cron.job where jobname = 'expire-pending-bookings';
--
-- F. No secret with this name yet. Expect 0 rows.
--
-- select name from vault.secrets where name = 'pending_bookings_cron_secret';
--
-- ── Change ───────────────────────────────────────────────────────────────────

begin;

-- 1. A random secret (64 hex characters), kept in Supabase Vault.
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'pending_bookings_cron_secret',
  'Bearer secret for /api/cron/expire-pending-bookings — same value as PENDING_BOOKINGS_CRON_SECRET in Vercel'
);

-- 2. Every 5 minutes, ask the app to release unpaid online bookings.
select cron.schedule(
  'expire-pending-bookings',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://featuresalon.co.uk/api/cron/expire-pending-bookings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pending_bookings_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

commit;

-- ── After running ────────────────────────────────────────────────────────────
-- 1. The secret, to copy into Vercel → Project → Settings → Environment
--    Variables → PENDING_BOOKINGS_CRON_SECRET (Production, Sensitive). Then
--    redeploy production (Deployments → latest → Redeploy). Expect ONE row with
--    a 64-character value. Don't paste it anywhere else.
--
-- select decrypted_secret from vault.decrypted_secrets where name = 'pending_bookings_cron_secret';
--
-- 2. After the redeploy: a dry run (changes nothing). Run the first line, wait
--    a few seconds, then run the second with the number it gave. Expect
--    status_code 200 and content starting {"dryRun":true,"due":0,...
--
-- select net.http_post(url := 'https://featuresalon.co.uk/api/cron/expire-pending-bookings', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pending_bookings_cron_secret')), body := '{"dry_run": true}'::jsonb, timeout_milliseconds := 30000) as request_id;
--
-- select status_code, content::text from net._http_response where id = <the request_id from above>;
--
-- 3. The job is on and runs. Expect jobname expire-pending-bookings, schedule
--    */5 * * * *, active true — and (after 5–10 minutes) runs with status
--    succeeded.
--
-- select j.jobname, j.schedule, j.active, d.status, d.start_time
-- from cron.job j left join cron.job_run_details d on d.jobid = j.jobid
-- where j.jobname = 'expire-pending-bookings'
-- order by d.start_time desc nulls last
-- limit 5;
--
-- 4. The app answers the job. Expect status_code 200 and content like
--    {"dryRun":false,"due":0,"bookingsCancelled":0,...  (500 "not set" or 401
--    means the Vercel secret isn't in place / doesn't match yet.)
--
-- select created, status_code, left(content::text, 160) as content
-- from net._http_response
-- where content::text like '%"bookingsCancelled"%' or content::text like '%PENDING_BOOKINGS_CRON_SECRET%' or status_code = 401
-- order by created desc
-- limit 5;
