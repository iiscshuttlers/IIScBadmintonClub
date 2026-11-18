-- Migration: 20261113170000_add_tournament_subscriptions_and_alert_dedup.sql
-- Description: Tournament-level subscriptions, granular follow preferences,
-- quiet hours, alert deduplication across overlapping follows, and authoritative dispatch.

-- 1. Table: user_tournament_subscriptions
CREATE TABLE IF NOT EXISTS public.user_tournament_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  notify_match_call BOOLEAN NOT NULL DEFAULT true,
  notify_schedule_change BOOLEAN NOT NULL DEFAULT true,
  notify_result BOOLEAN NOT NULL DEFAULT true,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tournament_id)
);

ALTER TABLE public.user_tournament_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tournament subscriptions" ON public.user_tournament_subscriptions;
CREATE POLICY "Users can view their own tournament subscriptions"
ON public.user_tournament_subscriptions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tournament subscriptions" ON public.user_tournament_subscriptions;
CREATE POLICY "Users can insert their own tournament subscriptions"
ON public.user_tournament_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tournament subscriptions" ON public.user_tournament_subscriptions;
CREATE POLICY "Users can update their own tournament subscriptions"
ON public.user_tournament_subscriptions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tournament subscriptions" ON public.user_tournament_subscriptions;
CREATE POLICY "Users can delete their own tournament subscriptions"
ON public.user_tournament_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- 2. Enhance user_player_subscriptions with granular event controls
ALTER TABLE public.user_player_subscriptions
  ADD COLUMN IF NOT EXISTS notify_match_call BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_schedule_change BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_result BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT false;

-- 3. Enhance players with quiet hours settings and ensure following column exists
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS following TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '07:00';

-- 4. Table: delivered_targeted_alerts
-- Deduplication log across overlapping player and tournament follows and retried operations.
CREATE TABLE IF NOT EXISTS public.delivered_targeted_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'match_call' | 'schedule_change' | 'result'
  event_version BIGINT NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'in_app', -- 'in_app' | 'push'
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id, event_type, event_version, channel)
);

ALTER TABLE public.delivered_targeted_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own delivered alerts" ON public.delivered_targeted_alerts;
CREATE POLICY "Users can view their own delivered alerts"
ON public.delivered_targeted_alerts FOR SELECT
USING (auth.uid() = user_id);

-- Helper function: is_in_quiet_hours
CREATE OR REPLACE FUNCTION public.is_in_quiet_hours(
  p_start TEXT,
  p_end TEXT,
  p_current_time TIME DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::time
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_start TIME;
  v_end TIME;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start = '' OR p_end = '' THEN
    RETURN false;
  END IF;

  v_start := p_start::time;
  v_end := p_end::time;

  IF v_start <= v_end THEN
    -- E.g. 13:00 to 15:00
    RETURN (p_current_time >= v_start AND p_current_time <= v_end);
  ELSE
    -- Overnight, e.g. 22:00 to 07:00
    RETURN (p_current_time >= v_start OR p_current_time <= v_end);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- 5. RPC: dispatch_authoritative_match_alert
-- Server-authoritative dispatch with recipient discovery, preference filtering,
-- deduplication across overlapping player/tournament follows, quiet hours respect,
-- and canonical deep link generation.
CREATE OR REPLACE FUNCTION public.dispatch_authoritative_match_alert(
  p_match_id UUID,
  p_event_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_version BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  v_quiet BOOLEAN := false;
BEGIN
  IF p_event_type NOT IN ('match_call', 'schedule_change', 'result') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = format('Unsupported tournament alert event type: %s', p_event_type);
  END IF;

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

    -- Quiet hours suppress push, not the durable in-app activity record.
    v_quiet := v_player_rec.quiet_hours_enabled IS TRUE
      AND public.is_in_quiet_hours(v_player_rec.quiet_hours_start, v_player_rec.quiet_hours_end);

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

    -- Enqueue push unless quiet hours are active. The dispatcher later records
    -- provider acceptance/failure on scheduled_notifications.status/error.
    IF NOT v_quiet THEN
      BEGIN
        INSERT INTO public.scheduled_notifications (
          tournament_id,
          title,
          body,
          channels,
          audience,
          recipient_ids,
          link,
          status,
          scheduled_at
        ) VALUES (
          v_match.tournament_id,
          p_title,
          p_body,
          ARRAY['push']::TEXT[],
          'custom',
          ARRAY[v_uid]::UUID[],
          v_deep_link,
          'pending',
          now()
        );
      EXCEPTION WHEN undefined_table THEN
        -- Optional table depending on deployment stage
        NULL;
      END;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;

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
$$;

-- Schedule alerts need a revision independent of result_revision. Otherwise a
-- second court/time edit can be incorrectly suppressed as a duplicate.
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS schedule_revision BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_tournament_match_schedule_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.court_number IS DISTINCT FROM OLD.court_number
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    NEW.schedule_revision := OLD.schedule_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_match_schedule_revision_trigger ON public.tournament_matches;
CREATE TRIGGER tournament_match_schedule_revision_trigger
BEFORE UPDATE OF court_number, scheduled_at ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.bump_tournament_match_schedule_revision();

-- 6. Trigger: Automatically dispatch alert on authoritative score completion or schedule change
CREATE OR REPLACE FUNCTION public.trigger_tournament_match_authoritative_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
      NEW.schedule_revision
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_match_authoritative_alert_trigger ON public.tournament_matches;
CREATE TRIGGER tournament_match_authoritative_alert_trigger
AFTER UPDATE OF status, court_number, scheduled_at ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.trigger_tournament_match_authoritative_alert();

REVOKE ALL ON FUNCTION public.dispatch_authoritative_match_alert(UUID, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_authoritative_match_alert(UUID, TEXT, TEXT, TEXT, BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_authoritative_match_alert(UUID, TEXT, TEXT, TEXT, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.bump_tournament_match_schedule_revision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_tournament_match_schedule_revision() TO service_role;
REVOKE ALL ON FUNCTION public.trigger_tournament_match_authoritative_alert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_tournament_match_authoritative_alert() TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tournament_subscriptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivered_targeted_alerts TO authenticated, service_role;
