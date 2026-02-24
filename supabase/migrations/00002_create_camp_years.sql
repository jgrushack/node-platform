-- Camp years table — one row per year NODE participates
create table public.camp_years (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  name text, -- e.g. "NODE 2025"
  theme text,
  dues_amount_cents integer not null default 0,
  max_members integer,
  registration_open boolean not null default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.camp_years enable row level security;

create policy "Anyone can view camp years"
  on public.camp_years for select
  using (true);

create policy "Admins can manage camp years"
  on public.camp_years for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create trigger camp_years_updated_at
  before update on public.camp_years
  for each row execute function public.handle_updated_at();
