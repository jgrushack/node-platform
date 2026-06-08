-- Arrival / departure dates for the "Road to 2026" checklist + arrival modal.
-- Additive only — safe to apply ahead of the client deploy.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS arrival_date date,
  ADD COLUMN IF NOT EXISTS departure_date date;
