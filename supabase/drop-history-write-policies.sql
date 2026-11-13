-- REQUIRED on any database that ran the older schema.sql. Run once in the Supabase dashboard:
-- SQL Editor -> New query -> paste -> Run. Safe to run again (if exists).
-- A fresh install that runs the current schema.sql never creates these policies and can skip this file.
--
-- Why: the free daily limit counts the user's own lead_history rows. While users could update or
-- delete those rows with their own token, one call from the browser console reset the count to 0.
-- The app no longer needs either policy: it writes status and result with the service-role key
-- (frontend/app/api/analyze/route.ts and frontend/app/api/runs/[id]/route.ts).
--
-- Kept: "read own history" (history page, run lookup) and "insert own history" (claim_analysis runs
-- as the caller, so it needs insert).

drop policy if exists "update own history" on public.lead_history;
drop policy if exists "delete own history" on public.lead_history;
