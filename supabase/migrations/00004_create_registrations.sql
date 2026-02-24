-- Registrations — one per user per camp year (unique)
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  camp_year_id uuid not null references public.camp_years(id) on delete cascade,
  group_id uuid references public.groups(id),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'waitlisted', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (profile_id, camp_year_id)
);

-- RLS
alter table public.registrations enable row level security;

create policy "Users can view own registrations"
  on public.registrations for select
  using (auth.uid() = profile_id);

create policy "Users can create own registration"
  on public.registrations for insert
  with check (auth.uid() = profile_id);

create policy "Admins can manage all registrations"
  on public.registrations for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create trigger registrations_updated_at
  before update on public.registrations
  for each row execute function public.handle_updated_at();
