-- Simplified local stand-in for the parts of the live Supabase database the
-- gift voucher SQL touches: the anon/authenticated/service_role roles,
-- auth.uid(), salons (with its owner RLS and the salons_guard_sensitive_columns
-- trigger as it runs live), services, staff, appointments and gift_cards, plus
-- two test salons. Used only by scripts/db-tests/vouchers-db-test.mjs on a
-- throwaway local Postgres — never run this against Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create function public.is_super_admin() returns boolean language sql stable as $f$ select false $f$;

create table public.salons (
  id uuid primary key default gen_random_uuid(), owner_id uuid, owner_email text, slug text unique, name text,
  subscription_plan text, subscription_status text, stripe_account_id text, charges_enabled boolean default false,
  payouts_enabled boolean default false, payment_methods jsonb, plan text, phone text);
create table public.services (id uuid primary key default gen_random_uuid(), salon_id uuid references public.salons(id) on delete cascade, name text, price numeric(10,2), archived_at timestamptz);
create table public.staff (id uuid primary key default gen_random_uuid(), salon_id uuid references public.salons(id) on delete cascade, name text);
create table public.appointments (id uuid primary key default gen_random_uuid(), salon_id uuid references public.salons(id) on delete cascade, status text, date_time timestamptz, client_name text);
create table public.gift_cards (
  id uuid default gen_random_uuid() primary key, salon_id uuid references public.salons(id) on delete cascade,
  code text not null unique, amount numeric(10,2) not null, remaining numeric(10,2) not null,
  recipient_name text not null default '', recipient_email text default '', is_redeemed boolean default false,
  created_at timestamptz default now());

alter table public.salons enable row level security;
create policy "Owner can view own salon" on public.salons for select to authenticated using (owner_id = auth.uid());
create policy "Owner can update own salon" on public.salons for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
alter table public.gift_cards enable row level security;
create policy "Salon owner access" on public.gift_cards for all to authenticated
  using (salon_id in (select id from public.salons where owner_id = auth.uid()))
  with check (salon_id in (select id from public.salons where owner_id = auth.uid()));
alter table public.appointments enable row level security;
create policy "Owner appts" on public.appointments for all to authenticated using (salon_id in (select id from public.salons where owner_id = auth.uid()));

create or replace function public.salons_guard_sensitive_columns() returns trigger language plpgsql
set search_path = public, pg_catalog as $f$
declare
  protected constant text[] := array['plan','subscription_plan','subscription_status','subscription_id','trial_ends_at','current_period_end','stripe_customer_id',
    'stripe_account_id','charges_enabled','payouts_enabled','connect_onboarded_at','id','owner_id','owner_email','created_at','slug',
    'is_staging','is_demo_data','referred_by','address','city','postcode','latitude','longitude','phone','country'];
  v_is_admin boolean := false; v_changed text[];
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if to_regprocedure('public.is_super_admin()') is not null then
    execute 'select public.is_super_admin()' into v_is_admin;
    if coalesce(v_is_admin, false) then return new; end if;
  end if;
  select array_agg(k order by k) into v_changed from unnest(protected) as k
  where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;
  if v_changed is not null then
    raise exception 'Not allowed to change: %', array_to_string(v_changed, ', ') using errcode = '42501';
  end if;
  return new;
end; $f$;
create trigger salons_guard_sensitive_columns before update on public.salons for each row execute function public.salons_guard_sensitive_columns();

insert into public.salons (id, owner_id, slug, name, subscription_plan, subscription_status) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-salon', 'Test', 'pro', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other-salon', 'Other', 'starter', 'active');
insert into public.appointments (salon_id, status) values ('11111111-1111-1111-1111-111111111111', 'confirmed');
insert into public.gift_cards (salon_id, code, amount, remaining, recipient_name, recipient_email, is_redeemed, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'GIFT-AAA', 50, 30, 'Ann', 'ann@example.com', false, now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', 'gift-aaa', 20, 20, 'Dup', '', false, now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'GIFT-ZERO', 0, 0, 'Zero', '', false, now()),
  ('11111111-1111-1111-1111-111111111111', 'GIFT-USED', 20, 20, '', null, true, now()),
  ('11111111-1111-1111-1111-111111111111', 'AB', 10, 10, 'Short', '', false, now()),
  ('11111111-1111-1111-1111-111111111111', 'GIFT-BIG', 6000, 6000, 'Big', '', false, now()),
  ('22222222-2222-2222-2222-222222222222', ' GIFT-BBB ', 25.5, 25.5, 'Bob', 'bob@example.com', false, now());

-- Supabase-like grants: every role can use every table/function; RLS does the rest
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create policy "Public read services" on public.services for select using (true);
alter table public.services enable row level security;
insert into public.services (salon_id, name, price) values
  ('11111111-1111-1111-1111-111111111111', 'Cut & Finish', 45),
  ('11111111-1111-1111-1111-111111111111', 'Colour', 85),
  ('22222222-2222-2222-2222-222222222222', 'Other salon service', 30);
insert into public.services (salon_id, name, price, archived_at) values ('11111111-1111-1111-1111-111111111111', 'Old archived', 10, now());
update public.appointments set date_time = now() + interval '2 days', client_name = 'Dana Client';
