-- Groups table — sub-groups within the camp (e.g. Builders, Kitchen, Art)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  camp_year_id uuid not null references public.camp_years(id) on delete cascade,
  name text not null,
  description text,
  lead_id uuid references public.profiles(id),
  max_members integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.groups enable row level security;

create policy "Anyone can view groups"
  on public.groups for select
  using (true);

create policy "Admins can manage groups"
  on public.groups for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create trigger groups_updated_at
  before update on public.groups
  for each row execute function public.handle_updated_at();
