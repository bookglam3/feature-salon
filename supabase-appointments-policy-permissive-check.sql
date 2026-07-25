-- Confirms/rules out: is there a RESTRICTIVE policy on appointments
-- applicable to INSERT (or ALL) that we haven't accounted for?
-- Restrictive policies AND together — one failing blocks the insert
-- no matter how many permissive policies pass. Plain top-level SELECT,
-- read-only catalog query, no RLS involved, no transaction needed —
-- this IS a real result set, not a NOTICE.
--
-- effective_check_for_insert = COALESCE(with_check, qual): for a FOR
-- ALL policy where with_check is NULL, Postgres falls back to using
-- the USING clause (qual) as the check for INSERT too — same mechanic
-- already confirmed for "salon owner appointments only". A policy with
-- with_check showing NULL here is NOT "no check" — this column shows
-- what actually gets evaluated.

SELECT
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check,
  COALESCE(with_check, qual) AS effective_check_for_insert
FROM pg_policies
WHERE tablename = 'appointments'
  AND cmd IN ('INSERT', 'ALL')
ORDER BY permissive, cmd, policyname;
