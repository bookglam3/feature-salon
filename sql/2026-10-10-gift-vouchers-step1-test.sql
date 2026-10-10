-- 2026-10-10 — Gift vouchers, step 1: SELF-UNDOING TESTS
--
-- Checks the step 1 tables, rules and browser access on ONE test salon, then
-- undoes everything. Safe to run on the live database because:
--   • the whole file is a single statement that ALWAYS ends in an error, on
--     purpose — Postgres then rolls back every row it created or changed;
--   • it never commits, and it only writes rows for the test salon.
--
-- How to run:
--   1. Run sql/2026-10-10-gift-vouchers-step1.sql first.
--   2. Put your test salon's booking-link slug on the line marked ▶ below.
--   3. Run this whole file in the Supabase SQL editor.
--   4. The error message IS the result, e.g.
--        VOUCHER TESTS: 54 passed, 0 failed, 0 skipped. Nothing was saved.
--      Failures are listed underneath. Send me the whole message.
--   Holds tests need at least one booking on the test salon; without one
--   they are reported as skipped.

do $$
declare
  v_slug   constant text := 'your-test-salon-slug';   -- ▶ your TEST salon's slug
  v_salon  uuid;
  v_owner  uuid;
  v_other  constant uuid := gen_random_uuid();          -- a signed-in user who owns nothing here
  v_ref    constant text := 'VT-' || upper(substr(md5(random()::text), 1, 8));
  v_appt   uuid;
  v_money  uuid;
  v_svc    uuid;
  v_vs     uuid;
  v_red    uuid;
  v_hold   uuid;
  v_gc     bigint;
  v_holds  text;   -- 'count' / 'error', or 'skip' when the salon has no booking
  v_got    text;
  v_pass   int := 0;
  v_skip   int := 0;
  v_fail   text[] := '{}';
  r        record;
