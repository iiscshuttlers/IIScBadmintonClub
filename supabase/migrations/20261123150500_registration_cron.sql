-- In-app registration: schedule the two queue functions (Migration C bodies).
-- Apply LAST, after the dispatcher that understands event_type 'registration'
-- is deployed. Both functions do nothing unless a tournament has
-- require_app_registration AND auto_reminders_enabled.
--   * hourly: 24 h-before-deadline reminders (once per player per deadline)
--   * 14:30 UTC = 8 PM IST: the organisers' evening summary

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('registration-deadline-reminders', 'registration-daily-summary', 'registration-backup-digest');
END $$;

SELECT cron.schedule('registration-deadline-reminders', '7 * * * *',
  $$SELECT public.queue_registration_deadline_reminders()$$);
SELECT cron.schedule('registration-daily-summary', '30 14 * * *',
  $$SELECT public.queue_registration_daily_summary()$$);
-- 20:05 IST: queue the day's CSV digest for the club inbox (the dispatcher sends it).
SELECT cron.schedule('registration-backup-digest', '35 14 * * *',
  $$SELECT public.queue_registration_backup_digest()$$);
