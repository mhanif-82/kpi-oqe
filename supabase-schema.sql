-- Run this in Supabase SQL Editor after creating the project.

create table if not exists kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  period text,
  file_name text,
  uploaded_at timestamptz not null default now(),
  uploaded_by text,
  data jsonb not null
);

alter table kpi_snapshots add column if not exists file_name text;

create index if not exists kpi_snapshots_uploaded_at_idx
  on kpi_snapshots (uploaded_at desc);

alter table kpi_snapshots enable row level security;

-- Public read so the TV dashboard works without login.
drop policy if exists "public read kpi_snapshots" on kpi_snapshots;
create policy "public read kpi_snapshots" on kpi_snapshots
  for select using (true);

-- Only logged-in users (admins) may upload.
drop policy if exists "authed insert kpi_snapshots" on kpi_snapshots;
create policy "authed insert kpi_snapshots" on kpi_snapshots
  for insert to authenticated with check (true);

drop policy if exists "authed delete kpi_snapshots" on kpi_snapshots;
create policy "authed delete kpi_snapshots" on kpi_snapshots
  for delete to authenticated using (true);
