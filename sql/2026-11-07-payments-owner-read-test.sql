-- 2026-11-07 — SELF-UNDOING TEST for sql/2026-11-07-payments-owner-read.sql
--
-- Run AFTER the policy. Reads only. It takes the salon with the most payments
-- and checks, under row level security:
--   • its owner sees exactly that salon's payments (all of them, nothing else);
--   • another signed-in user sees none;
--   • the public (anon) sees none.
-- The whole file is one statement that always ends in an error on purpose, so
-- nothing can be saved. The error message IS the result, e.g.
--   PAYMENTS READ TEST: passed. The owner sees 2 of their salon's 2 payments, another signed-in user sees 0, the public sees 0. Nothing was saved.

do $$
declare
  v_salon    uuid;
  v_owner    uuid;
  v_expected int;
  v_seen     int;
  v_seen_bad int;
  v_stranger int;
  v_public   int;
begin
  select s.id, s.owner_id into v_salon, v_owner
  from public.payments p
  join public.appointments a on a.id = p.appointment_id
  join public.salons s on s.id = a.salon_id
  where s.owner_id is not null
  group by s.id, s.owner_id
  order by count(*) desc
  limit 1;
  if v_salon is null then
    raise exception 'PAYMENTS READ TEST: no payment is linked to a salon with an owner, nothing to test. Nothing was saved.';
  end if;
  select count(*) into v_expected
  from public.payments p join public.appointments a on a.id = p.appointment_id
  where a.salon_id = v_salon;

  -- as the salon's owner
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from public.payments;
  select count(*) into v_seen_bad from public.payments p
  where not exists (select 1 from public.appointments a where a.id = p.appointment_id and a.salon_id = v_salon);
  reset role;

  -- as another signed-in user
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000abcd', true);
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000abcd", "role": "authenticated"}', true);
  set local role authenticated;
  select count(*) into v_stranger from public.payments;
  reset role;

  -- as the public
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;
  select count(*) into v_public from public.payments;
  reset role;

  raise exception using message = format(
    'PAYMENTS READ TEST: %s. The owner sees %s of their salon''s %s payments%s, another signed-in user sees %s, the public sees %s. Nothing was saved.',
    case when v_seen = v_expected and v_seen_bad = 0 and v_stranger = 0 and v_public = 0 then 'passed' else 'FAILED' end,
    v_seen, v_expected,
    case when v_seen_bad > 0 then format(' (and %s payments of other salons or of no booking!)', v_seen_bad) else '' end,
    v_stranger, v_public);
end $$;
