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

-- Tipe data: 'rm' (Relationship Manager) atau 'sourcing' (People Search + Central Sourcing Manager).
-- Tiap tipe punya snapshot terpisah; upload satu tipe hanya mengganti tipe yang sama.
alter table kpi_snapshots add column if not exists type text not null default 'rm';

create index if not exists kpi_snapshots_uploaded_at_idx
  on kpi_snapshots (uploaded_at desc);

create index if not exists kpi_snapshots_type_idx
  on kpi_snapshots (type, uploaded_at desc);

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

-- ── Foto profil per orang (dipakai semua dashboard; upload dari /admin/photos) ──
-- Key = nama lowercase; image = data-URL JPEG kecil (±256px).
create table if not exists person_photos (
  name text primary key,
  image text not null,
  updated_at timestamptz not null default now()
);

alter table person_photos enable row level security;

drop policy if exists "public read person_photos" on person_photos;
create policy "public read person_photos" on person_photos
  for select using (true);

drop policy if exists "authed insert person_photos" on person_photos;
create policy "authed insert person_photos" on person_photos
  for insert to authenticated with check (true);

drop policy if exists "authed update person_photos" on person_photos;
create policy "authed update person_photos" on person_photos
  for update to authenticated using (true);

drop policy if exists "authed delete person_photos" on person_photos;
create policy "authed delete person_photos" on person_photos
  for delete to authenticated using (true);

-- ── Riwayat upload (log metadata tiap upload; data aslinya tetap replace-per-type) ──
create table if not exists upload_history (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  period text,
  file_name text,
  rows integer,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

alter table upload_history enable row level security;

-- Berisi email pengupload → hanya untuk yang login.
drop policy if exists "authed read upload_history" on upload_history;
create policy "authed read upload_history" on upload_history
  for select to authenticated using (true);

drop policy if exists "authed insert upload_history" on upload_history;
create policy "authed insert upload_history" on upload_history
  for insert to authenticated with check (true);

-- Seed awal: masukkan snapshot yang sekarang masih ada supaya history tidak kosong.
insert into upload_history (type, period, file_name, uploaded_by, uploaded_at)
select type, period, file_name, uploaded_by, uploaded_at from kpi_snapshots
on conflict do nothing;

-- ── Simpan file asli tiap upload (untuk download di /history-upload) ──
alter table upload_history add column if not exists storage_path text;

-- Bucket privat untuk file mentah.
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "authed read uploads" on storage.objects;
create policy "authed read uploads" on storage.objects
  for select to authenticated using (bucket_id = 'uploads');

drop policy if exists "authed insert uploads" on storage.objects;
create policy "authed insert uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');
