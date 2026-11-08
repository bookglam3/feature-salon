-- 2026-11-09 — SELF-UNDOING TEST for sql/2026-11-09-invoice-email-log.sql
--
-- Run AFTER the change. Signed in as the OWNER of a salon, it checks:
--   T1 the owner can't read the log                      → refused
--   T2 the owner can't add a row (e.g. fake old sends)    → refused
--   T3 the owner can't delete rows (reset the count)      → refused
-- and as the server (this SQL editor):
--   T4 a row can be written and counted                   → 1
-- The whole file is one statement that always ends in an error on purpose, so
-- nothing is saved. The error message IS the result, e.g.
--   INVOICE EMAIL LOG TEST: 4 passed, 0 failed. Nothing was saved.

do $$
declare
  v_salon uuid;
  v_owner uuid;
  v_n     int;
  v_pass  int := 0;
  v_fail  text[] := '{}';
begin
  select id, owner_id into v_salon, v_owner from public.salons where owner_id is not null order by created_at limit 1;
  if v_salon is null then
    raise exception 'INVOICE EMAIL LOG TEST: needs one salon with an owner. Nothing was saved.';
  end if;

  -- T4 first, as the server
  insert into public.invoice_email_log (salon_id, invoice_id, status) values (v_salon, 'test-invoice', 'sent');
  select count(*) into v_n from public.invoice_email_log where salon_id = v_salon and invoice_id = 'test-invoice';
  if v_n = 1 then v_pass := v_pass + 1; else v_fail := v_fail || format('T4 server row count %s, expected 1', v_n); end if;

  -- as the salon's owner
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- T1
  begin
    set local role authenticated;
    select count(*) into v_n from public.invoice_email_log;
    reset role;
    v_fail := v_fail || format('T1 owner could read the log (%s rows)', v_n);
  exception
    when insufficient_privilege then v_pass := v_pass + 1;
    when others then v_fail := v_fail || format('T1 unexpected error: %s', sqlerrm);
  end;
  reset role;

  -- T2
  begin
    set local role authenticated;
    insert into public.invoice_email_log (salon_id, invoice_id, status) values (v_salon, 'x', 'failed');
    reset role;
    v_fail := v_fail || 'T2 owner could add a row';
  exception
    when insufficient_privilege then v_pass := v_pass + 1;
    when others then v_fail := v_fail || format('T2 unexpected error: %s', sqlerrm);
  end;
  reset role;

  -- T3
  begin
    set local role authenticated;
    delete from public.invoice_email_log where salon_id = v_salon;
    reset role;
    v_fail := v_fail || 'T3 owner could delete rows';
  exception
    when insufficient_privilege then v_pass := v_pass + 1;
    when others then v_fail := v_fail || format('T3 unexpected error: %s', sqlerrm);
  end;
  reset role;

  raise exception using message = format('INVOICE EMAIL LOG TEST: %s passed, %s failed. Nothing was saved.%s',
    v_pass, cardinality(v_fail),
    case when cardinality(v_fail) > 0 then E'\n' || array_to_string(v_fail, E'\n') else '' end);
end $$;
