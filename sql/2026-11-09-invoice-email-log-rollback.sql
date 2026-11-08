-- 2026-11-09 — ROLLBACK for sql/2026-11-09-invoice-email-log.sql
--
-- Removes the invoice email log (and its counts). Roll back the code FIRST
-- (revert the send-invoice PR): while the new code is live and this table is
-- gone, invoice emails are refused ("unavailable right now").
-- Run the whole file in the Supabase SQL editor.

begin;

drop table public.invoice_email_log;

commit;

-- After running — expect one row: NULL.
--
-- select to_regclass('public.invoice_email_log') as still_there;
