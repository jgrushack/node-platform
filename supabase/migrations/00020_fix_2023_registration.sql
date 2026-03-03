-- Remove incorrect 2023 registration for a member
DELETE FROM public.registrations
WHERE profile_id = (
  SELECT id FROM public.profiles WHERE email = 'redacted@example.com'
)
AND camp_year_id = (
  SELECT id FROM public.camp_years WHERE year = 2023
);
