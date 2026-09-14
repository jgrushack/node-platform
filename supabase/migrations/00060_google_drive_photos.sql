-- Google Drive photo uploads: the app uploads campers' photos straight into
-- the communal NODE Photos Drive, one folder per camper under the year folder.
--
-- Uploads act as a single connected Google account (ideally the account that
-- OWNS the photo folder, so files land in its quota) authorized once via
-- OAuth — same pattern as google_calendar_config.
create table if not exists public.google_drive_config (
  id boolean primary key default true check (id),
  account_email text,
  refresh_token text not null,
  -- Drive folder that holds the per-camper folders for the current year.
  year_folder_id text not null,
  year_folder_name text,
  connected_by uuid references public.profiles(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.google_drive_config enable row level security;
-- Intentionally no policies — refresh token is a secret; service-role only.

-- Ledger of what each camper pushed to Drive through the site (drives the
-- "you've uploaded N photos" nudge and future categorization).
create table if not exists public.drive_uploads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  camp_year_id uuid not null references public.camp_years(id) on delete cascade,
  drive_file_id text not null unique,
  drive_folder_id text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists drive_uploads_profile_idx on public.drive_uploads (profile_id, camp_year_id);
alter table public.drive_uploads enable row level security;

create policy "Users read own drive uploads"
  on public.drive_uploads for select
  using (auth.uid() = profile_id);
create policy "Admins read all drive uploads"
  on public.drive_uploads for select
  using (public.is_admin());
-- Inserts happen server-side (service role) after Google confirms the file.
