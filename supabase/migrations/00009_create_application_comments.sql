-- Application comments — attributed review comments from committee members
create table public.application_comments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.application_comments enable row level security;

-- Admins can do everything with comments
create policy "Admins can manage application comments"
  on public.application_comments for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );
