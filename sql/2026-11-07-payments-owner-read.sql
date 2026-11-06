-- 2026-11-07 — Salon owners can read their own payments
--
-- public.payments has row level security ON and NO policy (pre-check, 7 Nov),
-- so no signed-in owner can read any row: the dashboard Payments page is empty
-- for everyone, and the new payment labels on bookings can't show amounts.
-- (The webhook writes with the service role, which RLS doesn't apply to, so
-- payments are still being recorded.)
--
-- This adds ONE read-only policy: a signed-in user can read a payment only when
-- it belongs to a booking of a salon they own. Nothing else changes — no new
-- write access, nothing for the public (anon), and payments not linked to any
-- booking stay hidden.
--
-- Run by hand in the Supabase SQL editor:
--   1. pre-checks A–B below (read-only);
--   2. this whole file — once;
--   3. after-checks 1–2 at the bottom, then the self-undoing test file
--      sql/2026-11-07-payments-owner-read-test.sql.
-- Rollback: sql/2026-11-07-payments-owner-read-rollback.sql
--
-- ── Pre-checks (read-only) ───────────────────────────────────────────────────
--
-- A. No policy on payments yet, RLS on. Expect: 0 rows from the first, rls_on = true from the second.
--
-- select policyname from pg_policies where schemaname = 'public' and tablename = 'payments';
--
-- select relrowsecurity as rls_on from pg_class where oid = 'public.payments'::regclass;
--
-- B. Signed-in users have the table permission the policy works through.
--    Expect: authenticated_can_select = true.
--
-- select has_table_privilege('authenticated', 'public.payments', 'SELECT') as authenticated_can_select;
--
-- ── Change ───────────────────────────────────────────────────────────────────

begin;

create policy payments_owner_read on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.appointments a
      join public.salons s on s.id = a.salon_id
      where a.id = payments.appointment_id
        and s.owner_id = (select auth.uid())
    )
  );

commit;

-- ── After running (read-only) ────────────────────────────────────────────────
-- 1. The policy is there. Expect ONE row: payments_owner_read, SELECT, {authenticated}.
--
-- select policyname, permissive, cmd, roles, qual
-- from pg_policies where schemaname = 'public' and tablename = 'payments';
--
-- 2. Run sql/2026-11-07-payments-owner-read-test.sql (self-undoing, saves
--    nothing). Expect a message like:
--    PAYMENTS READ TEST: passed. The owner sees 2 of their salon's 2 payments, another signed-in user sees 0, the public sees 0. Nothing was saved.
