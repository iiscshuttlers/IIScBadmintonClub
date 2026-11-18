-- Rollback for 20261115130000_notification_identity_expiry.sql
-- Removes the queue-stamping trigger and the four identity/expiry columns.
--
-- Not restored: rows the migration cancelled as legacy schedule alerts. When it
-- was applied to production on 2026-11-18 no pending row matched, so there is
-- nothing to put back.
--
-- Deploy order: the dispatch-scheduled-notifications edge function in the repo
-- selects match_id, event_type, event_version and expires_at. If that version
-- is deployed, roll it back first, or every dispatch run will fail.
--
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261115130000 --linked --yes
BEGIN;

DROP TRIGGER IF EXISTS stamp_authoritative_notification_queue_trigger
  ON public.scheduled_notifications;
DROP FUNCTION IF EXISTS public.stamp_authoritative_notification_queue();

DROP INDEX IF EXISTS public.scheduled_notifications_expiry_idx;
DROP INDEX IF EXISTS public.scheduled_notifications_authoritative_event_uidx;

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_event_type_valid;

ALTER TABLE public.scheduled_notifications
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS event_version,
  DROP COLUMN IF EXISTS event_type,
  DROP COLUMN IF EXISTS match_id;

COMMIT;
