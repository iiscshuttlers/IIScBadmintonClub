-- ─────────────────────────────────────────────────────────────────────────────
-- Admin delivery audit — surface push/cron health in /admin so silent breakage
-- of the scheduled jobs (send-match-reminders, dispatch-scheduled-notifications,
-- batch-notifications, …) is visible instead of invisible.
--
-- Two admin-only, SECURITY DEFINER read functions:
--   • admin_cron_health()          — per pg_cron job: schedule, active flag, and
--                                     its most recent run + a 24h run/failure
--                                     tally (did the job FIRE on time?).
--   • admin_notification_delivery() — status breakdown of the
--                                     scheduled_notifications queue over a window
--                                     (did messages actually SEND?).
--
-- Both guard on is_admin_or_master() and degrade to an empty result if the
-- `cron` schema is unavailable (e.g. local dev without pg_cron) rather than
-- erroring — the panel treats empty as "no data".
-- ─────────────────────────────────────────────────────────────────────────────

-- Did the scheduled jobs fire? Reads pg_cron's own bookkeeping.
-- NOTE: a "succeeded" run means the SQL (net.http_post) executed and the HTTP
-- request was queued — not that the edge function returned 200. It still
-- reliably catches a job that stopped running, was unscheduled, or is erroring
-- at the SQL level.
CREATE OR REPLACE FUNCTION public.admin_cron_health()
RETURNS TABLE (
  jobname           text,
  schedule          text,
  active            boolean,
  last_status       text,
  last_start        timestamptz,
  last_end          timestamptz,
  last_duration_sec numeric,
  last_message      text,
  runs_24h          bigint,
  failures_24h      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
BEGIN
  IF NOT is_admin_or_master() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  BEGIN
    RETURN QUERY
    SELECT
      j.jobname::text,
      j.schedule::text,
      j.active,
      d.status::text,
      d.start_time,
      d.end_time,
      ROUND(EXTRACT(EPOCH FROM (d.end_time - d.start_time))::numeric, 2),
      d.return_message::text,
      COALESCE(c.runs, 0),
      COALESCE(c.fails, 0)
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT r.status, r.start_time, r.end_time, r.return_message
      FROM cron.job_run_details r
      WHERE r.jobid = j.jobid
      ORDER BY r.start_time DESC
      LIMIT 1
    ) d ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS runs,
        COUNT(*) FILTER (WHERE r.status <> 'succeeded') AS fails
      FROM cron.job_run_details r
      WHERE r.jobid = j.jobid
        AND r.start_time > now() - INTERVAL '24 hours'
    ) c ON TRUE
    ORDER BY j.jobname;
  EXCEPTION WHEN OTHERS THEN
    -- cron schema not present / not readable → no rows.
    RETURN;
  END;
END;
$$;

-- Did messages actually send? Status breakdown of the dispatch queue.
CREATE OR REPLACE FUNCTION public.admin_notification_delivery(days_back integer DEFAULT 7)
RETURNS TABLE (status text, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_or_master() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT sn.status::text, COUNT(*)::bigint
  FROM public.scheduled_notifications sn
  WHERE sn.created_at > now() - make_interval(days => days_back)
  GROUP BY sn.status
  ORDER BY COUNT(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cron_health() FROM public;
REVOKE ALL ON FUNCTION public.admin_notification_delivery(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_cron_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_notification_delivery(integer) TO authenticated;
