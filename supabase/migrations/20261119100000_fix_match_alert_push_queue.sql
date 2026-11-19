-- Fix match alerts, which were failing inside the match-update trigger.
--
-- dispatch_authoritative_match_alert() queued its push into
-- scheduled_notifications.recipient_id, but the column is recipient_ids, and
-- the handler around that insert only caught undefined_table. The 42703 error
-- escaped through trigger_tournament_match_authoritative_alert(), so in
-- production (checked 2026-11-19 in a rolled-back transaction) completing a
-- match or changing its court/time failed for any match with a player to
-- notify, and no targeted alert had ever been delivered.
--
-- 1. Queue the push with the real columns (recipient_ids, channels = push).
--    stamp_authoritative_notification_queue() (20261115130000) then ties it to
--    the alert's match/event/version and gives it an expiry.
-- 2. Skip recipients without both a player row and a login: notifications
--    needs players(id), delivered_targeted_alerts needs auth.users(id).
-- 3. Queueing the push is best-effort; a failure is logged, not raised.
-- 4. The match trigger never lets an alert failure block a match update.
--
-- CREATE OR REPLACE keeps each function's owner and grants.

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

CREATE OR REPLACE FUNCTION public.trigger_tournament_match_authoritative_alert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_side1 TEXT;
  v_side2 TEXT;
BEGIN
  v_side1 := COALESCE(NULLIF(BTRIM(NEW.team1_label), ''), 'Side 1');
  v_side2 := COALESCE(NULLIF(BTRIM(NEW.team2_label), ''), 'Side 2');

  -- Case A: Result finalized
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    v_title := format('🏸 Match Result: %s vs %s', v_side1, v_side2);
    v_body := format('Final score: %s. Tap to view scorecard.', COALESCE(NEW.score, 'Completed'));
    BEGIN
      PERFORM public.dispatch_authoritative_match_alert(
        NEW.id,
        'result',
        v_title,
        v_body,
        COALESCE(NEW.result_revision, 1)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Alerts must never block saving a match result.
      RAISE WARNING 'match % result alert failed: % %', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;

  -- Case B: Court or Schedule assignment changed
  IF (
    (NEW.court_number IS DISTINCT FROM OLD.court_number) OR
    (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at)
  ) AND NEW.status NOT IN ('completed', 'cancelled', 'walkover') THEN
    v_title := format('🏸 Schedule Update: %s vs %s', v_side1, v_side2);
    v_body := format('Match scheduled on %s at %s.',
      COALESCE('Court ' || NEW.court_number, 'TBA'),
      COALESCE(to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'), 'TBA')
    );
    BEGIN
      PERFORM public.dispatch_authoritative_match_alert(
        NEW.id,
        'schedule_change',
        v_title,
        v_body,
        COALESCE(NEW.result_revision, 0)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Alerts must never block a court or time change.
      RAISE WARNING 'match % schedule alert failed: % %', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
