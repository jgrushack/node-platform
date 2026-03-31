-- Camp messaging system: admin email blasts + in-app notifications

-- Messages table
CREATE TABLE public.camp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body_html text NOT NULL,
  audience_filter jsonb NOT NULL DEFAULT '{}',
  sent_by uuid NOT NULL REFERENCES public.profiles(id),
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-recipient tracking
CREATE TABLE public.message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.camp_messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_sent boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, profile_id)
);

-- Indexes
CREATE INDEX idx_message_recipients_profile ON public.message_recipients(profile_id);
CREATE INDEX idx_message_recipients_unread ON public.message_recipients(profile_id) WHERE read_at IS NULL;
CREATE INDEX idx_camp_messages_sent_at ON public.camp_messages(sent_at DESC);

-- RLS
ALTER TABLE public.camp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with messages
CREATE POLICY "Admins can manage messages"
  ON public.camp_messages FOR ALL
  USING (public.is_admin());

-- Members can read messages sent to them (via join)
CREATE POLICY "Members can read their messages"
  ON public.camp_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.message_recipients
      WHERE message_recipients.message_id = camp_messages.id
      AND message_recipients.profile_id = auth.uid()
    )
  );

-- Admins can manage all recipient rows
CREATE POLICY "Admins can manage recipients"
  ON public.message_recipients FOR ALL
  USING (public.is_admin());

-- Members can read their own recipient rows
CREATE POLICY "Members can read own recipient rows"
  ON public.message_recipients FOR SELECT
  USING (profile_id = auth.uid());

-- Members can update their own rows (to mark read)
CREATE POLICY "Members can mark own messages read"
  ON public.message_recipients FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
