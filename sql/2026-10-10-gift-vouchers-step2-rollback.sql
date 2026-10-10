-- 2026-10-10 — Gift vouchers, step 2: ROLLBACK
--
-- Removes the seven step 2 functions, so the Gift Vouchers page stops working
-- (revert the code first). Deletes NO data: every voucher, redemption and old
-- gift card stays. vouchers.cancelled_by is dropped only if it is still empty;
-- otherwise it is kept (it records who cancelled a voucher).
-- One statement, so it is all-or-nothing.

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
    execute format('drop function %s', f);
  end loop;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'vouchers' and column_name = 'cancelled_by') then
    if exists (select 1 from public.vouchers where cancelled_by is not null) then
      raise notice 'vouchers.cancelled_by kept: it already records who cancelled some vouchers.';
    else
      alter table public.vouchers drop column cancelled_by;
    end if;
  end if;
end $$;
