-- 00052_jobs_board.sql
-- The weekly jobs board: members sign up for dated shifts during burn week.
--
-- This redesigns the original 00005 jobs/job_signups scaffolding (which was
-- never wired to any app code) into the two-layer model the camp used in
-- Notion: a catalog of JOB DEFINITIONS (title, difficulty, duration → points)
-- and dated JOB SHIFTS (instances with a capacity), plus per-member SIGNUPS.
-- A points system rewards contribution (difficulty × 30-min blocks), gated to
-- confirmed campers with a senior early-access window, all admin-configurable.
--
-- SAFETY: the dropped tables are unused scaffolding — no server action, route,
-- or component references them (only migrations + docs do). Verify they are
-- empty before applying to production.

drop table if exists public.job_signups cascade;
drop table if exists public.jobs cascade;

-- ── Catalog: reusable job definitions ────────────────────────────────
create table public.job_definitions (
  id              uuid primary key default gen_random_uuid(),
  camp_year_id    uuid not null references public.camp_years(id) on delete cascade,
  title           text not null,
  description     text,
  category        text,                                    -- 'Kitchen', 'Cleaning', …
  people_required integer not null default 1 check (people_required >= 1),
  duration_min    integer not null default 30 check (duration_min > 0),
  difficulty      integer not null default 1 check (difficulty between 0 and 10),
  -- Point value = difficulty × number of 30-minute blocks (rounded up).
  point_value     integer generated always as
                    ((difficulty * ceil(duration_min::numeric / 30))::int) stored,
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.job_definitions enable row level security;

create policy "Authenticated users can view job definitions"
  on public.job_definitions for select
  using (auth.uid() is not null);

create policy "Admins can manage job definitions"
  on public.job_definitions for all
  using (exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'super_admin')));

create trigger job_definitions_updated_at
  before update on public.job_definitions
  for each row execute function public.handle_updated_at();

-- ── Dated shift instances ────────────────────────────────────────────
create table public.job_shifts (
  id            uuid primary key default gen_random_uuid(),
  camp_year_id  uuid not null references public.camp_years(id) on delete cascade,
  definition_id uuid not null references public.job_definitions(id) on delete cascade,
  label         text,                                  -- optional, e.g. dinner theme "Taco Night"
  -- Floating playa-local date/time (no TZ), exactly like node_events: "Tue 12:00"
  -- means noon on playa for everyone, regardless of the viewer's timezone.
  shift_date    date not null,
  start_time    time not null,
  end_time      time,
  capacity      integer not null check (capacity >= 1),
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.job_shifts enable row level security;

create policy "Authenticated users can view job shifts"
  on public.job_shifts for select
  using (auth.uid() is not null);

create policy "Admins can manage job shifts"
  on public.job_shifts for all
  using (exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'super_admin')));

create index job_shifts_year_start on public.job_shifts (camp_year_id, shift_date, start_time);

create trigger job_shifts_updated_at
  before update on public.job_shifts
  for each row execute function public.handle_updated_at();

-- ── Signups ──────────────────────────────────────────────────────────
create table public.job_signups (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid not null references public.job_shifts(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (shift_id, profile_id)
);

alter table public.job_signups enable row level security;

-- Members see their own signups; cross-member rosters/leaderboard are read by
-- the service-role admin client in the action (intentional camp-wide display).
create policy "Users can view own signups"
  on public.job_signups for select
  using (auth.uid() = profile_id);

create policy "Admins can view all signups"
  on public.job_signups for select
  using (exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'super_admin')));

-- Capacity-safe inserts go through signup_for_shift() (SECURITY DEFINER); a
-- member may drop their own signup directly.
create policy "Users can drop own signups"
  on public.job_signups for delete
  using (auth.uid() = profile_id);

create policy "Admins can manage signups"
  on public.job_signups for all
  using (exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'super_admin')));

create index job_signups_profile on public.job_signups (profile_id);
create index job_signups_shift   on public.job_signups (shift_id);

-- ── Per-year board settings (signup window + early access + target) ──
create table public.job_board_settings (
  camp_year_id                 uuid primary key references public.camp_years(id) on delete cascade,
  signup_opens_at              timestamptz,                       -- NULL = open now (no gating)
  early_access_enabled         boolean not null default true,
  early_access_years_threshold integer not null default 2 check (early_access_years_threshold >= 1),
  early_access_hours           integer not null default 24 check (early_access_hours >= 0),
  points_target                integer not null default 0 check (points_target >= 0), -- 0 = no target
  updated_by                   uuid references public.profiles(id),
  updated_at                   timestamptz not null default now()
);

