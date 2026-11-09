-- 2026-11-09 — ROLLBACK for sql/2026-11-09-reminders-every-15-min.sql
--
-- Stops the 15-minute job, removes its Vault secret and the reschedule
-- trigger. The daily Vercel cron (vercel.json) keeps sending reminders once a
-- day with the app's catch-up windows. REMINDERS_CRON_SECRET in Vercel can
-- stay (unused) or be deleted.
-- Run the whole file in the Supabase SQL editor.

begin;

select cron.unschedule('send-reminders');
delete from vault.secrets where name = 'reminders_cron_secret';
drop trigger appointments_reset_reminders_on_reschedule on public.appointments;
drop function public.appointments_reset_reminders_on_reschedule();

commit;

-- After running — expect 0 rows from each:
--
-- select jobname from cron.job where jobname = 'send-reminders';
--
-- select name from vault.secrets where name = 'reminders_cron_secret';
--
-- select trigger_name from information_schema.triggers
-- where event_object_schema = 'public' and event_object_table = 'appointments' and trigger_name = 'appointments_reset_reminders_on_reschedule';
