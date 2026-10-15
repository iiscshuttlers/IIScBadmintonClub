-- Captain lineup-deadline reminders (team events). The edge function
-- lineup-deadline-reminders runs every 5 minutes; this table makes each
-- (tie, side, 60/15-minute bucket) reminder fire once.

CREATE TABLE IF NOT EXISTS public.lineup_deadline_alerts (
  tie_id     uuid NOT NULL REFERENCES public.tournament_ties(id) ON DELETE CASCADE,
  side       text NOT NULL CHECK (side IN ('A', 'B')),
  threshold  smallint NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tie_id, side, threshold)
);

ALTER TABLE public.lineup_deadline_alerts ENABLE ROW LEVEL SECURITY;  -- service role only

DO $$
BEGIN
  PERFORM cron.unschedule('invoke-lineup-deadline-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'invoke-lineup-deadline-reminders',
  '*/5 * * * *',
  $$
    select net.http_post(
        url:='https://htejmhsqqlfedlajqqyv.supabase.co/functions/v1/lineup-deadline-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk"}'::jsonb,
        body:='{"type": "cron"}'::jsonb
    ) as request_id;
  $$
);
