-- "You're up next" court-queue alerts.
-- notify-up-next (edge function) runs every minute; for each court with a live
-- tournament match it alerts the players 1 and 2 places down the queue.
-- This table makes each (match, player, position) alert fire at most once.

CREATE TABLE IF NOT EXISTS public.court_queue_alerts (
  match_id  uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL,
  position  smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  sent_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id, position)
);

CREATE INDEX IF NOT EXISTS court_queue_alerts_sent_at_idx ON public.court_queue_alerts (sent_at);

-- Service role only (the edge function). No client access needed.
ALTER TABLE public.court_queue_alerts ENABLE ROW LEVEL SECURITY;

-- Partial index so the every-minute "anything live?" probe stays cheap.
CREATE INDEX IF NOT EXISTS tournament_matches_live_court_idx
  ON public.tournament_matches (tournament_id)
  WHERE status IN ('in_progress', 'playing', 'live', 'ongoing') AND court_number IS NOT NULL;

DO $$
BEGIN
  PERFORM cron.unschedule('invoke-notify-up-next');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'invoke-notify-up-next',
  '* * * * *',
  $$
    select net.http_post(
        url:='https://htejmhsqqlfedlajqqyv.supabase.co/functions/v1/notify-up-next',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk"}'::jsonb,
        body:='{"type": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- Housekeeping: alert rows are only needed while a tournament runs.
DO $$
BEGIN
  PERFORM cron.unschedule('purge-court-queue-alerts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-court-queue-alerts',
  '30 3 * * *',
  $$ DELETE FROM public.court_queue_alerts WHERE sent_at < now() - interval '14 days'; $$
);
