-- 2026-10-10 — Gift vouchers, step 2: owner dashboard functions
--
-- Adds seven functions. Only the server can call them (execute is granted to
-- service_role and nobody else); the API checks the signed-in user owns the
-- salon and passes its id in, and every function only touches that salon.
--   create_voucher          add a money or service voucher
--   redeem_voucher_amount   take money off a money voucher (partial allowed)
--   redeem_voucher_service  mark services on a service voucher as used
--   cancel_voucher          cancel, with a required reason
--   search_vouchers         find by reference or buyer/recipient name (read-only)
--   voucher_stats           outstanding balance, amount on hold, … (read-only)
--   get_voucher             one voucher with services, history and holds (read-only)
-- plus vouchers.cancelled_by, and re-runs the step 1 copy of gift_cards (picks
-- up any card created since; gift_cards itself is still not changed).
--
-- Safety rules every write follows:
--   • locks the voucher row first (select … for update), so two redemptions at
--     the same moment run one after the other and the second sees the first;
--   • available = remaining − active holds (holds arrive in step 5);
--   • never below £0 and never more services than were bought;
--   • errors are raised with a fixed name as the message (e.g.
--     insufficient_balance) and any number in DETAIL; the API turns them into
--     clear sentences.
--
-- Requires step 1. Run by hand in the Supabase SQL editor: the pre-check first,
-- then this whole file (one transaction, safe to re-run). Then optionally
-- sql/2026-10-10-gift-vouchers-step2-test.sql (self-undoing).
-- Rollback: sql/2026-10-10-gift-vouchers-step2-rollback.sql
--
-- ── 1. Read-only pre-check (run first; nothing changes) ─────────────────────
-- Expect: step1_ran = true, services_cols = 4, appointment_cols = 5.
--
-- select to_regclass('public.vouchers') is not null as step1_ran,
--        (select count(*) from information_schema.columns
--          where table_schema = 'public' and table_name = 'services'
--            and column_name in ('id', 'salon_id', 'name', 'archived_at'))                      as services_cols,
--        (select count(*) from information_schema.columns
--          where table_schema = 'public' and table_name = 'appointments'
--            and column_name in ('id', 'salon_id', 'date_time', 'client_name', 'status'))        as appointment_cols;
--
-- ── 2. Migration ─────────────────────────────────────────────────────────────

begin;

-- Who cancelled (the reason and time are already on the row)
alter table public.vouchers add column if not exists cancelled_by uuid;

