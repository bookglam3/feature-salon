-- 2026-10-10 — Gift vouchers, step 2: SELF-UNDOING TESTS
--
-- Calls the step 2 functions the way the API does (as service_role) on ONE
-- test salon, checks every rule, then undoes everything. Safe on the live
-- database because the whole file is a single statement that ALWAYS ends in an
-- error on purpose — Postgres then rolls back every row it created or changed.
--
-- How to run:
--   1. Run sql/2026-10-10-gift-vouchers-step2.sql first.
--   2. Put your test salon's booking-link slug on the line marked ▶ below.
--   3. Run this whole file in the Supabase SQL editor.
--   4. The error message IS the result, e.g.
--        VOUCHER STEP 2 TESTS: 66 passed, 0 failed, 0 skipped. Nothing was saved.
--      Failures are listed underneath. Send me the whole message.
--   Service-voucher tests need one active service on the test salon, and hold
--   tests need one booking; without them those tests are reported as skipped.
--
-- Not covered here: two redemptions at the very same moment needs two database
-- connections. That was tested on a local Postgres (see the PR).

do $$
declare
  v_slug   constant text := 'your-test-salon-slug';   -- ▶ your TEST salon's slug
  v_salon  uuid;
  v_owner  uuid;
  v_appt   uuid;
  v_svc    uuid;
  v_stats  jsonb;
  v_keys   constant text[] := array['salon', 'owner', 'other', 'appt', 'service', 'tag',
                                    'money', 'paper', 'svcv', 'vs', 'expired',
                                    'base_out', 'base_held', 'base_exp', 'base_unused'];
  v_key    text;
  v_sql    text;
  v_got    text;
  v_msg    text;
  v_detail text;
  v_pass   int := 0;
  v_skip   int := 0;
  v_fail   text[] := '{}';
  r        record;
