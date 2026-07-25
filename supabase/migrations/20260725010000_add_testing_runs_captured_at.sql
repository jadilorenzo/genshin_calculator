-- Existing testing_runs tables predate screenshot capture timestamps.
alter table public.testing_runs
  add column if not exists captured_at timestamptz;
