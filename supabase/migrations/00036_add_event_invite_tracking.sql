-- Track when calendar invites have been emailed for a NODE event so we can
-- gate the "Send invites" UI and avoid double-sending.
alter table public.node_events
  add column invites_sent_at timestamptz;
