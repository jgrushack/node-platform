-- Optional birthday field (month + day only, no year)
-- Stored as "MM-DD" text to avoid exposing birth year
ALTER TABLE public.profiles
  ADD COLUMN birthday text CHECK (birthday ~ '^\d{2}-\d{2}$');
