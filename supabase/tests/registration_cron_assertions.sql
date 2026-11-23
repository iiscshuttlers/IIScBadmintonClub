-- Registration cron (20261123150500): both jobs exist with the right schedule and bodies.
DO $$
BEGIN
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'registration-deadline-reminders' AND schedule = '7 * * * *'
        AND command LIKE '%queue_registration_deadline_reminders()%') <> 1 THEN
    RAISE EXCEPTION 'FAIL deadline reminder job missing';
  END IF;
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'registration-daily-summary' AND schedule = '30 14 * * *'
        AND command LIKE '%queue_registration_daily_summary()%') <> 1 THEN
    RAISE EXCEPTION 'FAIL daily summary job missing';
  END IF;
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'registration-backup-digest' AND schedule = '35 14 * * *'
        AND command LIKE '%queue_registration_backup_digest()%') <> 1 THEN
    RAISE EXCEPTION 'FAIL backup digest job missing';
  END IF;
  -- The digest is queued once per IST day, only when something was backed up.
  DELETE FROM public.tournament_backup_digests;
  IF EXISTS (SELECT 1 FROM public.tournament_backup_outbox WHERE created_at > now() - interval '24 hours') THEN
    RAISE NOTICE 'live backup rows present; skipping empty-day check';
  ELSIF public.queue_registration_backup_digest() <> 0 THEN
    RAISE EXCEPTION 'FAIL digest queued with nothing to send';
  END IF;
  INSERT INTO public.tournament_backup_outbox (event_id, tournament_id)
  SELECT public.reg_log_event(t.id, 'MS', NULL, 'entered', '{}', NULL, '{}'::jsonb, false), t.id
    FROM public.tournaments t ORDER BY t.created_at DESC LIMIT 1;
  IF public.queue_registration_backup_digest() <> 1 THEN RAISE EXCEPTION 'FAIL digest not queued'; END IF;
  IF public.queue_registration_backup_digest() <> 0 THEN RAISE EXCEPTION 'FAIL digest queued twice'; END IF;
  IF has_table_privilege('authenticated', 'public.tournament_backup_digests', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL clients can read the digest log';
  END IF;
  -- The bodies run cleanly on today's data (no tournament has the flag + auto reminders on).
  PERFORM public.queue_registration_deadline_reminders();
  PERFORM public.queue_registration_daily_summary();
END $$;
SELECT 'registration_cron_assertions: passed' AS result;
