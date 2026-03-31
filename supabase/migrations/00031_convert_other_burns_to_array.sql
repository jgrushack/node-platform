-- Convert other_burns from integer to text[] to store specific burn names + years
-- e.g. "AfrikaBurn 2023", "Midburn 2019", "Burning Man 2018"

ALTER TABLE public.profiles
  DROP COLUMN other_burns;

ALTER TABLE public.profiles
  ADD COLUMN other_burns text[] NOT NULL DEFAULT '{}';
