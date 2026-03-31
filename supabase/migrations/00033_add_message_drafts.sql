-- Add draft/sent status to camp_messages and track last editor
ALTER TABLE public.camp_messages
  ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  ADD COLUMN updated_by uuid REFERENCES public.profiles(id),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill: existing messages were all sent (no drafts existed before)
UPDATE public.camp_messages SET status = 'sent' WHERE recipient_count > 0;
