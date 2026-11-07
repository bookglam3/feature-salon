-- 2026-11-08 — ROLLBACK for sql/2026-11-08-lifetime-access.sql
--
-- Removes the guard trigger, its function and the lifetime_access column. The
-- lifetime salon then goes back to what its plan / Stripe fields say.
-- Run the whole file in the Supabase SQL editor.

begin;

drop trigger salons_guard_lifetime_access on public.salons;
drop function public.salons_guard_lifetime_access();
alter table public.salons drop column lifetime_access;

commit;

-- After running — expect 0 rows from each:
--
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'salons' and column_name = 'lifetime_access';
--
-- select trigger_name from information_schema.triggers
-- where event_object_schema = 'public' and event_object_table = 'salons' and trigger_name = 'salons_guard_lifetime_access';
