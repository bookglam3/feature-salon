-- 2026-11-09 — Reminders every 15 minutes (Supabase pg_cron), and fresh reminders after a time change
--
-- Reminders were never sent: /api/send-reminder ran once a day (Vercel cron)
-- but looked for bookings in ±15-minute windows. The app now uses catch-up
-- windows and sends each message at most once (PR "reminders every 15 min").
-- This file:
--   1. keeps a random secret in Supabase Vault (same value goes into Vercel
--      as REMINDERS_CRON_SECRET),
--   2. schedules a pg_cron job that POSTs to
--      https://featuresalon.co.uk/api/send-reminder every 15 minutes with
--      "Authorization: Bearer <that secret>" — the secret is read from Vault
--      at each run, never written into the job or a URL,
--   3. adds a trigger: when a booking's date/time changes, its 24h / 2h
--      reminders and no-show alert are due again (for the new time).
-- The daily Vercel cron stays as a backup; a message is claimed on the
-- booking before it is sent, so the two can never send it twice.
--
-- Order:
--   0. The app change is merged and live.
--   1. Pre-checks A–F below (read-only).
--   2. This whole file — once.
--   3. After-checks 1–5 at the bottom (1 gives the secret for Vercel), then
--      the self-undoing test file.
-- Until the secret is in Vercel, each call is answered "not set" and sends
-- nothing — safe to leave running in between.
-- Rollback: sql/2026-11-09-reminders-every-15-min-rollback.sql
--
-- ── Pre-checks (read-only — run each one first, nothing changes) ────────────
--
-- A. pg_cron, pg_net and Vault are installed. Expect 3 rows, each with an
--    installed_version (not empty).
--
-- select name, installed_version from pg_available_extensions
-- where name in ('pg_cron', 'pg_net', 'supabase_vault')
-- order by name;
--
-- B. The booking columns the reminders and the trigger use. Expect 9 rows:
--    the 7 *_sent columns boolean with default false, created_at and
--    date_time timestamp with time zone.
--
-- select column_name, data_type, column_default, is_nullable from information_schema.columns
-- where table_schema = 'public' and table_name = 'appointments'
--   and column_name in ('reminder_24h_sent', 'reminder_2h_sent', 'whatsapp_24h_sent', 'whatsapp_2h_sent',
--                       'thankyou_1h_sent', 'no_show_alert_sent', 'winback_sent', 'created_at', 'date_time')
-- order by column_name;
--
-- C. For information: triggers already on appointments. Any number of rows;
--    none may be called appointments_reset_reminders_on_reschedule.
--
-- select trigger_name, action_timing, string_agg(event_manipulation, ', ') as events
-- from information_schema.triggers
-- where event_object_schema = 'public' and event_object_table = 'appointments'
-- group by 1, 2 order by 1;
--
-- D. What the first runs would send (before opt-outs / the rebooked check).
--    Expect 5 rows with small numbers — send them to me if any is above 20.
--
-- select message, count(*) as bookings from (
--   select case
--     when a.status = 'confirmed' and a.reminder_24h_sent = false
--          and a.date_time > now() + interval '2 hours' and a.date_time <= now() + interval '24 hours'
--          and (a.created_at is null or a.created_at <= a.date_time - interval '24 hours') then '1 24h reminder'
--     when a.status = 'confirmed' and a.reminder_2h_sent = false
--          and a.date_time > now() + interval '30 minutes' and a.date_time <= now() + interval '2 hours'
--          and (a.created_at is null or a.created_at <= a.date_time - interval '2 hours') then '2 2h reminder'
--     when a.status = 'completed' and a.thankyou_1h_sent = false
--          and a.date_time > now() - interval '24 hours' and a.date_time <= now() - interval '1 hour' then '3 thank-you'
--     when a.status = 'confirmed' and a.no_show_alert_sent = false
--          and a.date_time > now() - interval '12 hours' and a.date_time <= now() - interval '30 minutes' then '4 no-show alert (owner)'
--     when a.status = 'confirmed' and a.winback_sent = false
--          and a.date_time > now() - interval '43 days' and a.date_time <= now() - interval '42 days' then '5 win-back email'
--   end as message
--   from public.appointments a join public.salons s on s.id = a.salon_id
--   where s.reminders_enabled is not false
-- ) x where message is not null
-- group by message order by message;
--
-- E. No job with this name yet. Expect 0 rows.
--
-- select jobid, jobname, schedule, active from cron.job where jobname = 'send-reminders';
--
-- F. No secret with this name yet. Expect 0 rows.
--
-- select name from vault.secrets where name = 'reminders_cron_secret';
--
-- ── Change ───────────────────────────────────────────────────────────────────

