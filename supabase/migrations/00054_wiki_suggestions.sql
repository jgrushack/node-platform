-- 00054_wiki_suggestions.sql
-- Review suggestions for the members wiki. Each logged-in member can leave a
-- comment, propose an edit, or suggest deleting a wiki page; leads triage them
-- in the review panel (open -> resolved).
--
-- SAFETY: additive and isolated. Creates one new table + policies + indexes.
-- No existing table, policy, or function is altered or dropped.

create table if not exists public.wiki_suggestions (
  id             uuid primary key default gen_random_uuid(),
  page_slug      text not null,
  page_title     text not null,
  section_title  text,
  kind           text not null check (kind in ('comment', 'edit', 'delete')),
  body           text,                 -- comment text / delete reason / edit rationale
  selected_text  text,                 -- (edit) the passage to change
  suggested_text text,                 -- (edit) proposed replacement
  status         text not null default 'open' check (status in ('open', 'resolved')),
  author_id      uuid references public.profiles(id) on delete set null,
  author_name    text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references public.profiles(id) on delete set null
);

alter table public.wiki_suggestions enable row level security;

-- Members-only review tool: any authenticated user may read all suggestions,
-- add their own, and toggle status while triaging.
create policy "Authenticated can view wiki suggestions"
  on public.wiki_suggestions for select
  using (auth.uid() is not null);

create policy "Authenticated can add wiki suggestions"
  on public.wiki_suggestions for insert
  with check (auth.uid() = author_id);

create policy "Authenticated can update wiki suggestions"
  on public.wiki_suggestions for update
  using (auth.uid() is not null);

create policy "Authors or admins can delete wiki suggestions"
  on public.wiki_suggestions for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles
               where id = auth.uid() and role in ('admin', 'super_admin'))
  );

create index wiki_suggestions_page   on public.wiki_suggestions (page_slug);
create index wiki_suggestions_status on public.wiki_suggestions (status, created_at desc);
