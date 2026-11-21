-- Rollback for 20261120160000_tournament_checkins.sql
--
-- Removes check-ins, the readiness/presence functions and the minute job's
-- processor, takes the two tables out of realtime, drops court_calls.player_ids
-- and puts dispatch_authoritative_match_alert back to its five-argument form
-- (body from 20261119100000, grants from 20261120140000: service_role only).
-- Deploy the previous call-to-court / notify-up-next edge functions and the
-- previous client first: they call the functions dropped here.
--
-- Apply: npx --no-install supabase db query --remote --yes -f supabase/rollbacks/20261120160000_tournament_checkins.rollback.sql
-- Then:  npx --no-install supabase migration repair --status reverted 20261120160000 --remote --yes
BEGIN;

ALTER PUBLICATION supabase_realtime DROP TABLE public.tournament_checkins;
ALTER PUBLICATION supabase_realtime DROP TABLE public.court_calls;

DROP TRIGGER IF EXISTS tournament_matches_renew_checkins ON public.tournament_matches;
DROP FUNCTION IF EXISTS public.tournament_matches_renew_checkins();
DROP FUNCTION IF EXISTS public.process_tournament_checkins();
DROP TABLE IF EXISTS public.tournament_match_ready_state;
DROP FUNCTION IF EXISTS public.tournament_checkin(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.tournament_match_presence(uuid);
DROP FUNCTION IF EXISTS public.tournament_checkin_readiness(uuid);
DROP TABLE IF EXISTS public.tournament_checkins;
DROP FUNCTION IF EXISTS public.tournament_checkins_notify();
DROP FUNCTION IF EXISTS public.tournament_checkins_normalize();
DROP FUNCTION IF EXISTS public.tournament_player_next_match(uuid, uuid);
DROP FUNCTION IF EXISTS public.checkin_alert_version(uuid);
DROP FUNCTION IF EXISTS public.tournament_checkin_expiry(uuid, uuid, timestamptz);
DROP FUNCTION IF EXISTS public.tournament_checkin_open(uuid);
DROP FUNCTION IF EXISTS public.can_manage_tournament_checkins(uuid);
DROP FUNCTION IF EXISTS public.is_entered_in_tournament(uuid, uuid);

DROP INDEX IF EXISTS public.court_calls_match_called_idx;
ALTER TABLE public.court_calls DROP COLUMN IF EXISTS player_ids;

DROP FUNCTION IF EXISTS public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint, uuid[], text);