begin;

-- 0. Stop (and change nothing) unless the reminder flag columns are all there.
do $$
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'appointments'
        and column_name in ('reminder_24h_sent', 'reminder_2h_sent', 'whatsapp_24h_sent', 'whatsapp_2h_sent', 'no_show_alert_sent')) <> 5 then
    raise exception 'appointments is missing a reminder flag column (pre-check B). Nothing was changed.';
  end if;
end $$;

-- 1. A booking moved to a new date/time gets its reminders for the new time.
--    Thank-you and win-back are about the visit itself, so they stay as they are.
create function public.appointments_reset_reminders_on_reschedule() returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.date_time is distinct from old.date_time then
    new.reminder_24h_sent  := false;
    new.reminder_2h_sent   := false;
    new.whatsapp_24h_sent  := false;
    new.whatsapp_2h_sent   := false;
    new.no_show_alert_sent := false;
  end if;
  return new;
end;
$$;

create trigger appointments_reset_reminders_on_reschedule
  before update of date_time on public.appointments
  for each row execute function public.appointments_reset_reminders_on_reschedule();

-- 2. A random secret (64 hex characters), kept in Supabase Vault.
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'reminders_cron_secret',
  'Bearer secret for POST /api/send-reminder — same value as REMINDERS_CRON_SECRET in Vercel'
);

-- 3. Every 15 minutes, ask the app to send whatever reminders are due.
select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://featuresalon.co.uk/api/send-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

commit;

-- ── After running ────────────────────────────────────────────────────────────
-- 1. The secret, to copy into Vercel → Project → Settings → Environment
--    Variables → REMINDERS_CRON_SECRET (Production, Sensitive). Then redeploy
--    production (Deployments → latest → Redeploy). Expect ONE row with a
--    64-character value. Don't paste it anywhere else.
--
-- select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret';
--
-- 2. After the redeploy: a dry run (counts only, sends nothing). Run the first
--    line, wait a few seconds, then the second with the number it gave.
--    Expect status_code 200 and content starting {"dryRun":true,... — its
--    "whatsapp":{"reminders":"meta"|"twilio"|"none",...} says which WhatsApp
--    path production uses.
--
-- select net.http_post(url := 'https://featuresalon.co.uk/api/send-reminder', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')), body := '{"dry_run": true}'::jsonb, timeout_milliseconds := 60000) as request_id;
--
-- select status_code, content::text from net._http_response where id = <the request_id from above>;
--
-- 3. The job is on and runs. Expect jobname send-reminders, schedule
--    */15 * * * *, active true — and (after 15–30 minutes) runs with status
--    succeeded.
--
-- select j.jobname, j.schedule, j.active, d.status, d.start_time
-- from cron.job j left join cron.job_run_details d on d.jobid = j.jobid
-- where j.jobname = 'send-reminders'
-- order by d.start_time desc nulls last
-- limit 5;
--
-- 4. The app answers the job. Expect status_code 200 and content like
--    {"dryRun":false,"checkedAt":...,"sent":{...},...  (500 "not set" or 401
--    means the Vercel secret isn't in place / doesn't match yet.)
--
-- select created, status_code, left(content::text, 300) as content
-- from net._http_response
-- where content::text like '%"checkedAt"%' or content::text like '%REMINDERS_CRON_SECRET%' or status_code = 401
-- order by created desc
-- limit 5;
--
-- 5. The trigger is on. Expect ONE row: appointments_reset_reminders_on_reschedule, BEFORE, UPDATE.
--
-- select trigger_name, action_timing, event_manipulation
-- from information_schema.triggers
-- where event_object_schema = 'public' and event_object_table = 'appointments'
--   and trigger_name = 'appointments_reset_reminders_on_reschedule';
--
-- Then run sql/2026-11-09-reminders-every-15-min-test.sql (self-undoing). Expect:
--   REMINDER TRIGGER TEST: 3 passed, 0 failed. Nothing was saved.