-- ── create_voucher ───────────────────────────────────────────────────────────
-- p_services (service vouchers only): [{"service_id": "<uuid>", "quantity": 1}, …]
-- Returns {"id": …, "reference": …}.
create or replace function public.create_voucher(
  p_salon_id        uuid,
  p_kind            text,
  p_reference       text,
  p_source          text,
  p_amount_pence    integer default null,
  p_services        jsonb   default null,
  p_buyer_name      text    default null,
  p_buyer_email     text    default null,
  p_buyer_phone     text    default null,
  p_recipient_name  text    default null,
  p_recipient_email text    default null,
  p_recipient_phone text    default null,
  p_notes           text    default null,
  p_expires_on      date    default null,
  p_created_by      uuid    default null
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_ref     text := btrim(coalesce(p_reference, ''));
  v_today   date := (now() at time zone 'Europe/London')::date;
  v_id      uuid;
  v_line    jsonb;
  v_sid     uuid;
  v_qty     integer;
  v_name    text;
  v_seen    uuid[] := '{}';
begin
  if p_kind is null or p_kind not in ('money', 'service') then raise exception 'invalid_kind'; end if;
  if p_source is null or p_source not in ('physical', 'dashboard') then raise exception 'invalid_source'; end if;
  if char_length(v_ref) not between 3 and 40 then raise exception 'invalid_reference'; end if;
  if p_expires_on is not null and p_expires_on < v_today then raise exception 'invalid_expiry'; end if;

  if p_kind = 'money' then
    if p_services is not null and jsonb_typeof(p_services) = 'array' and jsonb_array_length(p_services) > 0 then
      raise exception 'wrong_voucher_kind';
    end if;
    if p_amount_pence is null or p_amount_pence < 1 or p_amount_pence > 500000 then raise exception 'invalid_amount'; end if;
  else
    if p_amount_pence is not null then raise exception 'wrong_voucher_kind'; end if;
    if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0 then
      raise exception 'services_required';
    end if;
    if jsonb_array_length(p_services) > 20 then raise exception 'too_many_services'; end if;
  end if;

  begin
    insert into public.vouchers
      (salon_id, kind, reference, amount_pence, remaining_pence,
       buyer_name, buyer_email, buyer_phone, recipient_name, recipient_email, recipient_phone,
       notes, issued_on, expires_on, source, created_by)
    values
      (p_salon_id, p_kind, v_ref,
       case when p_kind = 'money' then p_amount_pence end,
       case when p_kind = 'money' then p_amount_pence end,
       nullif(btrim(p_buyer_name), ''), nullif(btrim(p_buyer_email), ''), nullif(btrim(p_buyer_phone), ''),
       nullif(btrim(p_recipient_name), ''), nullif(btrim(p_recipient_email), ''), nullif(btrim(p_recipient_phone), ''),
       nullif(btrim(p_notes), ''), v_today, p_expires_on, p_source, p_created_by)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'reference_taken';
  end;

  if p_kind = 'service' then
    for v_line in select value from jsonb_array_elements(p_services) loop
      if jsonb_typeof(v_line) <> 'object'
         or coalesce(v_line ->> 'service_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'service_not_found';
      end if;
      if coalesce(v_line ->> 'quantity', '1') !~ '^[0-9]{1,2}$' then raise exception 'invalid_quantity'; end if;
      v_sid := (v_line ->> 'service_id')::uuid;
      v_qty := coalesce((v_line ->> 'quantity')::integer, 1);
      if v_qty < 1 or v_qty > 50 then raise exception 'invalid_quantity'; end if;
      if v_sid = any(v_seen) then raise exception 'duplicate_service'; end if;
      v_seen := v_seen || v_sid;

      select coalesce(nullif(btrim(s.name), ''), 'Service') into v_name
      from public.services s
      where s.id = v_sid and s.salon_id = p_salon_id and s.archived_at is null;
      if not found then raise exception 'service_not_found'; end if;

      insert into public.voucher_services (voucher_id, salon_id, service_id, service_name, quantity)
      values (v_id, p_salon_id, v_sid, left(v_name, 120), v_qty);
    end loop;
  end if;

  return jsonb_build_object('id', v_id, 'reference', v_ref);
end;
$$;

-- ── redeem_voucher_amount ────────────────────────────────────────────────────
-- p_expired_override: the owner confirmed a goodwill use of an expired voucher.
-- Returns {"redemption_id", "remaining_pence", "available_pence", "expired_override"}.
create or replace function public.redeem_voucher_amount(
  p_salon_id         uuid,
  p_voucher_id       uuid,
  p_amount_pence     integer,
  p_redeemed_by      uuid    default null,
  p_note             text    default null,
  p_expired_override boolean default false
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v         public.vouchers%rowtype;
  v_today   date := (now() at time zone 'Europe/London')::date;
  v_expired boolean;
  v_held    integer;
  v_avail   integer;
  v_red_id  uuid;
begin
  select * into v from public.vouchers
  where id = p_voucher_id and salon_id = p_salon_id
  for update;
  if not found then raise exception 'voucher_not_found'; end if;
  if v.status = 'cancelled' then raise exception 'voucher_cancelled'; end if;
  if v.kind <> 'money' then raise exception 'wrong_voucher_kind'; end if;

  v_expired := v.expires_on is not null and v.expires_on < v_today;
  if v_expired and not coalesce(p_expired_override, false) then
    raise exception 'voucher_expired' using detail = v.expires_on::text;
  end if;

  if p_amount_pence is null or p_amount_pence < 1 or p_amount_pence > 500000 then raise exception 'invalid_amount'; end if;

  select coalesce(sum(h.amount_pence), 0)::integer into v_held
  from public.voucher_holds h
  where h.voucher_id = v.id and h.status = 'held' and h.amount_pence is not null;
  v_avail := v.remaining_pence - v_held;
  if p_amount_pence > v_avail then
    raise exception 'insufficient_balance' using detail = greatest(v_avail, 0)::text;
  end if;

  insert into public.voucher_redemptions (voucher_id, salon_id, amount_pence, expired_override, redeemed_by, note)
  values (v.id, v.salon_id, p_amount_pence, v_expired, p_redeemed_by, nullif(btrim(p_note), ''))
  returning id into v_red_id;

  update public.vouchers
  set remaining_pence = remaining_pence - p_amount_pence, updated_at = now()
  where id = v.id;

  return jsonb_build_object(
    'redemption_id', v_red_id,
    'remaining_pence', v.remaining_pence - p_amount_pence,
    'available_pence', v_avail - p_amount_pence,
    'expired_override', v_expired);
end;
$$;

-- ── redeem_voucher_service ───────────────────────────────────────────────────
-- Returns {"redemption_id", "used_quantity", "available_quantity", "expired_override"}.
create or replace function public.redeem_voucher_service(
  p_salon_id           uuid,
  p_voucher_id         uuid,
  p_voucher_service_id uuid,
  p_quantity           integer default 1,
  p_redeemed_by        uuid    default null,
  p_note               text    default null,
  p_expired_override   boolean default false
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v         public.vouchers%rowtype;
  vs        public.voucher_services%rowtype;
  v_today   date := (now() at time zone 'Europe/London')::date;
  v_expired boolean;
  v_held    integer;
  v_avail   integer;
  v_red_id  uuid;
begin
  select * into v from public.vouchers
  where id = p_voucher_id and salon_id = p_salon_id
  for update;
  if not found then raise exception 'voucher_not_found'; end if;
  if v.status = 'cancelled' then raise exception 'voucher_cancelled'; end if;
  if v.kind <> 'service' then raise exception 'wrong_voucher_kind'; end if;

  v_expired := v.expires_on is not null and v.expires_on < v_today;
  if v_expired and not coalesce(p_expired_override, false) then
    raise exception 'voucher_expired' using detail = v.expires_on::text;
  end if;

  select * into vs from public.voucher_services
  where id = p_voucher_service_id and voucher_id = v.id
  for update;
  if not found then raise exception 'service_not_on_voucher'; end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then raise exception 'invalid_quantity'; end if;

  select coalesce(sum(h.quantity), 0)::integer into v_held
  from public.voucher_holds h
  where h.voucher_service_id = vs.id and h.status = 'held';
  v_avail := vs.quantity - vs.used_quantity - v_held;
  if p_quantity > v_avail then
    raise exception 'service_used_up' using detail = greatest(v_avail, 0)::text;
  end if;

  insert into public.voucher_redemptions (voucher_id, salon_id, voucher_service_id, quantity, expired_override, redeemed_by, note)
  values (v.id, v.salon_id, vs.id, p_quantity, v_expired, p_redeemed_by, nullif(btrim(p_note), ''))
  returning id into v_red_id;

  update public.voucher_services set used_quantity = used_quantity + p_quantity where id = vs.id;
  update public.vouchers set updated_at = now() where id = v.id;

  return jsonb_build_object(
    'redemption_id', v_red_id,
    'used_quantity', vs.used_quantity + p_quantity,
    'available_quantity', v_avail - p_quantity,
    'expired_override', v_expired);
end;
$$;

-- ── cancel_voucher ───────────────────────────────────────────────────────────
create or replace function public.cancel_voucher(
  p_salon_id     uuid,
  p_voucher_id   uuid,
  p_reason       text,
  p_cancelled_by uuid default null
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v        public.vouchers%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v from public.vouchers
  where id = p_voucher_id and salon_id = p_salon_id
  for update;
  if not found then raise exception 'voucher_not_found'; end if;
  if v.status = 'cancelled' then raise exception 'already_cancelled'; end if;
  if char_length(v_reason) < 3 then raise exception 'reason_required'; end if;
  if char_length(v_reason) > 500 then raise exception 'reason_too_long'; end if;
  if exists (select 1 from public.voucher_holds h where h.voucher_id = v.id and h.status = 'held') then
    raise exception 'voucher_has_holds';
  end if;

  update public.vouchers
  set status = 'cancelled', cancelled_at = now(), cancel_reason = v_reason,
      cancelled_by = p_cancelled_by, updated_at = now()
  where id = v.id;

  return jsonb_build_object('id', v.id, 'status', 'cancelled');
end;
$$;

-- ── search_vouchers (read-only) ──────────────────────────────────────────────
-- Case-insensitive "contains" on reference, buyer name or recipient name.
-- An exact reference match comes first, then newest first. Empty search = newest.
create or replace function public.search_vouchers(
  p_salon_id uuid,
  p_query    text    default null,
  p_limit    integer default 50
) returns jsonb
language sql
stable
set search_path = ''
as $$
  with term as (
    select nullif(lower(btrim(coalesce(p_query, ''))), '') as t
  ), pat as (
    select t, '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%' as p from term
  ), today as (
    select (now() at time zone 'Europe/London')::date as d
  ), hits as (
    select v.*, pat.t
    from public.vouchers v, pat
    where v.salon_id = p_salon_id
      and (pat.t is null
           or v.reference_key like pat.p
           or lower(coalesce(v.buyer_name, '')) like pat.p
           or lower(coalesce(v.recipient_name, '')) like pat.p)
    order by (pat.t is not null and v.reference_key = pat.t) desc, v.created_at desc, v.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'kind', h.kind, 'reference', h.reference, 'status', h.status, 'source', h.source,
    'amount_pence', h.amount_pence, 'remaining_pence', h.remaining_pence,
    'held_pence', (select coalesce(sum(x.amount_pence), 0) from public.voucher_holds x
                    where x.voucher_id = h.id and x.status = 'held'),
    'services_total', (select coalesce(sum(s.quantity), 0) from public.voucher_services s where s.voucher_id = h.id),
    'services_used',  (select coalesce(sum(s.used_quantity), 0) from public.voucher_services s where s.voucher_id = h.id),
    'services_held',  (select coalesce(sum(x.quantity), 0) from public.voucher_holds x
                        where x.voucher_id = h.id and x.status = 'held' and x.quantity is not null),
    'buyer_name', h.buyer_name, 'recipient_name', h.recipient_name,
    'issued_on', h.issued_on, 'expires_on', h.expires_on,
    'is_expired', (h.expires_on is not null and h.expires_on < today.d),
    'created_at', h.created_at
  ) order by (h.t is not null and h.reference_key = h.t) desc, h.created_at desc, h.id), '[]'::jsonb)
  from hits h, today;
$$;

-- ── voucher_stats (read-only) ────────────────────────────────────────────────
-- outstanding_pence: money still owed on active, unexpired vouchers (includes
-- anything on hold); held_pence: the part applied to upcoming bookings.
create or replace function public.voucher_stats(p_salon_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Europe/London')::date as d
  ), live as (
    select v.* from public.vouchers v, today
    where v.salon_id = p_salon_id and v.status = 'active'
      and (v.expires_on is null or v.expires_on >= today.d)
  )
  select jsonb_build_object(
    'outstanding_pence', (select coalesce(sum(remaining_pence), 0) from live where kind = 'money'),
    'held_pence', (select coalesce(sum(h.amount_pence), 0) from public.voucher_holds h
                    join live on live.id = h.voucher_id where h.status = 'held'),
    'unused_services', (select coalesce(sum(s.quantity - s.used_quantity), 0) from public.voucher_services s
                         join live on live.id = s.voucher_id),
    'active_count', (select count(*) from live
                      where (kind = 'money' and remaining_pence > 0)
                         or (kind = 'service' and exists (select 1 from public.voucher_services s
                                                          where s.voucher_id = live.id and s.used_quantity < s.quantity))),
    'expired_balance_pence', (select coalesce(sum(v.remaining_pence), 0) from public.vouchers v, today
                               where v.salon_id = p_salon_id and v.status = 'active' and v.kind = 'money'
                                 and v.expires_on < today.d)
  );
$$;

-- ── get_voucher (read-only) ──────────────────────────────────────────────────
-- null when the voucher doesn't exist in this salon.
create or replace function public.get_voucher(p_salon_id uuid, p_voucher_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Europe/London')::date as d
  )
  select jsonb_build_object(
    'voucher', (to_jsonb(v) - 'reference_key' - 'created_by' - 'cancelled_by') || jsonb_build_object(
      'is_expired', (v.expires_on is not null and v.expires_on < today.d),
      'held_pence', (select coalesce(sum(h.amount_pence), 0) from public.voucher_holds h
                      where h.voucher_id = v.id and h.status = 'held'),
      'available_pence', case when v.kind = 'money' then v.remaining_pence -
                           (select coalesce(sum(h.amount_pence), 0) from public.voucher_holds h
                             where h.voucher_id = v.id and h.status = 'held') end),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'service_id', s.service_id, 'service_name', s.service_name,
               'quantity', s.quantity, 'used_quantity', s.used_quantity,
               'held_quantity', (select coalesce(sum(h.quantity), 0) from public.voucher_holds h
                                  where h.voucher_service_id = s.id and h.status = 'held'))
             order by s.service_name, s.id)
      from public.voucher_services s where s.voucher_id = v.id), '[]'::jsonb),
    'redemptions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'redeemed_at', r.redeemed_at, 'amount_pence', r.amount_pence,
               'voucher_service_id', r.voucher_service_id, 'service_name', s.service_name,
               'quantity', r.quantity, 'expired_override', r.expired_override,
               'appointment_id', r.appointment_id, 'note', r.note)
             order by r.redeemed_at desc, r.id)
      from public.voucher_redemptions r
      left join public.voucher_services s on s.id = r.voucher_service_id
      where r.voucher_id = v.id), '[]'::jsonb),
    'holds', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', h.id, 'appointment_id', h.appointment_id, 'amount_pence', h.amount_pence,
               'voucher_service_id', h.voucher_service_id, 'service_name', s.service_name,
               'quantity', h.quantity, 'created_at', h.created_at,
               'appointment_at', a.date_time, 'client_name', a.client_name, 'appointment_status', a.status)
             order by a.date_time nulls last, h.created_at)
      from public.voucher_holds h
      left join public.appointments a on a.id = h.appointment_id
      left join public.voucher_services s on s.id = h.voucher_service_id
      where h.voucher_id = v.id and h.status = 'held'), '[]'::jsonb)
  )
  from public.vouchers v, today
  where v.id = p_voucher_id and v.salon_id = p_salon_id;
$$;

-- ── Only the server may call these ───────────────────────────────────────────
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('create_voucher', 'redeem_voucher_amount', 'redeem_voucher_service', 'cancel_voucher',
                        'search_vouchers', 'voucher_stats', 'get_voucher')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ── Re-run the step 1 copy of old gift cards (same rules; re-runnable) ───────
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

-- Let Supabase's API see the new functions straight away
notify pgrst, 'reload schema';

commit;

-- ── 3. Result ────────────────────────────────────────────────────────────────
-- functions = 7; not_copied = old cards left out (same reasons as step 1's pre-check C).
select (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname in ('create_voucher', 'redeem_voucher_amount', 'redeem_voucher_service', 'cancel_voucher',
                           'search_vouchers', 'voucher_stats', 'get_voucher'))  as functions,
       (select count(*) from public.gift_cards)                                 as gift_cards_total,
       (select count(*) from public.vouchers where source = 'migrated')         as copied,
       (select count(*) from public.gift_cards gc
         where not exists (select 1 from public.vouchers v
                           where v.legacy_gift_card_id = gc.id))                as not_copied;
