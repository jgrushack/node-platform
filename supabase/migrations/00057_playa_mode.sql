-- On-playa mode for the jobs board + "ready" celebration tracking.

-- Board mode: 'auto' derives prep/live/closed from camp_years dates;
-- admins can force a mode.
alter table public.job_board_settings
  add column if not exists board_mode text not null default 'auto'
    check (board_mode in ('auto', 'prep', 'live', 'closed')),
  add column if not exists drop_lock_at timestamptz;   -- NULL = drops always allowed

-- Attendance tracking on playa (marked by leads/admins or self check-in).
alter table public.job_signups
  add column if not exists checked_in_at timestamptz,
  add column if not exists no_show boolean not null default false,
  add column if not exists checked_in_by uuid references public.profiles(id);

-- Members may self check-in on their own signup (only checked_in_at).
create policy "Users can check in to own signups"
  on public.job_signups for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- When a camper first completed the Road to 2026 checklist (drives the
-- one-time celebration + "You're locked in" email).
alter table public.registrations
  add column if not exists ready_at timestamptz;

-- 2026 camp dates (Burning Man 2026: gates Sun Aug 30 → Mon Sep 7).
update public.camp_years
  set start_date = '2026-08-30', end_date = '2026-09-07'
  where year = 2026 and start_date is null;
