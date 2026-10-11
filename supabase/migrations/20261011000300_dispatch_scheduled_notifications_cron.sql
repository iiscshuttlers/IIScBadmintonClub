-- ─────────────────────────────────────────────────────────────────────────────
-- Cron: drain the scheduled_notifications queue every 2 minutes.
-- Invokes the dispatch-scheduled-notifications edge function, which fans each
-- due (pending + scheduled_at in the past) row out to its channels and marks it
-- sent/failed. Mirrors the invoke-match-reminders job (same anon bearer).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'invoke-dispatch-scheduled-notifications',
  '*/2 * * * *',
  $$
    select net.http_post(
        url:='https://htejmhsqqlfedlajqqyv.supabase.co/functions/v1/dispatch-scheduled-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk"}'::jsonb,
        body:='{"type": "cron"}'::jsonb
    ) as request_id;
  $$
);
