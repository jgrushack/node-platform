-- Applications — public apply form submissions
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  camp_year_id uuid references public.camp_years(id),
  -- Applicant info (may not have an account yet)
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  playa_name text,
  -- Application content
  years_attended text,
  previous_camps text,
  skills text,
  why_node text,
  contribution text,
  dietary_restrictions text,
  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'waitlist')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  -- Link to profile if they later create an account
  profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.applications enable row level security;

-- Anyone can submit an application (anon insert)
create policy "Anyone can submit application"
  on public.applications for insert
  with check (true);

-- Users can view their own application by email match
create policy "Users can view own applications"
  on public.applications for select
  using (
    profile_id = auth.uid()
    or email = (select email from public.profiles where id = auth.uid())
  );

create policy "Admins can manage applications"
  on public.applications for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.handle_updated_at();
