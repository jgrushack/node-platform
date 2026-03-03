-- Seed data: camp years + member profiles
-- Originally auto-generated from Excel export
-- PII (names, emails, phone numbers, passwords) REDACTED for security
-- This migration has already been applied to the production database

-- Camp years
INSERT INTO public.camp_years (id, year, name, registration_open) VALUES (gen_random_uuid(), 2018, 'NODE 2018', false) ON CONFLICT (year) DO NOTHING;
INSERT INTO public.camp_years (id, year, name, registration_open) VALUES (gen_random_uuid(), 2019, 'NODE 2019', false) ON CONFLICT (year) DO NOTHING;
INSERT INTO public.camp_years (id, year, name, registration_open) VALUES (gen_random_uuid(), 2022, 'NODE 2022', false) ON CONFLICT (year) DO NOTHING;
INSERT INTO public.camp_years (id, year, name, registration_open) VALUES (gen_random_uuid(), 2023, 'NODE 2023', false) ON CONFLICT (year) DO NOTHING;
INSERT INTO public.camp_years (id, year, name, registration_open) VALUES (gen_random_uuid(), 2024, 'NODE 2024', false) ON CONFLICT (year) DO NOTHING;
INSERT INTO public.camp_years (id, year, name, registration_open) VALUES (gen_random_uuid(), 2025, 'NODE 2025', false) ON CONFLICT (year) DO NOTHING;
INSERT INTO public.camp_years (id, year, name, registration_open) VALUES (gen_random_uuid(), 2026, 'NODE 2026', true) ON CONFLICT (year) DO NOTHING;

-- Member user accounts and profile data have been redacted from this file.
-- The original seed created auth.users entries with temporary passwords and
-- populated profiles with names, emails, phone numbers, and registration history.
-- All member data now lives only in the production database.
