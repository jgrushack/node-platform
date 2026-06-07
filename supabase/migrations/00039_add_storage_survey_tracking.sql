-- Track whether a member has answered the one-time 2026 storage survey.
-- The actual line items live in invoices.notes (JSON) when items are kept.

ALTER TABLE public.profiles
  ADD COLUMN storage_survey_completed_at timestamptz;
