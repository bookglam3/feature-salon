-- 2026-11-07 — ROLLBACK for sql/2026-11-07-payments-owner-read.sql
--
-- Removes the owner read policy. payments goes back to RLS on with no policy:
-- nobody signed in can read it (the webhook still records payments).
-- Run the whole file in the Supabase SQL editor.

begin;

drop policy payments_owner_read on public.payments;

commit;

-- After running — expect 0 rows:
--
-- select policyname from pg_policies where schemaname = 'public' and tablename = 'payments';
