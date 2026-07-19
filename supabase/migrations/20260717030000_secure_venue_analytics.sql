-- Secure Venue Analytics

-- 1. Restrict and enforce minimum threshold for live headcount
CREATE OR REPLACE FUNCTION public.get_venue_active_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE 
    WHEN active_count >= 5 THEN active_count 
    ELSE 0 
  END
  FROM (
    SELECT count(*)::integer AS active_count
    FROM (
      SELECT DISTINCT ON (player_id) player_id, event_type, created_at
      FROM public.venue_presence_events
      ORDER BY player_id, created_at DESC
    ) latest
    WHERE latest.event_type = 'enter'
      AND latest.created_at > now() - interval '3 hours'
  ) sub;
$$;

REVOKE EXECUTE ON FUNCTION public.get_venue_active_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_venue_active_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_venue_active_count() TO authenticated;

-- 2. Restrict and clamp days_back for hourly pattern
CREATE OR REPLACE FUNCTION public.get_venue_hourly_pattern(days_back integer default 7)
RETURNS table (hour_of_day integer, avg_checkins numeric)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    h.hour_of_day,
    coalesce(round(avg(daily.checkins), 1), 0) AS avg_checkins
  FROM generate_series(0, 23) AS h(hour_of_day)
  LEFT JOIN (
    SELECT
      extract(hour FROM created_at)::integer AS hour_of_day,
      date_trunc('day', created_at) AS day,
      count(*) AS checkins
    FROM public.venue_presence_events
    WHERE event_type = 'enter'
      AND created_at > now() - (LEAST(days_back, 14) || ' days')::interval
    GROUP BY 1, 2
  ) daily ON daily.hour_of_day = h.hour_of_day
  GROUP BY h.hour_of_day
  ORDER BY h.hour_of_day;
$$;

REVOKE EXECUTE ON FUNCTION public.get_venue_hourly_pattern(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_venue_hourly_pattern(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_venue_hourly_pattern(integer) TO authenticated;

-- 3. Debounce enter notifications
CREATE OR REPLACE FUNCTION public.trigger_venue_presence_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type = 'enter' THEN
    -- Prevent notification spam by ensuring they haven't received one in the last 4 hours
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE user_id = NEW.player_id 
        AND title = 'Welcome to Gymkhana!'
        AND created_at > now() - interval '4 hours'
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.player_id,
        'Welcome to Gymkhana!',
        'Tap to see today''s matches and log your games.',
        'info',
        '/hub'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