alter table public.job_board_settings enable row level security;

create policy "Authenticated users can view job board settings"
  on public.job_board_settings for select
  using (auth.uid() is not null);

create policy "Admins can manage job board settings"
  on public.job_board_settings for all
  using (exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'super_admin')));

create trigger job_board_settings_updated_at
  before update on public.job_board_settings
  for each row execute function public.handle_updated_at();

-- ── Atomic, gated signup ─────────────────────────────────────────────
-- Locks the shift row so concurrent last-slot claims serialize, then enforces:
--   1) confirmed 2026 registration,
--   2) signup window (with senior early-access head start), and
--   3) remaining capacity.
-- Call via the USER-scoped client so auth.uid() resolves.
create or replace function public.signup_for_shift(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_shift     record;
  v_settings  record;
  v_confirmed boolean;
  v_count     integer;
  v_years     integer;
  v_open_at   timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  -- Lock the shift so capacity checks serialize against other signups.
  select * into v_shift from public.job_shifts where id = p_shift_id for update;
  if not found then raise exception 'shift not found'; end if;

  -- Must be a confirmed camper for this shift's year.
  select exists (
    select 1 from public.registrations r
     where r.profile_id = v_uid
       and r.camp_year_id = v_shift.camp_year_id
       and r.status = 'confirmed'
  ) into v_confirmed;
  if not v_confirmed then
    raise exception 'not a confirmed camper';
  end if;

  -- Signup window + senior early access.
  select * into v_settings from public.job_board_settings
   where camp_year_id = v_shift.camp_year_id;
  if found and v_settings.signup_opens_at is not null then
    v_open_at := v_settings.signup_opens_at;
    if coalesce(v_settings.early_access_enabled, true) then
      -- NODE tenure = count of distinct non-cancelled registration years.
      select count(distinct cy.year) into v_years
        from public.registrations r
        join public.camp_years cy on cy.id = r.camp_year_id
       where r.profile_id = v_uid and r.status <> 'cancelled';
      if coalesce(v_years, 0) >= coalesce(v_settings.early_access_years_threshold, 2) then
        v_open_at := v_settings.signup_opens_at
                     - make_interval(hours => coalesce(v_settings.early_access_hours, 24));
      end if;
    end if;
    if now() < v_open_at then
      raise exception 'signups not open';
    end if;
  end if;

  -- Capacity.
  select count(*) into v_count from public.job_signups where shift_id = p_shift_id;
  if v_count >= v_shift.capacity then
    raise exception 'shift full';
  end if;

  insert into public.job_signups (shift_id, profile_id)
    values (p_shift_id, v_uid)
    on conflict (shift_id, profile_id) do nothing;
end;
$$;

revoke all on function public.signup_for_shift(uuid) from public, anon;
grant execute on function public.signup_for_shift(uuid) to authenticated, service_role;

-- ── Seed: 2026 settings + a starter catalog ──────────────────────────
-- Starter definitions so the board isn't empty; admins edit/replace these and
-- create the actual dated shifts. point_value is computed automatically.
do $$
declare v_year_id uuid;
begin
  select id into v_year_id from public.camp_years where year = 2026;
  if v_year_id is null then return; end if;

  insert into public.job_board_settings (camp_year_id) values (v_year_id)
  on conflict (camp_year_id) do nothing;

  insert into public.job_definitions
    (camp_year_id, title, category, people_required, duration_min, difficulty, sort_order)
  values
    (v_year_id, 'Dinner Prep & Cook',      'Kitchen',        4, 120, 5, 10),
    (v_year_id, 'Dinner Cleanup / Dishes', 'Kitchen',        4,  60, 3, 20),
    (v_year_id, 'Rocket Fuel Coffee',      'Kitchen',        2, 120, 4, 30),
    (v_year_id, 'MOOP Patrol',             'Cleaning',       6,  60, 4, 40),
    (v_year_id, 'Camp Tidy',               'Cleaning',       2,  30, 2, 50),
    (v_year_id, 'Greeter / Bar Shift',     'Hospitality',    2, 180, 5, 60),
    (v_year_id, 'Ice Run',                 'Infrastructure', 2,  90, 6, 70),
    (v_year_id, 'Power / Generator Check', 'Infrastructure', 1,  30, 7, 80),
    (v_year_id, 'Build Shift',             'Build',          8, 240, 8, 90),
    (v_year_id, 'Strike Shift',            'Strike',         8, 240, 8, 100);
end $$;
