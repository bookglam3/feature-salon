-- Simplified local stand-in for the parts of the live Supabase database that
-- create_booking_with_services touches: the anon/authenticated/service_role
-- roles, salons (+ the public_salons view the booking page reads), services,
-- staff, appointments and appointment_services (RLS on, no public insert
-- policies — as after 2026-11-05), and check_slot_available (same capacity rule
-- as the function's inline check). Used only by
-- scripts/db-tests/booking-payment-db-test.mjs on a throwaway local Postgres —
-- never run this against Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;

create table public.salons (
  id uuid primary key default gen_random_uuid(), slug text unique, name text,
  payment_methods jsonb, stripe_account_id text, charges_enabled boolean default false);
create view public.public_salons as select id, slug, name, payment_methods from public.salons;
create table public.services (
  id uuid primary key default gen_random_uuid(), salon_id uuid references public.salons(id) on delete cascade,
  name text, price numeric(10,2), duration_minutes int, price_is_from boolean default false);
create table public.staff (
  id uuid primary key default gen_random_uuid(), salon_id uuid references public.salons(id) on delete cascade,
  name text, active boolean default true);
create table public.appointments (
  id uuid primary key, review_token uuid, salon_id uuid references public.salons(id) on delete cascade,
  client_name text, client_email text, client_phone text, service_id uuid, staff_id uuid,
  date_time timestamptz, end_time timestamptz, status text, payment_status text, payment_method text,
  payment_intent_id text, notes text, created_at timestamptz default now());
create table public.appointment_services (
  id uuid primary key default gen_random_uuid(), appointment_id uuid references public.appointments(id) on delete cascade,
  service_id uuid, name text, price numeric(10,2), duration_minutes int, price_is_from boolean default false, sort_order int);

alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;

create function public.check_slot_available(p_salon_id uuid, p_date_time timestamptz, p_staff_id uuid, p_duration_minutes int)
returns boolean language plpgsql stable security definer set search_path to 'public' as $f$
declare
  v_end timestamptz := p_date_time + (p_duration_minutes || ' minutes')::interval;
  v_staff int := (select count(*) from staff where salon_id = p_salon_id and active = true);
  v_other int; v_null int;
begin
  if p_staff_id is null then
    return (select count(*) from appointments where salon_id = p_salon_id and date_time < v_end
            and coalesce(end_time, date_time + interval '30 minutes') > p_date_time and status != 'cancelled') < v_staff;
  end if;
  if exists (select 1 from appointments where salon_id = p_salon_id and staff_id = p_staff_id and date_time < v_end
             and coalesce(end_time, date_time + interval '30 minutes') > p_date_time and status != 'cancelled') then
    return false;
  end if;
  select count(*) into v_other from appointments where salon_id = p_salon_id and staff_id is not null and staff_id != p_staff_id
    and date_time < v_end and coalesce(end_time, date_time + interval '30 minutes') > p_date_time and status != 'cancelled';
  select count(*) into v_null from appointments where salon_id = p_salon_id and staff_id is null
    and date_time < v_end and coalesce(end_time, date_time + interval '30 minutes') > p_date_time and status != 'cancelled';
  return (v_staff - v_other) > v_null;
end; $f$;

-- Supabase-like grants: every role can use every table; RLS does the rest
grant all on all tables in schema public to anon, authenticated, service_role;

-- the test salon the self-undoing test file uses
insert into public.salons (id, slug, name, payment_methods, stripe_account_id, charges_enabled) values
  ('11111111-1111-1111-1111-111111111111', 'test-salon', 'Test',
   '{"full_online": true, "deposit_online": true, "pay_at_salon": true, "custom_deposit": false, "deposit_percent": 50}',
   'acct_real_test', true);
insert into public.services (id, salon_id, name, price, duration_minutes) values
  ('11111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cut', 25, 45);
insert into public.staff (salon_id, name) values ('11111111-1111-1111-1111-111111111111', 'Sam');
