-- Google Calendar integration (A2: OAuth a dedicated Google account).
-- Map NODE events to their Google Calendar event, and store the connected
-- account's OAuth refresh token.

ALTER TABLE public.node_events
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_html_link text;

-- Single-row config holding the OAuth refresh token for the camp Google account.
-- The refresh token is a secret: RLS is enabled with NO policies, so only the
-- service-role key (server-side) can read or write it.
CREATE TABLE IF NOT EXISTS public.google_calendar_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  account_email text,
  refresh_token text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  connected_by uuid REFERENCES public.profiles(id),
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_config ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies — service-role access only.
