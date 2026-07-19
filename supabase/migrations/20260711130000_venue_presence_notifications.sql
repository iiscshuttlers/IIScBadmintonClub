-- Trigger to automatically create a notification when a user enters the Gymkhana venue geofence.

CREATE OR REPLACE FUNCTION public.trigger_venue_presence_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.event_type = 'enter' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.player_id,
      'Welcome to Gymkhana!',
      'Tap to see today''s matches and log your games.',
      'info',
      '/hub'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venue_presence_notification_trigger ON public.venue_presence_events;
CREATE TRIGGER venue_presence_notification_trigger
AFTER INSERT ON public.venue_presence_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_venue_presence_notification();
