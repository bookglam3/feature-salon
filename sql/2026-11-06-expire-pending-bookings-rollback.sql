-- 2026-11-06 — ROLLBACK for sql/2026-11-06-expire-pending-bookings.sql
--
-- Stops the every-5-minutes job and removes its secret. Bookings it already
-- cancelled stay cancelled (their Stripe payments were closed first). The app
-- change can stay: without the job nothing calls the cleanup.
-- Run the whole file in the Supabase SQL editor. Afterwards you can also delete
-- PENDING_BOOKINGS_CRON_SECRET in Vercel.

begin;

select cron.unschedule('expire-pending-bookings');
delete from vault.secrets where name = 'pending_bookings_cron_secret';

commit;

-- After running — expect 0 rows from each:
--
-- select jobid from cron.job where jobname = 'expire-pending-bookings';
--
-- select name from vault.secrets where name = 'pending_bookings_cron_secret';
