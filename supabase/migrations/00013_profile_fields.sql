-- Add instagram, skills tags, and node events attended to profiles
ALTER TABLE public.profiles
  ADD COLUMN instagram text,
  ADD COLUMN skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN node_events_attended text[] NOT NULL DEFAULT '{}';
