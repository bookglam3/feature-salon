-- 2026-11-08 — SELF-UNDOING TEST for sql/2026-11-08-lifetime-access.sql
--
-- Run AFTER the change. Signed in as the OWNER of a salon WITHOUT lifetime
-- access, it checks:
--   T1 the owner can't give their own salon lifetime_access    → refused
--   T2 the owner can still change an ordinary field (its name)  → works
-- and, signed in as the owner of the lifetime salon:
--   T3 they can't take it away (or change it) either           → refused
--   T4 the lifetime salon still has it                          → true
-- The whole file is one statement that always ends in an error on purpose, so
-- nothing is saved. The error message IS the result, e.g.
--   LIFETIME ACCESS TEST: 4 passed, 0 failed. Nothing was saved.

do $$
declare
  v_salon    uuid;  -- an ordinary salon (with an owner)
  v_owner    uuid;
  v_life     uuid;  -- the lifetime salon
  v_life_own uuid;
  v_n        int;
  v_pass     int := 0;
  v_fail     text[] := '{}';
begin
  select id, owner_id into v_salon, v_owner from public.salons
  where not lifetime_access and owner_id is not null order by created_at limit 1;
  select id, owner_id into v_life, v_life_own from public.salons where lifetime_access limit 1;
  if v_salon is null or v_life is null or v_life_own is null then
    raise exception 'LIFETIME ACCESS TEST: needs one ordinary salon and the lifetime salon, both with an owner. Nothing was saved.';
  end if;

  -- as the ordinary salon's owner
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- T1
  begin
    set local role authenticated;
    update public.salons set lifetime_access = true where id = v_salon;
    get diagnostics v_n = row_count;
    reset role;
    v_fail := v_fail || format('T1 owner gave their own salon lifetime_access (%s row)', v_n);
  exception
    when insufficient_privilege then v_pass := v_pass + 1;
    when others then v_fail := v_fail || format('T1 unexpected error: %s', sqlerrm);
  end;
  reset role;

  -- T2
  begin
    set local role authenticated;
    update public.salons set name = name where id = v_salon;
    get diagnostics v_n = row_count;
    reset role;
    if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail || format('T2 owner could not update their own salon name (%s rows)', v_n); end if;
  exception when others then
    v_fail := v_fail || format('T2 owner could not update their own salon name: %s', sqlerrm);
  end;
  reset role;

  -- as the lifetime salon's owner
  perform set_config('request.jwt.claim.sub', v_life_own::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_life_own, 'role', 'authenticated')::text, true);

  -- T3
  begin
    set local role authenticated;
    update public.salons set lifetime_access = false where id = v_life;
    get diagnostics v_n = row_count;
    reset role;
    v_fail := v_fail || format('T3 lifetime_access was changed by a signed-in user (%s row)', v_n);
  exception
    when insufficient_privilege then v_pass := v_pass + 1;
    when others then v_fail := v_fail || format('T3 unexpected error: %s', sqlerrm);
  end;
  reset role;

  -- T4
  if (select lifetime_access from public.salons where id = v_life) then v_pass := v_pass + 1;
  else v_fail := v_fail || 'T4 the lifetime salon lost lifetime_access'; end if;

  raise exception using message = format('LIFETIME ACCESS TEST: %s passed, %s failed. Nothing was saved.%s',
    v_pass, cardinality(v_fail),
    case when cardinality(v_fail) > 0 then E'\n' || array_to_string(v_fail, E'\n') else '' end);
end $$;
