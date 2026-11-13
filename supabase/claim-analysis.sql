-- Atomic free-limit check and insert. Run once in the Supabase dashboard:
-- SQL Editor -> New query -> paste -> Run. Safe to run again (create or replace).
-- Needs schema.sql already applied. Not applied automatically by anything.
--
-- The API route calls this before it starts the Trigger.dev task. One call checks the
-- daily count and inserts the history row, so two requests sent at once cannot both pass.
-- Runs as the caller (security invoker), so row-level security and auth.uid() still apply.
--
-- p_limit  daily limit, or null for no limit (Pro)
-- p_since  start of today in Dubai time (the app computes it)
-- Returns the new row id, or null when the limit is reached.
-- run_id gets a placeholder. The route replaces it with the real Trigger.dev run id.
--
-- Every row created since p_since counts, except failed ones. A pending row counts for the whole
-- day: each one is a paid LLM call, even if the browser never polls for the result.
-- Keep in step with getUsage in frontend/lib/billing.ts.
--
-- UPGRADING from the older four-argument version (it had p_stale_before, a 10 minute rule for
-- pending rows): run this file BEFORE deploying the new frontend. Both versions then exist side by
-- side, so the old and the new frontend both keep working. After the new frontend is live, run the
-- drop statement at the bottom of this file to remove the old version.

create or replace function public.claim_analysis(
  p_lead jsonb,
  p_limit int,
  p_since timestamptz
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_used int;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Serialises concurrent calls for the same user until this transaction ends.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  if p_limit is not null then
    select count(*) into v_used
    from public.lead_history
    where user_id = v_user
      and created_at >= p_since
      and status <> 'failed';

    if v_used >= p_limit then
      return null;
    end if;
  end if;

  insert into public.lead_history (user_id, run_id, lead)
  values (v_user, 'claim_' || gen_random_uuid()::text, p_lead)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.claim_analysis(jsonb, int, timestamptz) from public, anon;
grant execute on function public.claim_analysis(jsonb, int, timestamptz) to authenticated;

-- After the new frontend is deployed, remove the old four-argument version (uncomment and run):
-- drop function if exists public.claim_analysis(jsonb, int, timestamptz, timestamptz);
