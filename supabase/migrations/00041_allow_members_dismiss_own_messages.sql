-- Allow members to dismiss (delete) their own message_recipients row.
-- Backs the dismissMessage() server action: removing a message from your own
-- inbox must only delete YOUR recipient row, never the whole camp_messages
-- record (which would cascade-delete the message for every recipient).
CREATE POLICY "Members can dismiss own messages"
  ON public.message_recipients FOR DELETE
  USING (profile_id = auth.uid());
