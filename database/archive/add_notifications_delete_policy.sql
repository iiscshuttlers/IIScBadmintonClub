-- Allow users to clear (delete) their notifications from the in-app bell menu.
-- Mirrors the existing permissive USING (true) pattern used by the other
-- notifications policies in challenges_and_notifications.sql.

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE USING (true);