CREATE OR REPLACE FUNCTION public.dispatch_authoritative_match_alert(p_match_id uuid, p_event_type text, p_title text, p_body text, p_version bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_tour public.tournaments%ROWTYPE;
  v_match_players UUID[] := ARRAY[]::UUID[];
  v_candidate_recipients UUID[] := ARRAY[]::UUID[];
  v_final_recipients UUID[] := ARRAY[]::UUID[];
  v_uid UUID;
  v_player_rec public.players%ROWTYPE;
  v_delivered_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_deep_link TEXT;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  SELECT * INTO v_tour FROM public.tournaments WHERE id = v_match.tournament_id;

  -- Canonical deep link to the affected match
  v_deep_link := format('/tournaments/%s/matches/%s', v_match.tournament_id, p_match_id);

  -- 1. Collect match participants
  IF v_match.player1_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player1_id); END IF;
  IF v_match.player2_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player2_id); END IF;
  IF v_match.player3_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player3_id); END IF;
  IF v_match.player4_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player4_id); END IF;

  -- Match competitors always candidates
  v_candidate_recipients := v_match_players;

  -- 2. Users with explicit player subscriptions to competitors
  IF cardinality(v_match_players) > 0 THEN
    SELECT array_agg(DISTINCT user_id) INTO v_candidate_recipients
    FROM (
      SELECT unnest(v_candidate_recipients) AS user_id
      UNION
      SELECT ups.user_id
      FROM public.user_player_subscriptions ups
      WHERE ups.player_id = ANY(v_match_players)
        AND ups.is_muted IS FALSE
        AND (
          (p_event_type = 'match_call' AND ups.notify_match_call) OR
          (p_event_type = 'schedule_change' AND ups.notify_schedule_change) OR
          (p_event_type = 'result' AND ups.notify_result) OR
          (p_event_type NOT IN ('match_call', 'schedule_change', 'result'))
        )
      UNION
      -- Users with competitor in their following array
      SELECT p.id AS user_id
      FROM public.players p
      WHERE p.following IS NOT NULL
        AND p.following && v_match_players::text[]
    ) sub;
  END IF;

  -- 3. Users subscribed to the tournament
  IF v_match.tournament_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT user_id) INTO v_candidate_recipients
    FROM (
      SELECT unnest(v_candidate_recipients) AS user_id
      UNION
      SELECT uts.user_id
      FROM public.user_tournament_subscriptions uts
      WHERE uts.tournament_id = v_match.tournament_id
        AND uts.is_muted IS FALSE
        AND (
          (p_event_type = 'match_call' AND uts.notify_match_call) OR
          (p_event_type = 'schedule_change' AND uts.notify_schedule_change) OR
          (p_event_type = 'result' AND uts.notify_result) OR
          (p_event_type NOT IN ('match_call', 'schedule_change', 'result'))
        )
    ) sub_tour;
  END IF;

  IF v_candidate_recipients IS NULL OR cardinality(v_candidate_recipients) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'delivered_count', 0,
      'skipped_count', 0,
      'match_id', p_match_id
    );
  END IF;

  -- 4. Deduplicate and filter candidates (quiet hours, previous delivery)
  FOREACH v_uid IN ARRAY v_candidate_recipients
  LOOP
    SELECT * INTO v_player_rec FROM public.players WHERE id = v_uid;

    -- Alerts need both a player row (notifications.user_id) and a login
    -- (delivered_targeted_alerts.user_id). Guests without a login, or a login
    -- without a player profile, can't receive them; skip instead of failing.
    IF v_player_rec.id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Respect quiet hours if enabled
    IF v_player_rec.quiet_hours_enabled IS TRUE THEN
      IF public.is_in_quiet_hours(v_player_rec.quiet_hours_start, v_player_rec.quiet_hours_end) THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Deduplication check: Has this user already received this exact event and version?
    IF EXISTS (
      SELECT 1 FROM public.delivered_targeted_alerts
      WHERE user_id = v_uid
        AND match_id = p_match_id
        AND event_type = p_event_type
        AND event_version = p_version
        AND channel = 'in_app'
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Deliver in-app notification
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      link,
      is_read,
      created_at
    ) VALUES (
      v_uid,
      p_title,
      p_body,
      'tournament_alert',
      v_deep_link,
      false,
      now()
    );

    -- Record authoritative delivery to prevent duplicate alert
    INSERT INTO public.delivered_targeted_alerts (
      user_id,
      match_id,
      event_type,
      event_version,
      channel,
      status,
      created_at
    ) VALUES (
      v_uid,
      p_match_id,
      p_event_type,
      p_version,
      'in_app',
      'sent',
      now()
    );

    -- Queue the push. stamp_authoritative_notification_queue() ties this row
    -- to the in-app delivery above (match, event, version) and sets its expiry.
    -- Best-effort: the in-app alert is already recorded, so a queue problem is
    -- logged rather than failing the caller (a match update).
    BEGIN
      INSERT INTO public.scheduled_notifications (
        recipient_ids,
        channels,
        audience,
        tournament_id,
        title,
        body,
        link,
        status,
        scheduled_at
      ) VALUES (
        ARRAY[v_uid],
        ARRAY['push'],
        'custom',
        v_match.tournament_id,
        p_title,
        p_body,
        v_deep_link,
        'pending',
        now()
      );
    EXCEPTION
      WHEN unique_violation THEN
        NULL; -- this event is already queued for this recipient
      WHEN OTHERS THEN
        RAISE WARNING 'dispatch_authoritative_match_alert: push not queued for % (match %): % %',
          v_uid, p_match_id, SQLSTATE, SQLERRM;
    END;

    v_delivered_count := v_delivered_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'delivered_count', v_delivered_count,
    'skipped_count', v_skipped_count,
    'match_id', p_match_id,
    'event_type', p_event_type,
    'version', p_version,
    'link', v_deep_link
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint)
  TO service_role;

COMMIT;
