-- Auto-import new YouTube uploads into the /legacy Videos tab.
-- The edge function sync-youtube-videos reads the channel's public RSS feed and
-- adds any upload not yet in site_data "videos"; it records each run in
-- site_data "youtube_sync". Runs hourly at :17. Deploy the function first:
--   npx supabase functions deploy sync-youtube-videos
-- No new tables or grants: site_data is already public-read / admin-write and
-- the function writes with the service role.

DO $$
BEGIN
  PERFORM cron.unschedule('invoke-sync-youtube-videos');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'invoke-sync-youtube-videos',
  '17 * * * *',
  $$
    select net.http_post(
        url:='https://htejmhsqqlfedlajqqyv.supabase.co/functions/v1/sync-youtube-videos',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk"}'::jsonb,
        body:='{"type": "cron"}'::jsonb
    ) as request_id;
  $$
);
