-- Run in Supabase SQL editor once.
create table if not exists public.user_app_data (
  user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;
-- Access is only via the service role from our Vercel API (Clerk-verified).
