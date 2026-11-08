-- 2026-11-09 — Invoice emails: a server-only log for the daily limit
--
-- POST /api/send-invoice now emails only a saved invoice of the signed-in
-- owner's own salon, to the address saved on it, and at most
--   50 invoice emails per salon and 3 per invoice in any 24 hours.
-- To count them it records every send here first. Only server code (the
-- service role) can read or write this table: RLS on with no policies, and no
-- grants for signed-in users or the public — so an owner can't reset the count.
--
-- Nothing else changes. Run this BEFORE the code goes live: until the table
-- exists the new code refuses to send invoice emails ("unavailable right now").
--
-- Order: pre-checks A–C (read-only) → this file once → after-checks 1–3 →
-- the self-undoing test file. Rollback: sql/2026-11-09-invoice-email-log-rollback.sql
--
-- ── Pre-checks (read-only) ───────────────────────────────────────────────────
--
-- A. The table isn't there yet. Expect one row: NULL.
--
-- select to_regclass('public.invoice_email_log') as already_there;
--
-- B. The invoices table has the columns the new code reads. Expect 13 rows.
--
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'invoices'
--   and column_name in ('id', 'salon_id', 'invoice_number', 'client_name', 'client_email', 'items', 'subtotal',
--                       'tax_rate', 'tax_amount', 'total', 'due_date', 'notes', 'status')
-- order by column_name;
--
-- C. Busiest salons for invoices in the last 30 days (to sanity-check the limits). Any number of rows.
--
-- select salon_id, count(*) as invoices_30_days, max(created_at) as last_invoice
-- from public.invoices where created_at > now() - interval '30 days'
-- group by salon_id order by invoices_30_days desc limit 10;
--
-- ── Change ───────────────────────────────────────────────────────────────────

begin;

create table public.invoice_email_log (
  id          bigint generated always as identity primary key,
  salon_id    uuid not null references public.salons(id) on delete cascade,
  invoice_id  text not null,   -- no foreign key: deleting an invoice must not reset the count
  status      text not null check (status in ('sending', 'sent', 'failed', 'refused')),
  created_at  timestamptz not null default now(),
  resend_id   text,
  error       text
);
comment on table public.invoice_email_log is
  'One row per invoice email attempt (POST /api/send-invoice). Rows in sending/sent count towards the daily limit. Server-only.';

create index invoice_email_log_salon_time on public.invoice_email_log (salon_id, created_at desc);

-- Server-only: RLS on with no policies, and no grants for the browser roles.
alter table public.invoice_email_log enable row level security;
revoke all on public.invoice_email_log from anon, authenticated;

commit;

-- ── After running (read-only) ────────────────────────────────────────────────
-- 1. The table is there. Expect ONE row: invoice_email_log.
--
-- select to_regclass('public.invoice_email_log') as created;
--
-- 2. RLS is on and there are no policies. Expect ONE row: rls_on = true, policies = 0.
--
-- select c.relrowsecurity as rls_on, (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'invoice_email_log') as policies
-- from pg_class c where c.oid = 'public.invoice_email_log'::regclass;
--
-- 3. Signed-in users and the public have no access at all. Expect 0 rows.
--
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'invoice_email_log' and grantee in ('anon', 'authenticated');
--
-- Then run sql/2026-11-09-invoice-email-log-test.sql (self-undoing). Expect:
--   INVOICE EMAIL LOG TEST: 4 passed, 0 failed. Nothing was saved.
