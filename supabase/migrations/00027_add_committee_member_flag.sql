-- Add is_committee_member boolean flag to profiles
-- Committee membership is now independent of role:
-- a member, lead, admin, or super_admin can all be committee members
ALTER TABLE public.profiles
  ADD COLUMN is_committee_member boolean NOT NULL DEFAULT false;

-- Backfill: anyone currently with role='committee' gets the flag set
UPDATE public.profiles
  SET is_committee_member = true
  WHERE role = 'committee';

-- Note: we do NOT change existing roles or remove 'committee' from the enum.
-- Existing committee-role users keep their role for now.
-- Going forward, committee access is checked via is_committee_member, not role.
