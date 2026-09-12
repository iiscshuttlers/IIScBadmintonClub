-- Create cron job to invoke send-match-reminders edge function every 5 minutes
SELECT cron.schedule(
  'invoke-match-reminders',
  '*/5 * * * *',
  $$
    select net.http_post(
        url:='https://htejmhsqqlfedlajqqyv.supabase.co/functions/v1/send-match-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk"}'::jsonb,
        body:='{"type": "cron"}'::jsonb
    ) as request_id;
  $$
);
