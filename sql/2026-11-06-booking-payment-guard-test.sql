-- 2026-11-06 — SELF-UNDOING TEST for sql/2026-11-06-booking-payment-guard.sql
--
-- Run AFTER the migration, on ONE test salon. As the public (anon) user it books
-- through create_booking_with_services 14 times with different payment fields
-- and salon settings, and checks guard 10 lets through exactly what the booking
-- page would send — nothing else. To try each setting it briefly changes the
-- test salon's payment settings / Stripe switch and its first service's price.
-- Safe on the live database: the whole file is one statement that ALWAYS ends in
-- an error on purpose, so those changes and every test booking are rolled back.
-- Nothing is saved, no confirmation is sent, no Stripe call is made.
--
-- How to run:
--   1. Put your test salon's slug on the ▶ line. It needs at least one active
--      staff member and one service.
--   2. Run the whole file in the Supabase SQL editor.
--   3. The error message IS the result, e.g.
--        PAYMENT GUARD TESTS: 14 passed, 0 failed. Nothing was saved.

do $$
declare
  v_slug    constant text := 'your-test-salon-slug';   -- ▶ your TEST salon's slug
  -- online payment + the salon's own 30% deposit, Pay at Salon OFF
  s_online  constant text := '{"full_online": true, "deposit_online": true, "pay_at_salon": false, "custom_deposit": true, "deposit_percent": 30}';
  -- Pay at Salon ON as well
  s_salon   constant text := '{"full_online": true, "deposit_online": true, "pay_at_salon": true, "custom_deposit": false, "deposit_percent": 50}';
  -- full online payment only
  s_full    constant text := '{"full_online": true, "deposit_online": false, "pay_at_salon": false, "custom_deposit": false, "deposit_percent": 50}';
  v_salon   uuid;
  v_service uuid;
  v_new     uuid;
  v_when    timestamptz := date_trunc('day', now() + interval '500 days') + interval '3 hours';
  v_result  text;
  v_row     record;
  t         record;
  v_pass    int := 0;
  v_fail    text[] := '{}';
begin
  select id into v_salon from public.salons where slug = v_slug;
  if v_salon is null then
    raise exception 'PAYMENT GUARD TESTS: no salon has the slug "%". Nothing was saved.', v_slug;
  end if;
  select id into v_service from public.services where salon_id = v_salon order by id limit 1;
  if v_service is null or not exists (select 1 from public.staff where salon_id = v_salon and active) then
    raise exception 'PAYMENT GUARD TESTS: the test salon needs a service and an active staff member. Nothing was saved.';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  for t in
    select * from (values
      -- n, settings, Stripe ready, "from" price, status, payment_status, payment_method, expected
      ( 1, s_online, true,  false, 'pending',   'pending',      'full_online',    'booked'),
      ( 2, s_online, true,  false, 'pending',   'pending',      'custom_deposit', 'booked'),
      ( 3, s_online, true,  false, 'confirmed', 'pay_at_salon', 'pay_at_salon',   'PAYMENT_OPTION_NOT_ALLOWED'),  -- the hole
      ( 4, s_online, true,  false, 'confirmed', 'pay_at_salon', 'full_online',    'PAYMENT_OPTION_NOT_ALLOWED'),  -- "nothing to pay" on £40
      ( 5, s_online, true,  false, 'pending',   'pending',      null,             'PAYMENT_OPTION_NOT_ALLOWED'),
      ( 6, s_online, true,  false, 'pending',   'pending',      'pay_at_salon',   'PAYMENT_OPTION_NOT_ALLOWED'),
      ( 7, s_online, true,  false, 'confirmed', 'pending',      'full_online',    'PAYMENT_OPTION_NOT_ALLOWED'),
      ( 8, s_online, false, false, 'pending',   'pending',      'full_online',    'ONLINE_PAYMENTS_UNAVAILABLE'),
      ( 9, s_online, false, false, 'confirmed', 'pay_at_salon', 'pay_at_salon',   'booked'),  -- page offers only Pay at Salon
      (10, s_salon,  true,  false, 'confirmed', 'pay_at_salon', 'pay_at_salon',   'booked'),
      (11, null,     true,  false, 'pending',   'pending',      null,             'booked'),  -- never saved settings
      (12, null,     true,  false, 'pending',   'pending',      'custom_deposit', 'PAYMENT_OPTION_NOT_ALLOWED'),
      (13, s_full,   true,  true,  'confirmed', 'pay_at_salon', 'pay_at_salon',   'booked'),  -- "from" price → Pay at Salon
      (14, s_full,   true,  true,  'pending',   'pending',      'full_online',    'PAYMENT_OPTION_NOT_ALLOWED')
    ) as c(n, settings, ready, is_from, st, ps, pm, expected)
    order by n
  loop
    -- the salon's settings for this case (works whether the column is json or jsonb)
    execute format('update public.salons set payment_methods = %L, stripe_account_id = %L, charges_enabled = %L where id = %L',
                   t.settings, 'acct_payment_guard_test', t.ready, v_salon);
    update public.services set price = 40, price_is_from = t.is_from where id = v_service;

    v_new := gen_random_uuid();
    begin
      set local role anon;
      perform public.create_booking_with_services(
        v_new, gen_random_uuid(), v_salon, 'Payment guard test', 'test@example.com', '+447700900000',
        v_service, null, v_when + t.n * interval '1 day', t.st, t.ps, t.pm,
        jsonb_build_array(jsonb_build_object('service_id', v_service, 'sort_order', 0)));
      reset role;
      select status, payment_status, payment_method into v_row from public.appointments where id = v_new;
      v_result := case when v_row.status = t.st and v_row.payment_status = t.ps
                        and v_row.payment_method is not distinct from t.pm
                       then 'booked' else format('booked but stored %s / %s / %s', v_row.status, v_row.payment_status, v_row.payment_method) end;
    exception when others then
      v_result := sqlerrm;
    end;
    reset role;

    if v_result = t.expected then
      v_pass := v_pass + 1;
    else
      v_fail := v_fail || format('T%s (%s / %s / %s): expected %s, got %s', t.n, t.st, t.ps, coalesce(t.pm, 'null'), t.expected, v_result);
    end if;
  end loop;

  raise exception using message = format('PAYMENT GUARD TESTS: %s passed, %s failed. Nothing was saved.%s',
    v_pass, cardinality(v_fail),
    case when cardinality(v_fail) > 0 then E'\n' || array_to_string(v_fail, E'\n') else '' end);
end $$;
