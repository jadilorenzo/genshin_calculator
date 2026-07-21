-- Community rotations: published docs with likes + comments.
create table if not exists public.community_rotations (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  author_name text not null default '',
  title text not null,
  description text not null default '',
  doc jsonb not null,
  character_ids text[] not null default '{}',
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_rotations_popular_idx
  on public.community_rotations (likes_count desc, created_at desc);

create index if not exists community_rotations_new_idx
  on public.community_rotations (created_at desc);

create table if not exists public.community_rotation_likes (
  rotation_id uuid not null references public.community_rotations (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (rotation_id, user_id)
);

create table if not exists public.community_rotation_comments (
  id uuid primary key default gen_random_uuid(),
  rotation_id uuid not null references public.community_rotations (id) on delete cascade,
  author_id text not null,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_rotation_comments_rotation_idx
  on public.community_rotation_comments (rotation_id, created_at asc);

alter table public.community_rotations enable row level security;
alter table public.community_rotation_likes enable row level security;
alter table public.community_rotation_comments enable row level security;
-- Access only via service role from Vercel APIs (Clerk-verified).
