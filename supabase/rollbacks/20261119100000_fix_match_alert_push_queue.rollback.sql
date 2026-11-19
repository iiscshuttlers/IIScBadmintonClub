-- Rollback for 20261119100000_fix_match_alert_push_queue.sql
-- Restores both functions exactly as pg_get_functiondef showed them in
-- production on 2026-11-19. WARNING: that brings back the bug: completing a
-- match or changing its court/time fails whenever there is a player to notify.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261119100000 --linked --yes
BEGIN;

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

    -- Enqueue into scheduled_notifications for push delivery if table exists
    BEGIN
      INSERT INTO public.scheduled_notifications (
        recipient_id,
        tournament_id,
        title,
        body,
        link,
        status,
        scheduled_at
      ) VALUES (
        v_uid,
        v_match.tournament_id,
        p_title,
        p_body,
        v_deep_link,
        'pending',
        now()
      );
    EXCEPTION WHEN undefined_table THEN
      -- Optional table depending on deployment stage
      NULL;
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
    PERFORM public.dispatch_authoritative_match_alert(
      NEW.id,
      'result',
      v_title,
      v_body,
      COALESCE(NEW.result_revision, 1)
    );
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
    PERFORM public.dispatch_authoritative_match_alert(
      NEW.id,
      'schedule_change',
      v_title,
      v_body,
      COALESCE(NEW.result_revision, 0)
    );
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
