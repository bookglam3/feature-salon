-- 2026-11-05 — SELF-UNDOING TEST for sql/2026-11-05-booking-prices-and-insert-lockdown.sql
--
-- Run AFTER the migration, on ONE test salon. As the public (anon) user it:
--   T1 tries to insert an appointment directly            → must be refused
--   T2 tries to insert an appointment_services row        → must be refused
--   T3 books through create_booking_with_services with a fake price (£0.01)
--      and a fake length (5 min)                          → must work, and store
--      the real price / name / length from the services table
-- Safe on the live database: the whole file is one statement that ALWAYS ends
-- in an error on purpose, so every row it made is rolled back. The test booking
-- is never saved, so no confirmation is sent for it.
--
-- How to run:
--   1. Put your test salon's slug on the ▶ line. It needs at least one active
--      staff member, one service and one existing booking (for T2).
--   2. Run the whole file in the Supabase SQL editor.
--   3. The error message IS the result, e.g.
--        LOCKDOWN TESTS: 3 passed, 0 failed. Nothing was saved.

do $$
declare
  v_slug    constant text := 'your-test-salon-slug';   -- ▶ your TEST salon's slug
  v_salon   uuid;
  v_service record;
  v_appt    uuid;
  v_new     uuid := gen_random_uuid();
  v_when    timestamptz := date_trunc('day', now() + interval '500 days') + interval '3 hours';
  v_row     record;
  v_minutes numeric;
  v_pass    int := 0;
  v_fail    text[] := '{}';
begin
  select id into v_salon from public.salons where slug = v_slug;
  if v_salon is null then
    raise exception 'LOCKDOWN TESTS: no salon has the slug "%". Nothing was saved.', v_slug;
  end if;
  select id, name, price, coalesce(duration_minutes, 30) as minutes into v_service
  from public.services where salon_id = v_salon order by id limit 1;
  select id into v_appt from public.appointments where salon_id = v_salon order by id limit 1;
  if v_service.id is null or v_appt is null
     or not exists (select 1 from public.staff where salon_id = v_salon and active) then
    raise exception 'LOCKDOWN TESTS: the test salon needs a service, an active staff member and one booking. Nothing was saved.';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- T1: direct appointment insert as anon
  begin
    set local role anon;
    insert into public.appointments (id, salon_id, client_name, client_email, client_phone, service_id,
                                     date_time, end_time, status, payment_status, payment_method)
    values (gen_random_uuid(), v_salon, 'Lockdown test', 'test@example.com', '+447700900000', v_service.id,
            v_when, v_when + interval '5 minutes', 'confirmed', 'pay_at_salon', 'pay_at_salon');
    v_fail := v_fail || 'T1 direct appointment insert was ALLOWED';
    reset role;
  exception
    when insufficient_privilege then v_pass := v_pass + 1;
    when others then v_fail := v_fail || format('T1 unexpected error: %s', sqlerrm);
  end;
  reset role;

  -- T2: direct appointment_services insert as anon, with a fake price
  begin
    set local role anon;
    insert into public.appointment_services (appointment_id, service_id, name, price, duration_minutes, sort_order)
    values (v_appt, v_service.id, 'Fake', 0.01, 5, 99);
    v_fail := v_fail || 'T2 direct appointment_services insert was ALLOWED';
    reset role;
  exception
    when insufficient_privilege then v_pass := v_pass + 1;
    when others then v_fail := v_fail || format('T2 unexpected error: %s', sqlerrm);
  end;
  reset role;

  -- T3: book through the function as anon, sending a fake price and length
  begin
    set local role anon;
    perform public.create_booking_with_services(
      v_new, gen_random_uuid(), v_salon, 'Lockdown test', 'test@example.com', '+447700900000',
      v_service.id, null, v_when, 'confirmed', 'pay_at_salon', 'pay_at_salon',
      jsonb_build_array(jsonb_build_object('service_id', v_service.id, 'name', 'FAKE', 'price', 0.01,
                                           'duration_minutes', 5, 'price_is_from', true, 'sort_order', 0)));
    reset role;
    select name, price, duration_minutes into v_row from public.appointment_services where appointment_id = v_new;
    select extract(epoch from end_time - date_time) / 60 into v_minutes from public.appointments where id = v_new;
    if v_row.name = v_service.name and v_row.price = v_service.price
       and v_row.duration_minutes = v_service.minutes and v_minutes = v_service.minutes then
      v_pass := v_pass + 1;
    else
      v_fail := v_fail || format('T3 stored %s / %s / %s min (booking %s min), expected %s / %s / %s min',
                                 v_row.name, v_row.price, v_row.duration_minutes, v_minutes,
                                 v_service.name, v_service.price, v_service.minutes);
    end if;
  exception when others then
    v_fail := v_fail || format('T3 booking through the function failed: %s', sqlerrm);
  end;
  reset role;

  raise exception using message = format('LOCKDOWN TESTS: %s passed, %s failed. Nothing was saved.%s',
    v_pass, cardinality(v_fail),
    case when cardinality(v_fail) > 0 then E'\n' || array_to_string(v_fail, E'\n') else '' end);
end $$;
