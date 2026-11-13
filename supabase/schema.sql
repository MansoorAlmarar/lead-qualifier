-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- One row per analysis. Row-level security keeps each user to their own rows.

create table if not exists public.lead_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id text not null unique,
  lead jsonb not null,
  result jsonb,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists lead_history_user_created_idx
  on public.lead_history (user_id, created_at desc);

alter table public.lead_history enable row level security;

create policy "read own history" on public.lead_history
  for select to authenticated using (user_id = auth.uid());

create policy "insert own history" on public.lead_history
  for insert to authenticated with check (user_id = auth.uid());

-- No update or delete policies on purpose. The daily limit counts these rows, so a user who could
-- change or delete them could reset their own quota. The server writes status and result with the
-- service-role key. A database created from an older copy of this file still has both policies:
-- run supabase/drop-history-write-policies.sql to remove them.
