-- Close database functions that signed-out visitors (and, for some, any
-- member) could call through /rest/v1/rpc.
--
-- Supabase grants anon and authenticated EXECUTE on every new function.
-- Earlier migrations revoked that for these SECURITY DEFINER functions
-- (20260726000005, 20260726000006, 20260726000009, 20260819000002,
-- 20261014120000, 20261113170000), but on 2026-11-20 production still let
-- anon execute every one of them. Five were real holes:
--
-- 1. dispatch_authoritative_match_alert(match, type, title, body, version)
--    does not check its caller. It writes an in-app notification and queues a
--    phone push, with the given title and body, for a match's players and
--    everyone following them or the tournament. 20261113170000 and
--    docs/decisions/wp9-following-and-targeted-push-alerts.md make it
--    service-role only, yet anyone could call it. Its callers are the
--    call-to-court edge function (service role) and
--    trigger_tournament_match_authoritative_alert, which ran with the rights
--    of whoever updated the match. That trigger function only reads NEW/OLD,
--    so it becomes SECURITY DEFINER and umpires' result and schedule alerts
--    keep working once anon and authenticated lose EXECUTE.
-- 2. issue_certificate(...) let a signed-out caller mint a certificate with
--    a working verification code (user_id NULL). Signed-in users keep it;
--    CertificateDialog already draws the certificate without a code when
--    issuing fails.
-- 3. push_match_alert(message[, title]) let any signed-in member set the
--    site-wide match_alert that every open app shows. Writing site_data
--    directly is limited to admins and umpires; the function now also lets in
--    only admins, umpires, and the hosts and officials of a tournament that is
--    not in the trash (umpire consoles for assigned officials). The
--    one-argument overload is dropped: with both overloads, a call naming only
--    p_message (what the app sends) matched both and failed as ambiguous, so
--    the alert never went out through this function. Older apps now reach the
--    two-argument version through its default title.
-- 4. send_ping_notification(target, sender_name) put the caller-supplied
--    sender name in the ping, so a member could ping someone as anyone else.
--    The name and profile link now come from the caller's own player row; the
--    parameter stays for older apps and is ignored.
-- 5. process_tournament_bracket_progression(match, winner) advanced a match's
--    winner for anyone, signed in or not. Its callers (submit_tournament_match,
--    admin_edit_tournament_match) are SECURITY DEFINER; signed-in users keep
--    EXECUTE for older apps.
--
-- The others already refuse a caller without the right sign-in or role; they
-- only lose the anon grant their migrations meant to remove:
-- admin_cron_health, admin_notification_delivery, fulfill_marketplace_request,
-- upsert_player_endorsement, set_player_role, record_tournament_walkover,
-- recalculate_all_elo, recalculate_tournament_elo. Every caller of these
-- functions inside the database is SECURITY DEFINER, and none is used in a
-- policy.
--
-- Rollback: supabase/rollbacks/20261120140000_close_anon_callable_functions.rollback.sql

-- ---------- 1. match alerts: service role and the match trigger only ----------
ALTER FUNCTION public.trigger_tournament_match_authoritative_alert()
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp';

REVOKE ALL ON FUNCTION public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint)
  TO service_role;

-- ---------- 2. certificates: signed-in only ----------
REVOKE EXECUTE ON FUNCTION public.issue_certificate(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_certificate(uuid, text, text, text, text, text, text) TO authenticated, service_role;

-- ---------- 3. site-wide match alert: admins, umpires, hosts, officials ----------
DROP FUNCTION IF EXISTS public.push_match_alert(text);

CREATE OR REPLACE FUNCTION public.push_match_alert(p_message text, p_title text DEFAULT '🏸 Live Match Score'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  IF NOT (public.is_admin_or_umpire()
          OR EXISTS (SELECT 1 FROM public.tournaments t
                      WHERE t.created_by = auth.uid() AND t.status <> 'deleted')
          OR EXISTS (SELECT 1 FROM public.tournament_officials o
                       JOIN public.tournaments t ON t.id = o.tournament_id
                      WHERE o.user_id = auth.uid() AND t.status <> 'deleted')) THEN
    RAISE EXCEPTION 'Unauthorized: only admins, umpires and tournament officials can send match alerts.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('match_alert', jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000))
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.push_match_alert(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_match_alert(text, text) TO authenticated, service_role;

-- ---------- 4. pings carry the sender's real name ----------
CREATE OR REPLACE FUNCTION public.send_ping_notification(p_target_id uuid, p_sender_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sender uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF auth.uid() = p_target_id THEN RAISE EXCEPTION 'Cannot ping yourself'; END IF;

  -- p_sender_name is ignored: the name comes from the caller's own profile.
  v_sender := COALESCE(public.resolve_my_player_id(), auth.uid());
  IF v_sender = p_target_id THEN RAISE EXCEPTION 'Cannot ping yourself'; END IF;
  SELECT NULLIF(btrim(full_name), '') INTO v_name FROM public.players WHERE id = v_sender;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    p_target_id,
    'Match Request (Ping)!',
    COALESCE(v_name, 'A club member') || ' is looking to play a match with you!',
    'ping',
    '/player/' || v_sender
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_ping_notification(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_ping_notification(uuid, text) TO authenticated, service_role;

-- ---------- 5 and the rest: no anon EXECUTE ----------
REVOKE EXECUTE ON FUNCTION public.process_tournament_bracket_progression(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_cron_health() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_notification_delivery(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fulfill_marketplace_request(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_player_endorsement(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_player_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_tournament_walkover(uuid, smallint, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_elo() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_tournament_elo() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.process_tournament_bracket_progression(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_cron_health() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_notification_delivery(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_marketplace_request(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_player_endorsement(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_player_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_tournament_walkover(uuid, smallint, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_elo() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_tournament_elo() TO authenticated, service_role;
