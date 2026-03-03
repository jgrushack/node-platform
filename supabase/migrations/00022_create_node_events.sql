-- Node events — camp calls, events, deadlines
create table public.node_events (
  id uuid primary key default gen_random_uuid(),
  camp_year_id uuid not null references public.camp_years(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null check (event_type in ('call', 'event', 'deadline')),
  event_date date not null,
  start_time time,
  end_time time,
  join_link text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.node_events enable row level security;

create policy "Authenticated users can view events"
  on public.node_events for select
  using (auth.uid() is not null);

create policy "Admins can manage events"
  on public.node_events for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

-- Auto-update updated_at
create trigger node_events_updated_at
  before update on public.node_events
  for each row execute function public.handle_updated_at();
