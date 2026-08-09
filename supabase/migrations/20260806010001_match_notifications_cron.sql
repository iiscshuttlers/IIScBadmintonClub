-- Migration to schedule match-notifier edge function

-- We use pg_net to make HTTP requests to the edge function
-- Replace the URL with your production project URL in production.
SELECT cron.schedule(
  'invoke-match-notifier',
  '*/5 * * * *', -- Every 5 minutes for precise court timing
  $$
    select net.http_post(
        url:='https://YOUR_PROJECT_ID.supabase.co/functions/v1/match-notifier',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"type": "cron"}'::jsonb
    ) as request_id;
  $$
);

