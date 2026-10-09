-- 2026-10-08 — Lifecycle emails to salon owners (docs/lifecycle-emails.md)
--
-- Adds:
--   • salons.lifecycle_emails_opt_out — owner's unsubscribe choice (default: subscribed)
--   • public.email_log               — every lifecycle email decision (sent / failed / dry run)
--
-- Used by /api/cron/lifecycle-emails, /api/lifecycle/unsubscribe and
-- /api/admin/lifecycle, all with the service role. Not run automatically:
-- run it by hand in the Supabase SQL editor BEFORE deploying the branch.
--
-- ── 1. Read-only pre-check (run first; nothing changes) ─────────────────────
-- Every column the cron reads must be listed (18 rows). appointments.created_at
-- and services.archived_at matter most: the cron fails safely without them.
--
-- select table_name, column_name from information_schema.columns
-- where table_schema = 'public' and (
--      (table_name = 'salons'       and column_name in ('trial_ends_at','subscription_status','subscription_id','is_demo_data','is_staging','owner_email','owner_id','created_at','business_type'))
--   or (table_name = 'appointments' and column_name in ('salon_id','created_at'))
--   or (table_name = 'login_logs'   and column_name in ('salon_id','logged_at'))
--   or (table_name = 'services'     and column_name in ('salon_id','name','price','duration_minutes','archived_at')))
-- order by 1, 2;
--
-- ── 2. Migration ─────────────────────────────────────────────────────────────

-- Owner opt-out for lifecycle emails (default: subscribed). Owners may change
-- their own preference, so it is NOT in salons_guard_sensitive_columns.
alter table public.salons
  add column if not exists lifecycle_emails_opt_out boolean not null default false;

create table if not exists public.email_log (
  id          bigint generated always as identity primary key,
  salon_id    uuid not null references public.salons(id) on delete cascade,
  email_key   text not null,          -- e1_welcome … e8_gone_quiet
  dedupe_key  text not null,          -- e1–e5, e7: = email_key; e6, e8: email_key || ':' || YYYY-MM-DD
  status      text not null check (status in ('sending', 'sent', 'failed', 'dry_run')),
  sent_at     timestamptz not null default now(),
  resend_id   text,
  error       text
);

-- Stops the same one-time email going twice, and any email twice on one
-- day, even if two runs overlap. Dry-run and failed rows don't count.
create unique index if not exists email_log_no_duplicates
  on public.email_log (salon_id, dedupe_key)
  where status in ('sending', 'sent');

create index if not exists email_log_salon_sent_at on public.email_log (salon_id, sent_at desc);

-- Server-only: RLS on with no policies, so the browser can't read or write it.
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- ── 3. Rollback ──────────────────────────────────────────────────────────────
-- Preferred: unset LIFECYCLE_EMAILS_LIVE in Vercel (back to dry run) and keep the data.
-- Full rollback (deletes the log and every owner's opt-out choice):
--
-- drop table if exists public.email_log;
-- alter table public.salons drop column if exists lifecycle_emails_opt_out;
