-- Create notification_queue table for batch-notifications edge function
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ
);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all queued notifications"
ON public.notification_queue
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
  )
);

-- Grant permissions for authenticated/anon? No, Edge Function runs as service_role.
-- Just grant standard
GRANT ALL ON TABLE public.notification_queue TO authenticated;
GRANT ALL ON TABLE public.notification_queue TO service_role;

-- 1. Tournament Match Status Changes (Completed, Started)
CREATE OR REPLACE FUNCTION enqueue_tournament_match_notifications()
RETURNS TRIGGER AS $$
DECLARE
  recipients UUID[];
  recipient UUID;
  match_title TEXT;
  match_body TEXT;
BEGIN
  -- We only care about status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Gather players involved
    recipients := ARRAY(
      SELECT DISTINCT pid
      FROM unnest(ARRAY[
        NEW.player1_id,
        NEW.player2_id,
        NEW.player3_id,
        NEW.player4_id
      ]) AS pid
      WHERE pid IS NOT NULL
    );

    IF NEW.status = 'live' THEN
      match_title := '🏸 Match Started!';
      match_body := 'Your match ' || NEW.match_code || ' has officially started on the court. Good luck!';
    ELSIF NEW.status = 'completed' THEN
      match_title := '🏅 Match Completed';
      match_body := 'The result for your match ' || NEW.match_code || ' has been recorded.';
    ELSE
      RETURN NEW; -- No push for other statuses
    END IF;

    -- Enqueue push for all players
    FOREACH recipient IN ARRAY recipients LOOP
      INSERT INTO public.notification_queue (player_id, title, body)
      VALUES (recipient, match_title, match_body);
    END LOOP;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enqueue_match_notifications ON public.tournament_matches;
CREATE TRIGGER trg_enqueue_match_notifications
  AFTER UPDATE OF status ON public.tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_tournament_match_notifications();

-- Clean up broken cron from previous migration if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule('invoke-match-notifier');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if cron schema doesn't exist
END $$;



