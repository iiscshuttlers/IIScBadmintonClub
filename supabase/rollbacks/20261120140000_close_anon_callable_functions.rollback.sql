-- Rollback for 20261120140000_close_anon_callable_functions.sql
-- Restores the definitions and grants production had on 2026-11-20.
-- Run inside BEGIN/COMMIT, then:
--   npx --no-install supabase migration repair --status reverted 20261120140000 --remote --yes

-- 1. match alerts
ALTER FUNCTION public.trigger_tournament_match_authoritative_alert()
  SECURITY INVOKER
  RESET search_path;
GRANT EXECUTE ON FUNCTION public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint) TO anon, authenticated;

-- 2. certificates
GRANT EXECUTE ON FUNCTION public.issue_certificate(uuid, text, text, text, text, text, text) TO PUBLIC, anon;

-- 3. site-wide match alert: both overloads, no role check, no search_path
CREATE OR REPLACE FUNCTION public.push_match_alert(p_message text, p_title text DEFAULT '🏸 Live Match Score'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('match_alert', jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000))
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000);
END;
$function$;
ALTER FUNCTION public.push_match_alert(text, text) RESET search_path;
GRANT EXECUTE ON FUNCTION public.push_match_alert(text, text) TO PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.push_match_alert(p_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('match_alert', jsonb_build_object('message', p_message, 'time', extract(epoch from now()) * 1000))
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('message', p_message, 'time', extract(epoch from now()) * 1000);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.push_match_alert(text) TO PUBLIC, anon, authenticated, service_role;

-- 4. pings with the caller-supplied name
CREATE OR REPLACE FUNCTION public.send_ping_notification(p_target_id uuid, p_sender_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF auth.uid() = p_target_id THEN RAISE EXCEPTION 'Cannot ping yourself'; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    p_target_id,
    'Match Request (Ping)!',
    p_sender_name || ' is looking to play a match with you!',
    'ping',
    '/player/' || auth.uid()
  );
END;
$function$;
ALTER FUNCTION public.send_ping_notification(uuid, text) RESET search_path;
GRANT EXECUTE ON FUNCTION public.send_ping_notification(uuid, text) TO anon;

-- 5 and the rest
GRANT EXECUTE ON FUNCTION public.process_tournament_bracket_progression(uuid, uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cron_health() TO anon;
GRANT EXECUTE ON FUNCTION public.admin_notification_delivery(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.fulfill_marketplace_request(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_player_endorsement(uuid, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_player_role(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_tournament_walkover(uuid, smallint, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.recalculate_all_elo() TO anon;
GRANT EXECUTE ON FUNCTION public.recalculate_tournament_elo() TO anon;
