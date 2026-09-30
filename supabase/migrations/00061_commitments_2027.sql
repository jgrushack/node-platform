-- What each camper said they'd do for 2027, lifted from the post-burn survey
-- onto the profile so it's visible year-round (members directory, profile).
alter table public.profiles
  add column if not exists commitments_2027 text[] not null default '{}',
  add column if not exists lead_interest_2027 text,
  add column if not exists lead_area_2027 text;

-- Backfill from the 2026 survey.
update public.profiles p
   set commitments_2027 = coalesce(
         (select array(select jsonb_array_elements_text(s.answers->'commit_2027'))
            from public.burn_surveys s
            join public.camp_years c on c.id = s.camp_year_id and c.year = 2026
           where s.profile_id = p.id), '{}'),
       lead_interest_2027 = (select s.answers->>'lead_interest'
            from public.burn_surveys s
            join public.camp_years c on c.id = s.camp_year_id and c.year = 2026
           where s.profile_id = p.id),
       lead_area_2027 = (select s.answers->>'lead_area'
            from public.burn_surveys s
            join public.camp_years c on c.id = s.camp_year_id and c.year = 2026
           where s.profile_id = p.id)
 where exists (select 1 from public.burn_surveys s where s.profile_id = p.id);