begin
  select id, owner_id into v_salon, v_owner from public.salons where slug = v_slug;
  if v_salon is null then
    raise exception 'VOUCHER TESTS: no salon has the slug "%". Put your test salon''s slug on the ▶ line. Nothing was saved.', v_slug;
  end if;
  if v_owner is null then
    raise exception 'VOUCHER TESTS: salon "%" has no owner_id, so the owner checks cannot run. Nothing was saved.', v_slug;
  end if;

  -- Read-only lookups
  select id into v_appt from public.appointments where salon_id = v_salon order by id limit 1;
  select count(*) into v_gc from public.gift_cards where salon_id = v_salon;
  v_holds := case when v_appt is null then 'skip' else 'error' end;

  -- Test data (undone at the end with everything else)
  insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source, recipient_name)
    values (v_salon, 'money', v_ref, 5000, 5000, 'dashboard', 'Voucher Test') returning id into v_money;
  insert into public.vouchers (salon_id, kind, reference, source)
    values (v_salon, 'service', v_ref || '-S', 'physical') returning id into v_svc;
  insert into public.voucher_services (voucher_id, salon_id, service_name, quantity)
    values (v_svc, v_salon, 'Voucher test service', 2) returning id into v_vs;
  insert into public.voucher_redemptions (voucher_id, salon_id, amount_pence, note)
    values (v_money, v_salon, 1000, 'Voucher test') returning id into v_red;
  if v_appt is not null then
    insert into public.voucher_holds (voucher_id, salon_id, appointment_id, amount_pence)
      values (v_money, v_salon, v_appt, 500) returning id into v_hold;
  end if;

  for r in
    select * from (values
      -- (label, who: admin/owner/other/anon, kind: count/error, expected count or SQLSTATE, sql)

      -- Schema and rules
      ('T01 switch column exists, not null, default off', 'admin', 'count', '1',
       $q$select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'salons'
          and column_name = 'gift_vouchers_enabled' and is_nullable = 'NO' and column_default = 'false'$q$),
      ('T02 reference is matched ignoring case', 'admin', 'count', '1',
       format('select count(*) from public.vouchers where id = %L and reference_key = %L', v_money, lower(v_ref))),
      ('T03 same reference in another case, same salon -> refused', 'admin', 'error', '23505',
       format('insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source) values (%L, %L, %L, 1000, 1000, %L)',
              v_salon, 'money', lower(v_ref), 'dashboard')),
      ('T04 £0 voucher -> refused', 'admin', 'error', '23514',
       format('insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source) values (%L, %L, %L, 0, 0, %L)',
              v_salon, 'money', v_ref || '-A', 'dashboard')),
      ('T05 voucher over £5,000 -> refused', 'admin', 'error', '23514',
       format('insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source) values (%L, %L, %L, 500001, 500001, %L)',
              v_salon, 'money', v_ref || '-B', 'dashboard')),
      ('T06 balance above the amount -> refused', 'admin', 'error', '23514',
       format('update public.vouchers set remaining_pence = 5001 where id = %L', v_money)),
      ('T07 balance below £0 -> refused', 'admin', 'error', '23514',
       format('update public.vouchers set remaining_pence = -1 where id = %L', v_money)),
      ('T08 money voucher without an amount -> refused', 'admin', 'error', '23514',
       format('insert into public.vouchers (salon_id, kind, reference, source) values (%L, %L, %L, %L)',
              v_salon, 'money', v_ref || '-C', 'dashboard')),
      ('T09 service voucher with an amount -> refused', 'admin', 'error', '23514',
       format('insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source) values (%L, %L, %L, 1000, 1000, %L)',
              v_salon, 'service', v_ref || '-D', 'physical')),
      ('T10 expiry before the issue date -> refused', 'admin', 'error', '23514',
       format('update public.vouchers set expires_on = issued_on - 1 where id = %L', v_money)),
      ('T11 reference with spaces around it -> refused', 'admin', 'error', '23514',
       format('insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source) values (%L, %L, %L, 1000, 1000, %L)',
              v_salon, 'money', ' ' || v_ref || '-E ', 'dashboard')),
      ('T12 reference shorter than 3 characters -> refused', 'admin', 'error', '23514',
       format('insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source) values (%L, %L, %L, 1000, 1000, %L)',
              v_salon, 'money', 'AB', 'dashboard')),
      ('T13 unknown kind -> refused', 'admin', 'error', '23514',
       format('update public.vouchers set kind = %L where id = %L', 'points', v_money)),
      ('T14 unknown source -> refused', 'admin', 'error', '23514',
       format('update public.vouchers set source = %L where id = %L', 'website', v_money)),
      ('T15 cancelled without a cancel time -> refused', 'admin', 'error', '23514',
       format('update public.vouchers set status = %L, cancel_reason = %L where id = %L', 'cancelled', 'Test', v_money)),
      ('T16 cancelled without a reason -> refused', 'admin', 'error', '23514',
       format('update public.vouchers set status = %L, cancelled_at = now() where id = %L', 'cancelled', v_money)),
      ('T17 cancelled with time and reason -> allowed', 'admin', 'count', '1',
       format('with u as (update public.vouchers set status = %L, cancelled_at = now(), cancel_reason = %L where id = %L returning 1) select count(*) from u',
              'cancelled', 'Test', v_money)),
      ('T18 service used more times than bought -> refused', 'admin', 'error', '23514',
       format('update public.voucher_services set used_quantity = 3 where id = %L', v_vs)),
      ('T19 voucher service under the wrong salon -> refused', 'admin', 'error', '23503',
       format('insert into public.voucher_services (voucher_id, salon_id, service_name) values (%L, %L, %L)', v_svc, gen_random_uuid(), 'X')),
      ('T20 redemption of money AND a service at once -> refused', 'admin', 'error', '23514',
       format('insert into public.voucher_redemptions (voucher_id, salon_id, amount_pence, voucher_service_id, quantity) values (%L, %L, 100, %L, 1)',
              v_svc, v_salon, v_vs)),
      ('T21 redemption of nothing -> refused', 'admin', 'error', '23514',
       format('insert into public.voucher_redemptions (voucher_id, salon_id) values (%L, %L)', v_money, v_salon)),
      ('T22 redemption of £0 -> refused', 'admin', 'error', '23514',
       format('insert into public.voucher_redemptions (voucher_id, salon_id, amount_pence) values (%L, %L, 0)', v_money, v_salon)),
      ('T23 redemption using another voucher''s service -> refused', 'admin', 'error', '23503',
       format('insert into public.voucher_redemptions (voucher_id, salon_id, voucher_service_id, quantity) values (%L, %L, %L, 1)',
              v_money, v_salon, v_vs)),
      ('T24 redemption under the wrong salon -> refused', 'admin', 'error', '23503',
       format('insert into public.voucher_redemptions (voucher_id, salon_id, amount_pence) values (%L, %L, 100)', v_money, gen_random_uuid())),
      -- restrict_violation (23001) or foreign_key_violation (23503), depending on the Postgres version
      ('T25 deleting a voucher that has history -> refused', 'admin', 'error', '23001/23503',
       format('delete from public.vouchers where id = %L', v_money)),

      -- Holds (need one booking on the test salon)
      ('T26 second active hold on one booking -> refused', 'admin', v_holds, '23505',
       format('insert into public.voucher_holds (voucher_id, salon_id, appointment_id, voucher_service_id, quantity) values (%L, %L, %L, %L, 1)',
              v_svc, v_salon, v_appt, v_vs)),
      ('T27 hold marked redeemed with no redemption -> refused', 'admin', v_holds, '23514',
       format('update public.voucher_holds set status = %L, resolved_at = now() where id = %L', 'redeemed', v_hold)),
      ('T28 hold released without a time -> refused', 'admin', v_holds, '23514',
       format('update public.voucher_holds set status = %L where id = %L', 'released', v_hold)),
      ('T29 hold redeemed with its redemption -> allowed', 'admin', replace(v_holds, 'error', 'count'), '1',
       format('with u as (update public.voucher_holds set status = %L, resolved_at = now(), redemption_id = %L where id = %L returning 1) select count(*) from u',
              'redeemed', v_red, v_hold)),
      ('T30 hold linked to another voucher''s redemption -> refused', 'admin', v_holds, '23503',
       format('insert into public.voucher_holds (voucher_id, salon_id, appointment_id, voucher_service_id, quantity, status, resolved_at, redemption_id) values (%L, %L, %L, %L, 1, %L, now(), %L)',
              v_svc, v_salon, v_appt, v_vs, 'redeemed', v_red)),

      -- Signed in as the salon's owner (the browser)
      ('T31 owner sees own voucher', 'owner', 'count', '1',
       format('select count(*) from public.vouchers where id = %L', v_money)),
      ('T32 owner sees own voucher services', 'owner', 'count', '1',
       format('select count(*) from public.voucher_services where id = %L', v_vs)),
      ('T33 owner sees own redemptions', 'owner', 'count', '1',
       format('select count(*) from public.voucher_redemptions where id = %L', v_red)),
      ('T34 owner sees own holds', 'owner', replace(v_holds, 'error', 'count'), '1',
       format('select count(*) from public.voucher_holds where id = %L', v_hold)),
      ('T35 owner cannot add a voucher from the browser', 'owner', 'error', '42501',
       format('insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source) values (%L, %L, %L, 1000, 1000, %L)',
              v_salon, 'money', v_ref || '-F', 'dashboard')),
      ('T36 owner cannot change a balance from the browser', 'owner', 'error', '42501',
       format('update public.vouchers set remaining_pence = 4999 where id = %L', v_money)),
      ('T37 owner cannot delete a voucher from the browser', 'owner', 'error', '42501',
       format('delete from public.vouchers where id = %L', v_money)),
      ('T38 owner cannot add a redemption from the browser', 'owner', 'error', '42501',
       format('insert into public.voucher_redemptions (voucher_id, salon_id, amount_pence) values (%L, %L, 100)', v_money, v_salon)),
      ('T39 owner cannot delete history from the browser', 'owner', 'error', '42501',
       format('delete from public.voucher_redemptions where id = %L', v_red)),
      ('T40 owner cannot add a hold from the browser', 'owner', 'error', '42501',
       format('insert into public.voucher_holds (voucher_id, salon_id, appointment_id, amount_pence) values (%L, %L, %L, 100)', v_money, v_salon, v_appt)),
      ('T41 owner can switch gift vouchers on/off (Settings)', 'owner', 'count', '1',
       format('with u as (update public.salons set gift_vouchers_enabled = not gift_vouchers_enabled where id = %L returning 1) select count(*) from u', v_salon)),
      ('T42 owner still cannot change Stripe status (protected column)', 'owner', 'error', '42501',
       format('update public.salons set charges_enabled = not coalesce(charges_enabled, false) where id = %L', v_salon)),
      ('T43 owner still sees own old gift cards (unchanged)', 'owner', 'count', v_gc::text,
       format('select count(*) from public.gift_cards where salon_id = %L', v_salon)),

      -- Signed in as someone else
      ('T44 other user sees none of this salon''s vouchers', 'other', 'count', '0',
       format('select count(*) from public.vouchers where salon_id = %L', v_salon)),
      ('T45 other user sees none of its voucher services', 'other', 'count', '0',
       format('select count(*) from public.voucher_services where salon_id = %L', v_salon)),
      ('T46 other user sees none of its redemptions', 'other', 'count', '0',
       format('select count(*) from public.voucher_redemptions where salon_id = %L', v_salon)),
      ('T47 other user sees none of its holds', 'other', 'count', '0',
       format('select count(*) from public.voucher_holds where salon_id = %L', v_salon)),
      ('T48 other user cannot switch this salon''s vouchers', 'other', 'count', '0',
       format('with u as (update public.salons set gift_vouchers_enabled = not gift_vouchers_enabled where id = %L returning 1) select count(*) from u', v_salon)),

      -- Not signed in (public)
      ('T49 public cannot read vouchers', 'anon', 'error', '42501', 'select count(*) from public.vouchers'),
      ('T50 public cannot read voucher services', 'anon', 'error', '42501', 'select count(*) from public.voucher_services'),
      ('T51 public cannot read redemptions', 'anon', 'error', '42501', 'select count(*) from public.voucher_redemptions'),
      ('T52 public cannot read holds', 'anon', 'error', '42501', 'select count(*) from public.voucher_holds'),

      -- Copy of the old gift cards (whole database, read-only)
      ('T53 every valid old gift card has a voucher', 'admin', 'count', '0',
       $q$select count(*) from public.gift_cards gc
          where gc.salon_id is not null and gc.amount > 0 and gc.amount <= 5000
            and gc.remaining >= 0 and gc.remaining <= gc.amount
            and char_length(btrim(gc.code)) between 3 and 40
            and not exists (select 1 from public.vouchers v where v.legacy_gift_card_id = gc.id)
            and not exists (select 1 from public.vouchers v                     -- skipped: same code already in that salon
                            where v.salon_id = gc.salon_id and v.reference_key = lower(btrim(gc.code)))$q$),
      ('T54 copied amounts and balances match the old cards', 'admin', 'count', '0',
       $q$select count(*) from public.vouchers v join public.gift_cards gc on gc.id = v.legacy_gift_card_id
          where v.amount_pence <> round(gc.amount * 100)::int
             or v.remaining_pence <> case when coalesce(gc.is_redeemed, false) then 0 else round(gc.remaining * 100)::int end$q$)
    ) as t(label, who, kind, expected, sql)
  loop
    if r.kind = 'skip' then
      v_skip := v_skip + 1;
      continue;
    end if;
    begin
      if r.who in ('owner', 'other') then
        perform set_config('request.jwt.claim.sub', (case r.who when 'owner' then v_owner else v_other end)::text, true);
        perform set_config('request.jwt.claims',
          json_build_object('sub', case r.who when 'owner' then v_owner else v_other end, 'role', 'authenticated')::text, true);
        set local role authenticated;
      elsif r.who = 'anon' then
        perform set_config('request.jwt.claim.sub', '', true);
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        set local role anon;
      end if;

      if r.kind = 'count' then
        execute r.sql into v_got;
        if v_got is distinct from r.expected then
          v_fail := v_fail || format('%s: expected %s, got %s', r.label, r.expected, coalesce(v_got, 'nothing'));
        else
          v_pass := v_pass + 1;
        end if;
      else
        execute r.sql;
        v_fail := v_fail || format('%s: it was allowed', r.label);
      end if;
      raise exception using errcode = 'VT000';  -- undo this test (rows and role) before the next one
    exception
      when sqlstate 'VT000' then
        null;
      when others then
        if r.kind = 'error' and sqlstate = any(string_to_array(r.expected, '/')) then
          v_pass := v_pass + 1;
        else
          v_fail := v_fail || format('%s: unexpected error %s %s', r.label, sqlstate, sqlerrm);
        end if;
    end;
  end loop;

  raise exception using message = format(
    'VOUCHER TESTS: %s passed, %s failed, %s skipped%s. Nothing was saved.%s',
    v_pass, cardinality(v_fail), v_skip,
    case when v_skip > 0 then ' (holds tests need a booking on the test salon)' else '' end,
    case when cardinality(v_fail) > 0 then E'\n' || array_to_string(v_fail, E'\n') else '' end);
end $$;
