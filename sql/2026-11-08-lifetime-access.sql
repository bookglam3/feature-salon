-- 2026-11-08 — Lifetime access: one salon gets everything, for good
--
-- Adds salons.lifetime_access (true = all Business features, never locked,
-- whatever its plan or Stripe status says) and sets it for ONE salon: the
-- owner's lifetime-free customer. Today that salon's access rests on its
-- Stripe fields (active, a 100% "forever" coupon, subscription_plan
-- "starter"), which Stripe webhooks overwrite — this flag is ours alone.
--
-- Owners must not be able to give it to themselves: signed-in users can
-- update their own salon row, and salons_guard_sensitive_columns only guards
-- its own fixed list of columns. So a small separate trigger refuses any
-- signed-in or public (anon) insert/update that sets or changes
-- lifetime_access — super admins, the service role (server code) and this SQL
-- editor are not affected. The existing guard is not touched.
--
-- What uses the flag: POST /api/broadcast/send already reads it (live). The
-- dashboard and feature checks read it from the next change on (shared access
-- rule). Until then nothing else changes for anyone.
--
-- Order: pre-checks A–C (read-only) → this file once → after-checks 1–3 →
-- the self-undoing test file. Rollback: sql/2026-11-08-lifetime-access-rollback.sql
--
-- ▶ BEFORE RUNNING: on the "update public.salons set lifetime_access = true"
--   line, replace <lifetime-salon-slug> with the salon's slug (pre-check B).
--
-- ── Pre-checks (read-only) ───────────────────────────────────────────────────
--
-- A. The column isn't there yet. Expect 0 rows.
--
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'salons' and column_name = 'lifetime_access';
--
-- B. The salon that gets it: put its slug in. Expect exactly ONE row, the right salon.
--
-- select id, slug, name, owner_email, subscription_status, subscription_plan from public.salons where slug = '<lifetime-salon-slug>';
--
-- C. The super-admin check the new trigger relies on exists. Expect 1 row.
--
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_super_admin';
--
-- ── Change ───────────────────────────────────────────────────────────────────

begin;

alter table public.salons add column lifetime_access boolean not null default false;
comment on column public.salons.lifetime_access is
  'Free access to everything (all Business features), never locked. Set only by the platform owner — signed-in users cannot set or change it (trigger salons_guard_lifetime_access).';

create function public.salons_guard_lifetime_access() returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_is_admin boolean := false;
begin
  -- server code (service role) and the SQL editor are trusted
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if to_regprocedure('public.is_super_admin()') is not null then
    execute 'select public.is_super_admin()' into v_is_admin;
    if coalesce(v_is_admin, false) then return new; end if;
  end if;
  if tg_op = 'INSERT' then
    if new.lifetime_access then
      raise exception 'Not allowed to set: lifetime_access' using errcode = '42501';
    end if;
  elsif new.lifetime_access is distinct from old.lifetime_access then
    raise exception 'Not allowed to change: lifetime_access' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger salons_guard_lifetime_access
  before insert or update on public.salons
  for each row execute function public.salons_guard_lifetime_access();

update public.salons set lifetime_access = true where slug = '<lifetime-salon-slug>';

-- Stop (and undo everything above) unless exactly one salon has it.
do $$
begin
  if (select count(*) from public.salons where lifetime_access) <> 1 then
    raise exception 'Expected exactly one salon with lifetime_access — check the slug. Nothing was changed.';
  end if;
end $$;

commit;

-- ── After running (read-only) ────────────────────────────────────────────────
-- 1. The column: boolean, not null, default false. Expect ONE row.
--
-- select data_type, is_nullable, column_default from information_schema.columns
-- where table_schema = 'public' and table_name = 'salons' and column_name = 'lifetime_access';
--
-- 2. Exactly one salon has it — the right one. Expect ONE row.
--
-- select slug, name, lifetime_access from public.salons where lifetime_access;
--
-- 3. The guard is on. Expect ONE row: salons_guard_lifetime_access, BEFORE, INSERT and UPDATE.
--
-- select trigger_name, action_timing, string_agg(event_manipulation, ', ' order by event_manipulation) as events
-- from information_schema.triggers
-- where event_object_schema = 'public' and event_object_table = 'salons' and trigger_name = 'salons_guard_lifetime_access'
-- group by 1, 2;
--
-- Then run sql/2026-11-08-lifetime-access-test.sql (self-undoing). Expect:
--   LIFETIME ACCESS TEST: 4 passed, 0 failed. Nothing was saved.
