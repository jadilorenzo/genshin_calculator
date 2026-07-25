-- Personal Testing: private combat screenshot sessions + OCR-reviewed runs.
create table if not exists public.testing_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  title text not null,
  notes text not null default '',
  linked_rotation_id uuid null
    references public.community_rotations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists testing_sessions_owner_idx
  on public.testing_sessions (owner_id, updated_at desc);

create table if not exists public.testing_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.testing_sessions (id) on delete cascade,
  owner_id text not null,
  sort_order integer not null default 0,
  storage_path text not null default '',
  main_dps_id text not null default '',
  dps numeric,
  total_damage numeric,
  elapsed_seconds numeric,
  strongest_hit numeric,
  -- Calendar/timestamp read from the screenshot overlay when present.
  captured_at timestamptz,
  -- [{ slot, characterId, name, damage, teamPct }]
  characters jsonb not null default '[]'::jsonb,
  ocr_raw text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists testing_runs_session_idx
  on public.testing_runs (session_id, sort_order, created_at);

alter table public.testing_sessions enable row level security;
alter table public.testing_runs enable row level security;
-- Access only via service role from Vercel APIs (Clerk-verified).
