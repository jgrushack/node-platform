-- Post-burn survey: one response per camper per camp year. Question keys and
-- answer shapes live in src/lib/survey/questions.ts; the row stores answers
-- as JSON so questions can evolve without a migration per tweak.
create table if not exists public.burn_surveys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  camp_year_id uuid not null references public.camp_years(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  -- Hide the respondent's name from admins viewing results.
  anonymous boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, camp_year_id)
);

create index if not exists burn_surveys_camp_year_idx
  on public.burn_surveys (camp_year_id);

alter table public.burn_surveys enable row level security;

create policy "Users read own survey"
  on public.burn_surveys for select
  using (auth.uid() = profile_id);

create policy "Users insert own survey"
  on public.burn_surveys for insert
  with check (auth.uid() = profile_id);

create policy "Users update own survey"
  on public.burn_surveys for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Admins read all surveys"
  on public.burn_surveys for select
  using (public.is_admin());
