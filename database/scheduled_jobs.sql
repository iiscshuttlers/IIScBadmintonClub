-- ============================================================
-- Scheduled Jobs via pg_cron
-- Run these in the Supabase SQL Editor ONCE to set up schedules.
-- Requires pg_cron extension: Dashboard → Extensions → Enable pg_cron
-- ============================================================

-- ── 1. Enable pg_cron (if not already) ──────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 2. Pending Match Reminder — runs every day at 9:00 AM IST (3:30 UTC) ─
-- Calls the remind-pending-matches Edge Function
SELECT cron.schedule(
  'remind-pending-matches',
  '30 3 * * *',  -- 3:30 UTC = 9:00 AM IST daily
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/remind-pending-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── 3. Weekly Digest — runs every Sunday at 8:00 PM IST (14:30 UTC) ──────
SELECT cron.schedule(
  'weekly-digest',
  '30 14 * * 0',  -- 14:30 UTC = 8:00 PM IST every Sunday
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── 4. Court Closing Reset — runs every day at 10:30 PM IST (17:00 UTC) ──
-- Resets "Playing Right Now" to "Taking a break" so forgotten statuses clear overnight
SELECT cron.schedule(
  'reset-playing-status-at-court-close',
  '0 17 * * *',  -- 17:00 UTC = 10:30 PM IST daily
  $$
  UPDATE players SET status = 'resting' WHERE status = 'playing';
  $$
);

-- ── View scheduled jobs ───────────────────────────────────────
-- SELECT * FROM cron.job;

-- ── Remove a job if needed ───────────────────────────────────
-- SELECT cron.unschedule('remind-pending-matches');
-- SELECT cron.unschedule('weekly-digest');
-- SELECT cron.unschedule('reset-playing-status-at-court-close');
