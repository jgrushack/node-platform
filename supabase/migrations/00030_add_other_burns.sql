-- Add other_burns count to profiles
-- Tracks how many times a member has been to Burning Man (or regionals)
-- outside of NODE. Total burns = NODE registration count + other_burns.
ALTER TABLE public.profiles
  ADD COLUMN other_burns integer NOT NULL DEFAULT 0;
