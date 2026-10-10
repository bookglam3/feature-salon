-- 2026-10-10 — Gift vouchers, step 1: tables + on/off switch
--
-- Adds:
--   • salons.gift_vouchers_enabled — the owner's switch (default OFF)
--   • public.vouchers              — one row per voucher (money or service)
--   • public.voucher_services      — the services inside a service voucher
--   • public.voucher_redemptions   — append-only history of every use
--   • public.voucher_holds         — a voucher applied to a booking but not yet
--                                    deducted (used from step 5; created now so
--                                    step 2's redeem functions count holds)
-- and copies every valid row of the old gift_cards table into vouchers.
-- gift_cards itself is NOT changed: no rows, columns or policies touched.
--
-- Browser access: owners can READ their own salon's rows. Nobody can write
-- from the browser; steps 2+ write through server routes (service role).
--
-- Not run automatically. Run by hand in the Supabase SQL editor:
--   1. the read-only pre-check below (copy it out, remove the leading "-- ");
--   2. this whole file — it is one transaction and safe to re-run;
--   3. optionally sql/2026-10-10-gift-vouchers-step1-test.sql (self-undoing).
-- Rollback: sql/2026-10-10-gift-vouchers-step1-rollback.sql
--
-- ── 1. Read-only pre-check (run first; nothing changes) ─────────────────────
--
-- A. Types. Expect uuid for every *.id row, and gift_cards to list
--    amount, code, created_at, id, is_redeemed, recipient_email,
--    recipient_name, remaining, salon_id.
--
-- select table_name, column_name, data_type from information_schema.columns
-- where table_schema = 'public'
--   and ((table_name in ('salons','services','staff','appointments') and column_name = 'id')
--        or table_name = 'gift_cards')
-- order by 1, 2;
--
-- B. Owner column. Expect policies on salons and gift_cards that compare
--    owner_id with auth.uid() (e.g. "Salon owner access" on gift_cards).
--
-- select tablename, policyname, cmd, qual from pg_policies
-- where schemaname = 'public' and tablename in ('salons', 'gift_cards')
-- order by 1, 2;
--
-- C. Old gift cards that will NOT be copied (they stay in gift_cards).
--    Expect 0 rows; otherwise send me the list.
--
-- select gc.id, gc.salon_id, gc.code, gc.amount, gc.remaining,
--        case
--          when gc.salon_id is null                                 then 'no salon'
--          when gc.amount is null or gc.amount <= 0                 then 'no amount'
--          when gc.amount > 5000                                    then 'over £5,000'
--          when gc.remaining is null or gc.remaining < 0            then 'bad balance'
--          when gc.remaining > gc.amount                            then 'balance above amount'
--          when char_length(btrim(gc.code)) not between 3 and 40   then 'code length'
--          else 'same code (any case) twice in one salon'
--        end as reason
-- from public.gift_cards gc
-- where gc.salon_id is null or gc.amount is null or gc.amount <= 0 or gc.amount > 5000
--    or gc.remaining is null or gc.remaining < 0 or gc.remaining > gc.amount
--    or char_length(btrim(gc.code)) not between 3 and 40
--    or exists (select 1 from public.gift_cards o
--               where o.salon_id = gc.salon_id and o.id <> gc.id
--                 and lower(btrim(o.code)) = lower(btrim(gc.code))
--                 and (coalesce(o.created_at, 'infinity'), o.id)
--                   < (coalesce(gc.created_at, 'infinity'), gc.id));
--
-- D. Old gift cards marked redeemed. They are copied with a £0 balance.
--
-- select count(*) as redeemed_gift_cards from public.gift_cards where is_redeemed;
--
-- ── 2. Migration ─────────────────────────────────────────────────────────────

begin;

-- 1. Per-salon switch (default OFF). Owners may change it themselves, so it is
--    NOT in salons_guard_sensitive_columns. Public use also needs the plan
--    (and, for online sales, Stripe) — checked server-side, never trusted here.
alter table public.salons
  add column if not exists gift_vouchers_enabled boolean not null default false;

-- 2. Vouchers
create table if not exists public.vouchers (
  id                  uuid primary key default gen_random_uuid(),
  salon_id            uuid not null references public.salons(id) on delete restrict,
  kind                text not null check (kind in ('money', 'service')),
  reference           text not null check (reference = btrim(reference) and char_length(reference) between 3 and 40),
  reference_key       text generated always as (lower(reference)) stored,
  amount_pence        integer check (amount_pence > 0 and amount_pence <= 500000),
  remaining_pence     integer check (remaining_pence >= 0),
  buyer_name          text check (char_length(buyer_name) <= 100),
  buyer_email         text check (char_length(buyer_email) <= 254),
  buyer_phone         text check (char_length(buyer_phone) <= 30),
  recipient_name      text check (char_length(recipient_name) <= 100),
  recipient_email     text check (char_length(recipient_email) <= 254),
  recipient_phone     text check (char_length(recipient_phone) <= 30),
  notes               text check (char_length(notes) <= 1000),
  issued_on           date not null default ((now() at time zone 'Europe/London')::date),
  expires_on          date,                          -- valid to the end of this UK date; null = no expiry
  status              text not null default 'active' check (status in ('active', 'cancelled')),
  cancelled_at        timestamptz,
  cancel_reason       text check (char_length(cancel_reason) <= 500),
  source              text not null check (source in ('physical', 'dashboard', 'online', 'migrated')),
  legacy_gift_card_id uuid unique,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint vouchers_kind_shape check (
       (kind = 'money'   and amount_pence is not null and remaining_pence is not null and remaining_pence <= amount_pence)
    or (kind = 'service' and amount_pence is null and remaining_pence is null)),
  constraint vouchers_expiry_after_issue check (expires_on is null or expires_on >= issued_on),
  constraint vouchers_cancel_shape check (
        ((status = 'cancelled') = (cancelled_at is not null))
    and (status <> 'cancelled' or char_length(btrim(coalesce(cancel_reason, ''))) > 0)),
  -- lets child tables prove their salon_id matches the voucher's salon
  constraint vouchers_id_salon unique (id, salon_id)
);
create unique index if not exists vouchers_reference_per_salon on public.vouchers (salon_id, reference_key);
create index if not exists vouchers_salon_created on public.vouchers (salon_id, created_at desc);

-- 3. Services inside a service voucher
create table if not exists public.voucher_services (
  id             uuid primary key default gen_random_uuid(),
  voucher_id     uuid not null,
  salon_id       uuid not null,
  service_id     uuid references public.services(id) on delete set null,
  service_name   text not null check (char_length(service_name) between 1 and 120),  -- kept if the service is deleted
  quantity       integer not null default 1 check (quantity between 1 and 50),
  used_quantity  integer not null default 0 check (used_quantity >= 0),
  constraint voucher_services_not_overused check (used_quantity <= quantity),
  constraint voucher_services_voucher foreign key (voucher_id, salon_id)
    references public.vouchers (id, salon_id) on delete restrict,
  constraint voucher_services_id_voucher unique (id, voucher_id)
);
create index if not exists voucher_services_voucher on public.voucher_services (voucher_id);
create index if not exists voucher_services_service on public.voucher_services (service_id);

-- 4. Redemptions: append-only history (no update/delete from anywhere but the server)
create table if not exists public.voucher_redemptions (
  id                 uuid primary key default gen_random_uuid(),
  voucher_id         uuid not null,
  salon_id           uuid not null,
  redeemed_at        timestamptz not null default now(),
  amount_pence       integer check (amount_pence > 0),
  voucher_service_id uuid,
  quantity           integer check (quantity > 0),
  expired_override   boolean not null default false,   -- owner confirmed a goodwill use after expiry
  redeemed_by        uuid,
  staff_id           uuid references public.staff(id) on delete set null,
  appointment_id     uuid references public.appointments(id) on delete set null,
  note               text check (char_length(note) <= 500),
  constraint voucher_redemptions_shape check (
       (amount_pence is not null and voucher_service_id is null and quantity is null)
    or (amount_pence is null and voucher_service_id is not null and quantity is not null)),
  constraint voucher_redemptions_voucher foreign key (voucher_id, salon_id)
    references public.vouchers (id, salon_id) on delete restrict,
  constraint voucher_redemptions_service foreign key (voucher_service_id, voucher_id)
    references public.voucher_services (id, voucher_id) on delete restrict,
  constraint voucher_redemptions_id_voucher unique (id, voucher_id)
);
create index if not exists voucher_redemptions_voucher on public.voucher_redemptions (voucher_id, redeemed_at desc);
create index if not exists voucher_redemptions_salon on public.voucher_redemptions (salon_id, redeemed_at desc);
create index if not exists voucher_redemptions_appointment on public.voucher_redemptions (appointment_id);
create index if not exists voucher_redemptions_staff on public.voucher_redemptions (staff_id);

-- 5. Holds: a voucher applied to a booking, not yet deducted.
--    Available balance = remaining − active holds. A hold becomes a redemption
--    when the owner confirms or the booking is completed; released if cancelled.
create table if not exists public.voucher_holds (
  id                 uuid primary key default gen_random_uuid(),
  voucher_id         uuid not null,
  salon_id           uuid not null,
  appointment_id     uuid not null references public.appointments(id) on delete cascade,
  amount_pence       integer check (amount_pence > 0),
  voucher_service_id uuid,
  quantity           integer check (quantity > 0),
  status             text not null default 'held' check (status in ('held', 'redeemed', 'released')),
  redemption_id      uuid,
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  constraint voucher_holds_shape check (
       (amount_pence is not null and voucher_service_id is null and quantity is null)
    or (amount_pence is null and voucher_service_id is not null and quantity is not null)),
  constraint voucher_holds_resolved check ((status = 'held') = (resolved_at is null)),
  constraint voucher_holds_redeemed_link check ((status = 'redeemed') = (redemption_id is not null)),
  constraint voucher_holds_voucher foreign key (voucher_id, salon_id)
    references public.vouchers (id, salon_id) on delete restrict,
  constraint voucher_holds_service foreign key (voucher_service_id, voucher_id)
    references public.voucher_services (id, voucher_id) on delete restrict,
  constraint voucher_holds_redemption foreign key (redemption_id, voucher_id)
    references public.voucher_redemptions (id, voucher_id) on delete restrict
);
create unique index if not exists voucher_holds_one_per_booking on public.voucher_holds (appointment_id) where status = 'held';
create index if not exists voucher_holds_active on public.voucher_holds (voucher_id) where status = 'held';
create index if not exists voucher_holds_appointment on public.voucher_holds (appointment_id);
create index if not exists voucher_holds_salon on public.voucher_holds (salon_id, created_at desc);

-- 6. Access: owners READ their own salon's rows; no browser writes; anon nothing.
alter table public.vouchers            enable row level security;
alter table public.voucher_services    enable row level security;
alter table public.voucher_redemptions enable row level security;
alter table public.voucher_holds       enable row level security;

-- Supabase grants ALL on new tables to anon/authenticated by default — take it back.
revoke all on public.vouchers, public.voucher_services, public.voucher_redemptions, public.voucher_holds
  from anon, authenticated;
grant select on public.vouchers, public.voucher_services, public.voucher_redemptions, public.voucher_holds
  to authenticated;
grant all on public.vouchers, public.voucher_services, public.voucher_redemptions, public.voucher_holds
  to service_role;

drop policy if exists "Owner reads own vouchers" on public.vouchers;
create policy "Owner reads own vouchers" on public.vouchers for select to authenticated
  using (salon_id in (select id from public.salons where owner_id = auth.uid()));

drop policy if exists "Owner reads own voucher services" on public.voucher_services;
create policy "Owner reads own voucher services" on public.voucher_services for select to authenticated
  using (salon_id in (select id from public.salons where owner_id = auth.uid()));

drop policy if exists "Owner reads own voucher redemptions" on public.voucher_redemptions;
create policy "Owner reads own voucher redemptions" on public.voucher_redemptions for select to authenticated
  using (salon_id in (select id from public.salons where owner_id = auth.uid()));

drop policy if exists "Owner reads own voucher holds" on public.voucher_holds;
create policy "Owner reads own voucher holds" on public.voucher_holds for select to authenticated
  using (salon_id in (select id from public.salons where owner_id = auth.uid()));

-- 7. Copy old gift cards into vouchers. gift_cards is not changed. Re-runnable:
--    a card already copied (legacy_gift_card_id) or whose code is already used
--    in that salon (any case) is skipped. Old cards keep "no expiry"; a card
--    marked redeemed is copied with a £0 balance.
insert into public.vouchers
  (salon_id, kind, reference, amount_pence, remaining_pence, recipient_name, recipient_email,
   issued_on, expires_on, status, source, legacy_gift_card_id, created_at)
select gc.salon_id, 'money', btrim(gc.code),
       round(gc.amount * 100)::int,
       case when coalesce(gc.is_redeemed, false) then 0 else round(gc.remaining * 100)::int end,
       nullif(left(btrim(coalesce(gc.recipient_name, '')), 100), ''),
       nullif(left(btrim(coalesce(gc.recipient_email, '')), 254), ''),
       (coalesce(gc.created_at, now()) at time zone 'Europe/London')::date,
       null, 'active', 'migrated', gc.id,
       coalesce(gc.created_at, now())
from public.gift_cards gc
where gc.salon_id is not null
  and gc.amount > 0 and gc.amount <= 5000
  and gc.remaining >= 0 and gc.remaining <= gc.amount
  and char_length(btrim(gc.code)) between 3 and 40
order by gc.created_at nulls last, gc.id
on conflict do nothing;

commit;

-- ── 3. Result: copied + not_copied = gift_cards_total ───────────────────────
select (select count(*) from public.gift_cards)                          as gift_cards_total,
       (select count(*) from public.vouchers where source = 'migrated')  as copied,
       (select count(*) from public.gift_cards gc
         where not exists (select 1 from public.vouchers v
                           where v.legacy_gift_card_id = gc.id))         as not_copied;
