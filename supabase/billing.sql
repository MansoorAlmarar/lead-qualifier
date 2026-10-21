-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- One row per user who has started checkout. The Stripe webhook keeps it current.
-- Users can read their own row. Only the server (service-role key) can write it.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  status text not null default 'none',
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "read own subscription" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- No insert, update or delete policies on purpose: the service-role key bypasses RLS.
