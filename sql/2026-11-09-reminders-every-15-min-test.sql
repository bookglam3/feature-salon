-- 2026-11-09 — SELF-UNDOING TEST for the trigger in sql/2026-11-09-reminders-every-15-min.sql
--
-- On one existing booking (changes are undone at the end):
--   T1 changing the date/time makes the 24h / 2h reminders and no-show alert due again
--   T2 changing something else (notes) leaves the flags alone
--   T3 thank-you and win-back flags are never reset
-- The whole file is one statement that always ends in an error on purpose, so
-- nothing is saved. The error message IS the result, e.g.
--   REMINDER TRIGGER TEST: 3 passed, 0 failed. Nothing was saved.

do $$
declare
  v_id   uuid;
  v_row  record;
  v_pass int := 0;
  v_fail text[] := '{}';
begin
  select id into v_id from public.appointments where date_time is not null order by created_at desc limit 1;
  if v_id is null then
    raise exception 'REMINDER TRIGGER TEST: needs one booking. Nothing was saved.';
  end if;

  update public.appointments
     set reminder_24h_sent = true, reminder_2h_sent = true, whatsapp_24h_sent = true, whatsapp_2h_sent = true,
         no_show_alert_sent = true, thankyou_1h_sent = true, winback_sent = true
   where id = v_id;

  -- T2 first: notes only
  update public.appointments set notes = coalesce(notes, '') || ' ' where id = v_id;
  select * into v_row from public.appointments where id = v_id;
  if v_row.reminder_24h_sent and v_row.reminder_2h_sent and v_row.no_show_alert_sent then v_pass := v_pass + 1;
  else v_fail := v_fail || 'T2 flags were reset by a change that is not the date/time'; end if;

  -- T1: move it by a day
  update public.appointments set date_time = date_time + interval '1 day' where id = v_id;
  select * into v_row from public.appointments where id = v_id;
  if not v_row.reminder_24h_sent and not v_row.reminder_2h_sent and not v_row.whatsapp_24h_sent
     and not v_row.whatsapp_2h_sent and not v_row.no_show_alert_sent then v_pass := v_pass + 1;
  else v_fail := v_fail || 'T1 a new date/time did not make the reminders due again'; end if;

  -- T3
  if v_row.thankyou_1h_sent and v_row.winback_sent then v_pass := v_pass + 1;
  else v_fail := v_fail || 'T3 thank-you / win-back flags were reset'; end if;

  raise exception using message = format('REMINDER TRIGGER TEST: %s passed, %s failed. Nothing was saved.%s',
    v_pass, cardinality(v_fail),
    case when cardinality(v_fail) > 0 then E'\n' || array_to_string(v_fail, E'\n') else '' end);
end $$;
