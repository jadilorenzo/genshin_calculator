-- Cloud blob for signed-in app data (rotations, pulls, artifacts, theme, etc.).
-- Writes go through /api/user-data with the Supabase service role after Clerk verifies the user.
create table if not exists public.user_app_data (
  user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;
