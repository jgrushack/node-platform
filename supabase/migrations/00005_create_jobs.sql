-- Jobs table — shifts / volunteer roles
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  camp_year_id uuid not null references public.camp_years(id) on delete cascade,
  title text not null,
  description text,
  category text, -- e.g. Infrastructure, Food, Art, Community
  location text,
  shift text, -- e.g. "Mon AM", "Tue PM"
  slots integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Job signups — members signing up for shifts
create table public.job_signups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'signed_up'
    check (status in ('signed_up', 'completed', 'no_show', 'cancelled')),
  created_at timestamptz not null default now(),

  unique (job_id, profile_id)
);

-- RLS
alter table public.jobs enable row level security;
alter table public.job_signups enable row level security;

create policy "Anyone can view jobs"
  on public.jobs for select
  using (true);

create policy "Admins can manage jobs"
  on public.jobs for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create policy "Users can view own signups"
  on public.job_signups for select
  using (auth.uid() = profile_id);

create policy "Users can sign up for jobs"
  on public.job_signups for insert
  with check (auth.uid() = profile_id);

create policy "Users can cancel own signups"
  on public.job_signups for update
  using (auth.uid() = profile_id);

create policy "Admins can manage all signups"
  on public.job_signups for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.handle_updated_at();
