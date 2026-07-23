-- Public/private visibility for community rotations (default public).
alter table public.community_rotations
  add column if not exists is_public boolean not null default true;

create index if not exists community_rotations_author_updated_idx
  on public.community_rotations (author_id, updated_at desc);

create index if not exists community_rotations_public_created_idx
  on public.community_rotations (created_at desc)
  where is_public = true;
