-- WC-05: make queued match notifications revision-addressable and expirable.
-- Older queue rows had no event identity, so a delayed schedule alert could be
-- sent after a newer court/time revision had already superseded it.

ALTER TABLE public.scheduled_notifications
  ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS event_version BIGINT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_event_type_valid;
ALTER TABLE public.scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_event_type_valid
  CHECK (event_type IS NULL OR event_type IN ('match_call', 'schedule_change', 'result'));

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_notifications_authoritative_event_uidx
  ON public.scheduled_notifications (match_id, event_type, event_version, recipient_ids)
  WHERE match_id IS NOT NULL AND event_type IS NOT NULL AND event_version IS NOT NULL;

CREATE INDEX IF NOT EXISTS scheduled_notifications_expiry_idx
  ON public.scheduled_notifications (expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

-- Pre-WC-05 schedule rows cannot be tied safely to a revision. Quarantine only
-- canonical schedule-update rows; announcements and other legacy jobs remain.
UPDATE public.scheduled_notifications
SET status = 'cancelled',
    error = 'Superseded: legacy schedule alert has no revision identity'
WHERE status = 'pending'
  AND title LIKE '%Schedule Update:%'
  AND link ~ '^/tournaments/[^/]+/matches/[^/]+$';

CREATE OR REPLACE FUNCTION public.stamp_authoritative_notification_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery public.delivered_targeted_alerts%ROWTYPE;
  v_recipient UUID;
BEGIN
  IF NEW.channels <> ARRAY['push']::TEXT[]
     OR cardinality(NEW.recipient_ids) <> 1
     OR NEW.link !~ '^/tournaments/[^/]+/matches/[^/]+$' THEN
    RETURN NEW;
  END IF;

  v_recipient := NEW.recipient_ids[1];
  SELECT d.* INTO v_delivery
  FROM public.delivered_targeted_alerts d
  JOIN public.tournament_matches m ON m.id = d.match_id
  WHERE d.user_id = v_recipient
    AND d.channel = 'in_app'
    AND format('/tournaments/%s/matches/%s', m.tournament_id, m.id) = NEW.link
    AND d.created_at >= now() - interval '5 minutes'
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.match_id := v_delivery.match_id;
  NEW.event_type := v_delivery.event_type;
  NEW.event_version := v_delivery.event_version;
  NEW.expires_at := CASE v_delivery.event_type
    WHEN 'match_call' THEN now() + interval '10 minutes'
    WHEN 'schedule_change' THEN now() + interval '30 minutes'
    WHEN 'result' THEN now() + interval '24 hours'
    ELSE now() + interval '30 minutes'
  END;

  IF v_delivery.event_type = 'schedule_change' THEN
    UPDATE public.scheduled_notifications
    SET status = 'cancelled',
        error = format('Superseded by schedule revision %s', v_delivery.event_version)
    WHERE match_id = v_delivery.match_id
      AND event_type = 'schedule_change'
      AND recipient_ids = NEW.recipient_ids
      AND status = 'pending'
      AND event_version < v_delivery.event_version;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_authoritative_notification_queue_trigger
  ON public.scheduled_notifications;
CREATE TRIGGER stamp_authoritative_notification_queue_trigger
BEFORE INSERT ON public.scheduled_notifications
FOR EACH ROW
EXECUTE FUNCTION public.stamp_authoritative_notification_queue();

REVOKE ALL ON FUNCTION public.stamp_authoritative_notification_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_authoritative_notification_queue() TO service_role;

