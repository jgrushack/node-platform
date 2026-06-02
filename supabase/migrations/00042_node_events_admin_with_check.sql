-- Harden the node_events admin policy: make the write-side check explicit.
-- The original "Admins can manage events" policy had only a USING clause; for a
-- FOR ALL policy Postgres defaults WITH CHECK to USING, but stating it
-- explicitly documents intent and guards INSERT/UPDATE row validation against
-- future edits. Ownership (created_by) is intentionally NOT enforced here so
-- super_admins can manage any event; per-event ownership is enforced in the
-- server actions (deleteNodeEvent / updateNodeEvent).
DROP POLICY IF EXISTS "Admins can manage events" ON public.node_events;

CREATE POLICY "Admins can manage events"
  ON public.node_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
