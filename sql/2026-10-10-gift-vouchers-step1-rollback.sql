-- 2026-10-10 — Gift vouchers, step 1: ROLLBACK
--
-- Undoes sql/2026-10-10-gift-vouchers-step1.sql: drops the four voucher tables
-- and salons.gift_vouchers_enabled. gift_cards is untouched by both scripts,
-- so every old gift card is still there afterwards.
--
-- Preferred instead of this: turn the switch off (or revert the code) and keep
-- the tables — they are invisible to the public while the switch is off.
--
-- Safety: refuses to run (and changes nothing) if any voucher data exists that
-- is not a copy of an old gift card — i.e. anything created after step 1.
-- The check and the drops are one statement, so it is all-or-nothing.

do $$
declare
  v_new int;
begin
  if to_regclass('public.vouchers') is not null then
    select (select count(*) from public.vouchers where source <> 'migrated')
         + (select count(*) from public.voucher_services)
         + (select count(*) from public.voucher_redemptions)
         + (select count(*) from public.voucher_holds)
      into v_new;
    if v_new > 0 then
      raise exception 'Rollback refused: % voucher row(s) were created after step 1. Nothing was changed.', v_new
        using hint = 'Turn gift vouchers off instead, or export those rows first.';
    end if;
  end if;

  drop table if exists public.voucher_holds;
  drop table if exists public.voucher_redemptions;
  drop table if exists public.voucher_services;
  drop table if exists public.vouchers;
  alter table public.salons drop column if exists gift_vouchers_enabled;
end $$;