begin
  select id, owner_id into v_salon, v_owner from public.salons where slug = v_slug;
  if v_salon is null then
    raise exception 'VOUCHER STEP 2 TESTS: no salon has the slug "%". Put your test salon''s slug on the ▶ line. Nothing was saved.', v_slug;
  end if;
  if to_regprocedure('public.redeem_voucher_amount(uuid,uuid,integer,uuid,text,boolean)') is null then
    raise exception 'VOUCHER STEP 2 TESTS: the step 2 functions are missing. Run sql/2026-10-10-gift-vouchers-step2.sql first. Nothing was saved.';
  end if;

  -- Read-only lookups and today's figures for this salon
  select id into v_appt from public.appointments where salon_id = v_salon order by id limit 1;
  select id into v_svc from public.services where salon_id = v_salon and archived_at is null order by id limit 1;
  v_stats := public.voucher_stats(v_salon);

  perform set_config('vt.salon', v_salon::text, true);
  perform set_config('vt.owner', coalesce(v_owner::text, ''), true);
  perform set_config('vt.other', gen_random_uuid()::text, true);       -- a salon id that isn't this one
  perform set_config('vt.appt', coalesce(v_appt::text, ''), true);
  perform set_config('vt.service', coalesce(v_svc::text, ''), true);
  perform set_config('vt.tag', 'VT2-' || upper(substr(md5(random()::text), 1, 6)), true);
  perform set_config('vt.base_out', v_stats ->> 'outstanding_pence', true);
  perform set_config('vt.base_held', v_stats ->> 'held_pence', true);
  perform set_config('vt.base_exp', v_stats ->> 'expired_balance_pence', true);
  perform set_config('vt.base_unused', v_stats ->> 'unused_services', true);

  for r in
    select * from (values
      -- (label, who: svc/auth/anon, kind: ok/value/error, expected, needs: ''/appt/service, sql)
      -- {name} is replaced with that saved value; tests run in order and build on each other.

      -- Create
      ('C01 create money voucher £50 (generated code)', 'svc', 'ok', '', '',
       $q$select set_config('vt.money', public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => {tag} || '-M',
          p_source => 'dashboard', p_amount_pence => 5000, p_buyer_name => 'Alice Example', p_buyer_email => 'alice@example.com',
          p_recipient_name => 'Bob Sample', p_expires_on => ((now() at time zone 'Europe/London')::date + 365),
          p_created_by => {owner}) ->> 'id', true)$q$),
      ('C02 create paper voucher £20 (own reference)', 'svc', 'ok', '', '',
       $q$select set_config('vt.paper', public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => {tag} || ' Paper',
          p_source => 'physical', p_amount_pence => 2000) ->> 'id', true)$q$),
      ('C03 outstanding balance went up by £70', 'svc', 'value', '7000', '',
       $q$select ((public.voucher_stats({salon}) ->> 'outstanding_pence')::bigint - {base_out}::bigint)::text$q$),
      ('C04 same reference, other case -> refused', 'svc', 'error', 'reference_taken', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => lower({tag} || ' paper'),
          p_source => 'physical', p_amount_pence => 1000)$q$),
      ('C05 same reference with spaces and capitals -> refused', 'svc', 'error', 'reference_taken', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => '  ' || upper({tag} || ' paper') || ' ',
          p_source => 'physical', p_amount_pence => 1000)$q$),
      ('C06 £0 -> refused', 'svc', 'error', 'invalid_amount', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => {tag} || '-Z', p_source => 'dashboard', p_amount_pence => 0)$q$),
      ('C07 over £5,000 -> refused', 'svc', 'error', 'invalid_amount', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => {tag} || '-Z', p_source => 'dashboard', p_amount_pence => 500001)$q$),
      ('C08 expiry in the past -> refused', 'svc', 'error', 'invalid_expiry', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => {tag} || '-Z', p_source => 'dashboard',
          p_amount_pence => 1000, p_expires_on => ((now() at time zone 'Europe/London')::date - 1))$q$),
      ('C09 reference too short -> refused', 'svc', 'error', 'invalid_reference', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => ' ab ', p_source => 'physical', p_amount_pence => 1000)$q$),
      ('C10 service voucher with no services -> refused', 'svc', 'error', 'services_required', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'service', p_reference => {tag} || '-Z', p_source => 'dashboard', p_services => '[]')$q$),
      ('C11 service from another salon -> refused', 'svc', 'error', 'service_not_found', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'service', p_reference => {tag} || '-Z', p_source => 'dashboard',
          p_services => jsonb_build_array(jsonb_build_object('service_id', gen_random_uuid(), 'quantity', 1)))$q$),
      ('C12 money voucher with services -> refused', 'svc', 'error', 'wrong_voucher_kind', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => {tag} || '-Z', p_source => 'dashboard',
          p_amount_pence => 1000, p_services => jsonb_build_array(jsonb_build_object('service_id', gen_random_uuid())))$q$),
      ('C13 unknown voucher type -> refused', 'svc', 'error', 'invalid_kind', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'points', p_reference => {tag} || '-Z', p_source => 'dashboard')$q$),
      ('C14 create service voucher (2 x a service)', 'svc', 'ok', '', 'service',
       $q$select set_config('vt.svcv', public.create_voucher(p_salon_id => {salon}, p_kind => 'service', p_reference => {tag} || '-S',
          p_source => 'dashboard', p_recipient_name => 'Carol Service',
          p_services => jsonb_build_array(jsonb_build_object('service_id', {service}, 'quantity', 2))) ->> 'id', true)$q$),
      ('C15 remember its service line', 'svc', 'value', '1', 'service',
       $q$select count(set_config('vt.vs', id::text, true))::text from public.voucher_services where voucher_id = {svcv}$q$),
      ('C16 same service twice -> refused', 'svc', 'error', 'duplicate_service', 'service',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'service', p_reference => {tag} || '-Z', p_source => 'dashboard',
          p_services => jsonb_build_array(jsonb_build_object('service_id', {service}), jsonb_build_object('service_id', {service})))$q$),
      ('C17 quantity 0 -> refused', 'svc', 'error', 'invalid_quantity', 'service',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'service', p_reference => {tag} || '-Z', p_source => 'dashboard',
          p_services => jsonb_build_array(jsonb_build_object('service_id', {service}, 'quantity', 0)))$q$),

      -- Search
      ('S01 search by part of the reference, any case', 'svc', 'value', '1', '',
       $q$select count(*)::text from jsonb_array_elements(public.search_vouchers({salon}, lower({tag} || '-m'))) e where e ->> 'id' = {money}$q$),
      ('S02 search by buyer name, any case', 'svc', 'value', '1', '',
       $q$select count(*)::text from jsonb_array_elements(public.search_vouchers({salon}, 'aLiCe exa')) e where e ->> 'id' = {money}$q$),
      ('S03 search by recipient name', 'svc', 'value', '1', '',
       $q$select count(*)::text from jsonb_array_elements(public.search_vouchers({salon}, 'BOB samp')) e where e ->> 'id' = {money}$q$),
      ('S04 "%" is searched literally, not as a wildcard', 'svc', 'value', '0', '',
       $q$select count(*)::text from jsonb_array_elements(public.search_vouchers({salon}, '%')) e where e ->> 'id' in ({money}, {paper})$q$),
      ('S05 exact reference comes first', 'svc', 'value', 'true', '',
       $q$select ((public.search_vouchers({salon}, lower({tag} || ' paper')) -> 0 ->> 'id') = {paper})::text$q$),
      ('S06 empty search lists newest vouchers', 'svc', 'value', '1', '',
       $q$select count(*)::text from jsonb_array_elements(public.search_vouchers({salon}, '  ')) e where e ->> 'id' = {money}$q$),
      ('S07 another salon finds none of these', 'svc', 'value', '0', '',
       $q$select jsonb_array_length(public.search_vouchers({other}, {tag}))::text$q$),

      -- Redeem money
      ('R01 partial redeem £12.50 -> £37.50 left', 'svc', 'value', '3750', '',
       $q$select public.redeem_voucher_amount({salon}, {money}, 1250, {owner}, 'Test part') ->> 'remaining_pence'$q$),
      ('R02 more than is left -> refused, says £37.50 left', 'svc', 'error', 'insufficient_balance|3750', '',
       $q$select public.redeem_voucher_amount({salon}, {money}, 3751)$q$),
      ('R03 redeem the rest -> £0 left', 'svc', 'value', '0', '',
       $q$select public.redeem_voucher_amount({salon}, {money}, 3750) ->> 'remaining_pence'$q$),
      ('R04 1p more -> refused (never below £0)', 'svc', 'error', 'insufficient_balance|0', '',
       $q$select public.redeem_voucher_amount({salon}, {money}, 1)$q$),
      ('R05 £0 redemption -> refused', 'svc', 'error', 'invalid_amount', '',
       $q$select public.redeem_voucher_amount({salon}, {paper}, 0)$q$),
      ('R06 another salon cannot redeem it', 'svc', 'error', 'voucher_not_found', '',
       $q$select public.redeem_voucher_amount({other}, {paper}, 100)$q$),
      ('R07 history: 2 redemptions totalling £50', 'svc', 'value', '2|5000', '',
       $q$select count(*) || '|' || sum(amount_pence) from public.voucher_redemptions where voucher_id = {money}$q$),
      ('R08 goodwill flag is ignored on a voucher that has not expired', 'svc', 'value', 'false', '',
       $q$select public.redeem_voucher_amount({salon}, {paper}, 100, null, null, true) ->> 'expired_override'$q$),
      ('R09 money redeem on a service voucher -> refused', 'svc', 'error', 'wrong_voucher_kind', 'service',
       $q$select public.redeem_voucher_amount({salon}, {svcv}, 100)$q$),

      -- Expired
      ('E01 an expired voucher (ended 31 Dec 2020)', 'svc', 'ok', '', '',
       $q$with i as (insert into public.vouchers (salon_id, kind, reference, amount_pence, remaining_pence, source, issued_on, expires_on)
                    values ({salon}, 'money', {tag} || '-X', 3000, 3000, 'physical', '2020-01-01', '2020-12-31') returning id)
          select set_config('vt.expired', (select id::text from i), true)$q$),
      ('E02 expired without goodwill -> refused, says when it ended', 'svc', 'error', 'voucher_expired|2020-12-31', '',
       $q$select public.redeem_voucher_amount({salon}, {expired}, 1000)$q$),
      ('E03 expired with goodwill confirmed -> allowed', 'svc', 'value', 'true', '',
       $q$select public.redeem_voucher_amount({salon}, {expired}, 1000, {owner}, 'Goodwill', true) ->> 'expired_override'$q$),
      ('E04 goodwill is recorded in the history', 'svc', 'value', '1', '',
       $q$select count(*)::text from public.voucher_redemptions where voucher_id = {expired} and expired_override$q$),
      ('E05 details say it is expired', 'svc', 'value', 'true', '',
       $q$select public.get_voucher({salon}, {expired}) -> 'voucher' ->> 'is_expired'$q$),
      ('E06 outstanding counts only unexpired (£0 + £19)', 'svc', 'value', '1900', '',
       $q$select ((public.voucher_stats({salon}) ->> 'outstanding_pence')::bigint - {base_out}::bigint)::text$q$),
      ('E07 expired balance is reported separately (£20)', 'svc', 'value', '2000', '',
       $q$select ((public.voucher_stats({salon}) ->> 'expired_balance_pence')::bigint - {base_exp}::bigint)::text$q$),

      -- Services
      ('V01 mark 1 of 2 services used', 'svc', 'value', '1', 'service',
       $q$select public.redeem_voucher_service({salon}, {svcv}, {vs}, 1, {owner}) ->> 'available_quantity'$q$),
      ('V02 use 2 more -> refused, says 1 left', 'svc', 'error', 'service_used_up|1', 'service',
       $q$select public.redeem_voucher_service({salon}, {svcv}, {vs}, 2)$q$),
      ('V03 quantity 0 -> refused', 'svc', 'error', 'invalid_quantity', 'service',
       $q$select public.redeem_voucher_service({salon}, {svcv}, {vs}, 0)$q$),
      ('V04 a service that is not on this voucher -> refused', 'svc', 'error', 'service_not_on_voucher', 'service',
       $q$select public.redeem_voucher_service({salon}, {svcv}, gen_random_uuid(), 1)$q$),
      ('V05 service redeem on a money voucher -> refused', 'svc', 'error', 'wrong_voucher_kind', '',
       $q$select public.redeem_voucher_service({salon}, {paper}, gen_random_uuid(), 1)$q$),
      ('V06 unused services went up by 1', 'svc', 'value', '1', 'service',
       $q$select ((public.voucher_stats({salon}) ->> 'unused_services')::bigint - {base_unused}::bigint)::text$q$),

      -- Holds (a voucher applied to a booking, not yet deducted)
      ('H01 hold £15 of the paper voucher (£19 left) for a booking', 'svc', 'ok', '', 'appt',
       $q$insert into public.voucher_holds (voucher_id, salon_id, appointment_id, amount_pence) values ({paper}, {salon}, {appt}, 1500)$q$),
      ('H02 redeem more than £4 -> refused, says £4 available', 'svc', 'error', 'insufficient_balance|400', 'appt',
       $q$select public.redeem_voucher_amount({salon}, {paper}, 401)$q$),
      ('H03 redeem exactly £4 -> £0 available', 'svc', 'value', '0', 'appt',
       $q$select public.redeem_voucher_amount({salon}, {paper}, 400) ->> 'available_pence'$q$),
      ('H04 details show the hold and £0 available', 'svc', 'value', '1|0', 'appt',
       $q$select jsonb_array_length(x -> 'holds') || '|' || (x -> 'voucher' ->> 'available_pence')
          from (select public.get_voucher({salon}, {paper}) as x) s$q$),
      ('H05 stats show £15 on hold', 'svc', 'value', '1500', 'appt',
       $q$select ((public.voucher_stats({salon}) ->> 'held_pence')::bigint - {base_held}::bigint)::text$q$),
      ('H06 cannot cancel while applied to a booking', 'svc', 'error', 'voucher_has_holds', 'appt',
       $q$select public.cancel_voucher({salon}, {paper}, 'Test cancel')$q$),
      ('H07 release that hold', 'svc', 'ok', '', 'appt',
       $q$update public.voucher_holds set status = 'released', resolved_at = now() where voucher_id = {paper} and status = 'held'$q$),
      ('H08 hold the last service for a booking', 'svc', 'ok', '', 'appt+service',
       $q$insert into public.voucher_holds (voucher_id, salon_id, appointment_id, voucher_service_id, quantity) values ({svcv}, {salon}, {appt}, {vs}, 1)$q$),
      ('H09 held service cannot be used -> says 0 left', 'svc', 'error', 'service_used_up|0', 'appt+service',
       $q$select public.redeem_voucher_service({salon}, {svcv}, {vs}, 1)$q$),
      ('H10 details show the held service', 'svc', 'value', '1', 'appt+service',
       $q$select public.get_voucher({salon}, {svcv}) -> 'services' -> 0 ->> 'held_quantity'$q$),

      -- Cancel
      ('X01 cancel with no reason -> refused', 'svc', 'error', 'reason_required', '',
       $q$select public.cancel_voucher({salon}, {money}, '   ')$q$),
      ('X02 cancel with a 2-letter reason -> refused', 'svc', 'error', 'reason_required', '',
       $q$select public.cancel_voucher({salon}, {money}, ' ok ')$q$),
      ('X03 another salon cannot cancel it', 'svc', 'error', 'voucher_not_found', '',
       $q$select public.cancel_voucher({other}, {money}, 'Test cancel')$q$),
      ('X04 cancel with a reason', 'svc', 'value', 'cancelled', '',
       $q$select public.cancel_voucher({salon}, {money}, '  Test cancel  ', {owner}) ->> 'status'$q$),
      ('X05 reason and who are recorded', 'svc', 'value', 'Test cancel|true', '',
       $q$select cancel_reason || '|' || (cancelled_by is not distinct from nullif({owner}, '')::uuid and cancelled_at is not null)
          from public.vouchers where id = {money}$q$),
      ('X06 cancel twice -> refused', 'svc', 'error', 'already_cancelled', '',
       $q$select public.cancel_voucher({salon}, {money}, 'Again please')$q$),
      ('X07 a cancelled voucher cannot be redeemed', 'svc', 'error', 'voucher_cancelled', '',
       $q$select public.redeem_voucher_amount({salon}, {money}, 1, null, null, true)$q$),

      -- Details and isolation
      ('D01 details: status, 2 redemptions, no services', 'svc', 'value', 'cancelled|2|0', '',
       $q$select (x -> 'voucher' ->> 'status') || '|' || jsonb_array_length(x -> 'redemptions') || '|' || jsonb_array_length(x -> 'services')
          from (select public.get_voucher({salon}, {money}) as x) s$q$),
      ('D02 another salon gets nothing', 'svc', 'value', 'true', '',
       $q$select (public.get_voucher({other}, {money}) is null)::text$q$),

      -- Only the server may call the functions
      ('P01 signed-in owner cannot call search from the browser', 'auth', 'error', '42501', '',
       $q$select public.search_vouchers({salon}, null)$q$),
      ('P02 signed-in owner cannot redeem from the browser', 'auth', 'error', '42501', '',
       $q$select public.redeem_voucher_amount({salon}, {paper}, 1)$q$),
      ('P03 signed-in owner cannot create from the browser', 'auth', 'error', '42501', '',
       $q$select public.create_voucher(p_salon_id => {salon}, p_kind => 'money', p_reference => {tag} || '-B', p_source => 'dashboard', p_amount_pence => 100)$q$),
      ('P04 public cannot read stats', 'anon', 'error', '42501', '',
       $q$select public.voucher_stats({salon})$q$),
      ('P05 public cannot cancel', 'anon', 'error', '42501', '',
       $q$select public.cancel_voucher({salon}, {paper}, 'Public cancel')$q$),

      -- Old gift cards
      ('G01 every valid old gift card has a voucher', 'svc', 'value', '0', '',
       $q$select count(*)::text from public.gift_cards gc
          where gc.salon_id is not null and gc.amount > 0 and gc.amount <= 5000
            and gc.remaining >= 0 and gc.remaining <= gc.amount
            and char_length(btrim(gc.code)) between 3 and 40
            and not exists (select 1 from public.vouchers v where v.legacy_gift_card_id = gc.id)
            and not exists (select 1 from public.vouchers v
                            where v.salon_id = gc.salon_id and v.reference_key = lower(btrim(gc.code)))$q$)
    ) as t(label, who, kind, expected, needs, sql)
  loop
    if (r.needs like '%appt%' and v_appt is null) or (r.needs like '%service%' and v_svc is null) then
      v_skip := v_skip + 1;
      continue;
    end if;

    v_sql := r.sql;
    foreach v_key in array v_keys loop
      v_sql := replace(v_sql, '{' || v_key || '}',
                       coalesce(quote_literal(nullif(current_setting('vt.' || v_key, true), '')), 'null'));
    end loop;

    begin
      if r.who = 'svc' then
        set local role service_role;
      elsif r.who = 'auth' then
        perform set_config('request.jwt.claim.sub', coalesce(v_owner::text, ''), true);
        perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
        set local role authenticated;
      else
        perform set_config('request.jwt.claim.sub', '', true);
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        set local role anon;
      end if;

      if r.kind = 'value' then
        execute v_sql into v_got;
        if v_got is distinct from r.expected then
          v_fail := v_fail || format('%s: expected %s, got %s', r.label, r.expected, coalesce(v_got, 'nothing'));
        else
          v_pass := v_pass + 1;
        end if;
      elsif r.kind = 'ok' then
        execute v_sql;
        v_pass := v_pass + 1;
      else
        execute v_sql;
        v_fail := v_fail || format('%s: it was allowed', r.label);
      end if;
      reset role;
    exception when others then
      get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
      if r.kind = 'error' and (
           r.expected = sqlstate
        or r.expected = v_msg
        or r.expected = v_msg || '|' || coalesce(v_detail, '')) then
        v_pass := v_pass + 1;
      else
        v_fail := v_fail || format('%s: unexpected error %s %s%s', r.label, sqlstate, v_msg,
                                   case when coalesce(v_detail, '') <> '' then ' (' || v_detail || ')' else '' end);
      end if;
    end;
  end loop;

  raise exception using message = format(
    'VOUCHER STEP 2 TESTS: %s passed, %s failed, %s skipped%s. Nothing was saved.%s',
    v_pass, cardinality(v_fail), v_skip,
    case when v_skip > 0 then ' (service tests need an active service, hold tests a booking, on the test salon)' else '' end,
    case when cardinality(v_fail) > 0 then E'\n' || array_to_string(v_fail, E'\n') else '' end);
end $$;
