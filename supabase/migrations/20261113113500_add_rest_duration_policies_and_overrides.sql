-- Migration: 20261113113500_add_rest_duration_policies_and_overrides.sql
-- Description: Configurable tournament rest policy, estimated match duration,
-- unavailable court periods, and audited schedule overrides.

-- 1. Add policy columns to tournaments
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS min_rest_minutes INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS estimated_match_minutes INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS unavailable_court_periods JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Add override attribution columns to tournament_matches
ALTER TABLE public.tournament_matches
ADD COLUMN IF NOT EXISTS schedule_override_reason TEXT,
ADD COLUMN IF NOT EXISTS schedule_override_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS schedule_overridden_by UUID;

-- 3. Update court overlap trigger to respect tournament policy and permitted overrides
CREATE OR REPLACE FUNCTION public.check_tournament_court_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_conflict_code text;
  v_est_minutes integer := 30;
  v_unavailable_period jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.court_number IS NOT DISTINCT FROM NEW.court_number
    AND OLD.scheduled_at IS NOT DISTINCT FROM NEW.scheduled_at
    AND OLD.started_at IS NOT DISTINCT FROM NEW.started_at
    AND OLD.ended_at IS NOT DISTINCT FROM NEW.ended_at
    AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('completed', 'walkover', 'cancelled')
    OR NULLIF(BTRIM(NEW.court_number), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read tournament policy
  SELECT COALESCE(estimated_match_minutes, 30)
  INTO v_est_minutes
  FROM public.tournaments
  WHERE id = NEW.tournament_id;

  v_start := COALESCE(NEW.started_at, NEW.scheduled_at);
  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;
  v_end := COALESCE(NEW.ended_at, v_start + (v_est_minutes || ' minutes')::interval);

  IF v_end <= v_start THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'court_interval_invalid: end must be later than start';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.tournament_id::text || ':' || LOWER(BTRIM(NEW.court_number)), 0)
  );

  -- HARD CONSTRAINT: Check if court is in an unavailable court period
  SELECT elem
  INTO v_unavailable_period
  FROM public.tournaments t,
       jsonb_array_elements(t.unavailable_court_periods) elem
  WHERE t.id = NEW.tournament_id
    AND LOWER(BTRIM(elem->>'court')) = LOWER(BTRIM(NEW.court_number))
    AND v_start < (elem->>'end')::timestamptz
    AND (elem->>'start')::timestamptz < v_end
  LIMIT 1;

  IF v_unavailable_period IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format(
        'court_unavailable: court %s is unavailable (%s)',
        NEW.court_number,
        COALESCE(v_unavailable_period->>'reason', 'Scheduled maintenance / blackout')
      );
  END IF;

  -- HARD CONSTRAINT: Check if court is currently occupied now by an active match
  SELECT COALESCE(other.match_code, other.id::text)
  INTO v_conflict_code
  FROM public.tournament_matches other
  WHERE other.id <> NEW.id
    AND other.tournament_id = NEW.tournament_id
    AND LOWER(BTRIM(other.court_number)) = LOWER(BTRIM(NEW.court_number))
    AND other.status IN ('in_progress', 'live', 'playing', 'ready', 'warming_up', 'paused')
    AND NOT (NEW.tie_id IS NOT NULL AND other.tie_id = NEW.tie_id)
  LIMIT 1;

  IF v_conflict_code IS NOT NULL AND NEW.status IN ('in_progress', 'live', 'playing') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format('court_in_use: court %s is currently occupied by %s', NEW.court_number, v_conflict_code);
  END IF;

  -- ESTIMATED OVERLAP: If an override with non-empty reason is present, allow it
  IF NEW.schedule_override_reason IS NOT NULL AND length(btrim(NEW.schedule_override_reason)) > 0 THEN
    RETURN NEW;
  END IF;

  -- Otherwise, prevent estimated overlap on scheduled matches
  SELECT COALESCE(other.match_code, other.id::text)
  INTO v_conflict_code
  FROM public.tournament_matches other
  WHERE other.id <> NEW.id
    AND other.tournament_id = NEW.tournament_id
    AND LOWER(BTRIM(other.court_number)) = LOWER(BTRIM(NEW.court_number))
    AND other.status NOT IN ('walkover', 'cancelled')
    AND (other.status <> 'completed' OR other.ended_at IS NOT NULL)
    AND COALESCE(other.started_at, other.scheduled_at) IS NOT NULL
    AND NOT (NEW.tie_id IS NOT NULL AND other.tie_id = NEW.tie_id)
    AND v_start < COALESCE(
      other.ended_at,
      COALESCE(other.started_at, other.scheduled_at) + (v_est_minutes || ' minutes')::interval
    )
    AND COALESCE(other.started_at, other.scheduled_at) < v_end
  ORDER BY COALESCE(other.started_at, other.scheduled_at)
  LIMIT 1;

  IF v_conflict_code IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format(
        'court_conflict: court %s overlaps %s',
        NEW.court_number,
        v_conflict_code
      );
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Update start_tournament_match_checked to use tournament rest policy and unavailable court periods
CREATE OR REPLACE FUNCTION public.start_tournament_match_checked(
  p_match_id uuid,
  p_expected_court text DEFAULT NULL,
  p_expected_scheduled_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_authorized boolean;
  v_conflict_code text;
  v_players uuid[];
  v_started_at timestamptz;
  v_min_rest integer := 15;
  v_unavailable_period jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT *
  INTO v_match
  FROM public.tournament_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Tournament match not found';
  END IF;

  SELECT (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE (id = auth.uid()
        OR email = (auth.jwt()->>'email')
        OR iisc_email = (auth.jwt()->>'email'))
        AND role IN ('admin', 'master_admin', 'umpire')
    )
    OR auth.uid() = v_match.umpired_by
    OR EXISTS (
      SELECT 1 FROM public.tournament_officials
      WHERE tournament_id = v_match.tournament_id
        AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.umpire_assignments assignment
      WHERE assignment.user_id = auth.uid()
        AND (
          assignment.tournament_match_id = p_match_id
          OR (
            assignment.start_time IS NOT NULL
            AND assignment.end_time IS NOT NULL
            AND now() BETWEEN assignment.start_time AND assignment.end_time
          )
        )
    )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to start this tournament match';
  END IF;

  IF v_match.status IN ('completed', 'walkover', 'cancelled') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'match_not_startable: match is already closed';
  END IF;

  IF v_match.status = 'in_progress' THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'already_started',
      'started_at', v_match.started_at
    );
  END IF;

  IF NULLIF(BTRIM(v_match.court_number), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'match_not_ready: assign a court before starting';
  END IF;

  IF p_expected_court IS NOT NULL
    AND LOWER(BTRIM(v_match.court_number)) <> LOWER(BTRIM(p_expected_court)) THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'match_schedule_changed: court changed; refresh before starting';
  END IF;

  IF p_expected_scheduled_at IS NOT NULL
    AND v_match.scheduled_at IS DISTINCT FROM p_expected_scheduled_at THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'match_schedule_changed: start time changed; refresh before starting';
  END IF;

  -- Read tournament policy
  SELECT COALESCE(min_rest_minutes, 15)
  INTO v_min_rest
  FROM public.tournaments
  WHERE id = v_match.tournament_id;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_match.tournament_id::text || ':' || LOWER(BTRIM(v_match.court_number)), 0)
  );

  -- Check unavailable court periods
  SELECT elem
  INTO v_unavailable_period
  FROM public.tournaments t,
       jsonb_array_elements(t.unavailable_court_periods) elem
  WHERE t.id = v_match.tournament_id
    AND LOWER(BTRIM(elem->>'court')) = LOWER(BTRIM(v_match.court_number))
    AND now() < (elem->>'end')::timestamptz
    AND (elem->>'start')::timestamptz <= now()
  LIMIT 1;

  IF v_unavailable_period IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format('court_unavailable: court %s is currently unavailable (%s)',
        v_match.court_number,
        COALESCE(v_unavailable_period->>'reason', 'Scheduled maintenance / blackout')
      );
  END IF;

  SELECT COALESCE(other.match_code, other.id::text)
  INTO v_conflict_code
  FROM public.tournament_matches other
  WHERE other.id <> v_match.id
    AND other.tournament_id = v_match.tournament_id
    AND LOWER(BTRIM(other.court_number)) = LOWER(BTRIM(v_match.court_number))
    AND other.status IN ('in_progress', 'playing', 'ready', 'warming_up', 'paused')
    AND NOT (v_match.tie_id IS NOT NULL AND other.tie_id = v_match.tie_id)
  LIMIT 1;

  IF v_conflict_code IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format('court_in_use: court %s is occupied by %s', v_match.court_number, v_conflict_code);
  END IF;

  v_players := ARRAY_REMOVE(
    ARRAY[v_match.player1_id, v_match.player2_id, v_match.player3_id, v_match.player4_id],
    NULL
  );

  IF cardinality(v_players) > 0 THEN
    SELECT COALESCE(other.match_code, other.id::text)
    INTO v_conflict_code
    FROM public.tournament_matches other
    WHERE other.id <> v_match.id
      AND other.tournament_id = v_match.tournament_id
      AND other.status IN ('in_progress', 'playing', 'ready', 'warming_up', 'paused')
      AND ARRAY_REMOVE(
        ARRAY[other.player1_id, other.player2_id, other.player3_id, other.player4_id],
        NULL
      ) && v_players
    LIMIT 1;

    IF v_conflict_code IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23P01',
        MESSAGE = format('player_in_use: a player is still active in %s', v_conflict_code);
    END IF;

    -- Enforce actual rest against configurable tournament min_rest_minutes
    SELECT COALESCE(other.match_code, other.id::text)
    INTO v_conflict_code
    FROM public.tournament_matches other
    WHERE other.id <> v_match.id
      AND other.tournament_id = v_match.tournament_id
      AND other.status = 'completed'
      AND other.ended_at > now() - (v_min_rest || ' minutes')::interval
      AND ARRAY_REMOVE(
        ARRAY[other.player1_id, other.player2_id, other.player3_id, other.player4_id],
        NULL
      ) && v_players
    ORDER BY other.ended_at DESC
    LIMIT 1;

    IF v_conflict_code IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format('player_rest_conflict: a player finished %s less than %s minutes ago', v_conflict_code, v_min_rest);
    END IF;
  END IF;

  v_started_at := now();
  UPDATE public.tournament_matches
  SET status = 'in_progress',
      started_at = COALESCE(started_at, v_started_at)
  WHERE id = p_match_id
  RETURNING started_at INTO v_started_at;

  RETURN jsonb_build_object(
    'applied', true,
    'reason', 'started',
    'started_at', v_started_at
  );
END;
$$;

-- 5. RPC: override_tournament_schedule
-- Allows authorized organizers to override warning/overridable conflicts with an attributable audit reason.
-- Hard conflicts (occupied court, active player, unavailable period, actual rest below min) CANNOT be overridden.
CREATE OR REPLACE FUNCTION public.override_tournament_schedule(
  p_tournament_id UUID,
  p_match_id UUID,
  p_court TEXT,
  p_scheduled_at TIMESTAMPTZ,
  p_reason TEXT,
  p_conflict_type TEXT DEFAULT 'warning',
  p_conflicting_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_authorized BOOLEAN;
  v_user_email TEXT;
  v_min_rest INTEGER := 15;
  v_est_match INTEGER := 30;
  v_players UUID[];
  v_conflict_code TEXT;
  v_unavailable_period JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A non-empty reason is required to override schedule conflicts';
  END IF;

  SELECT * INTO v_match
  FROM public.tournament_matches
  WHERE id = p_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Tournament match not found';
  END IF;

  SELECT (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email'))
        AND role IN ('admin', 'master_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.tournament_officials
      WHERE tournament_id = p_tournament_id AND user_id = auth.uid()
    )
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to override schedule conflicts';
  END IF;

  -- Read policy
  SELECT COALESCE(min_rest_minutes, 15), COALESCE(estimated_match_minutes, 30)
  INTO v_min_rest, v_est_match
  FROM public.tournaments
  WHERE id = p_tournament_id;

  -- HARD CONSTRAINT: Check if court is in an unavailable court period during requested slot
  SELECT elem
  INTO v_unavailable_period
  FROM public.tournaments t,
       jsonb_array_elements(t.unavailable_court_periods) elem
  WHERE t.id = p_tournament_id
    AND LOWER(BTRIM(elem->>'court')) = LOWER(BTRIM(p_court))
    AND p_scheduled_at < (elem->>'end')::timestamptz
    AND (elem->>'start')::timestamptz < p_scheduled_at + (v_est_match || ' minutes')::interval
  LIMIT 1;

  IF v_unavailable_period IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format('court_unavailable: cannot override into an unavailable court period (%s)',
        COALESCE(v_unavailable_period->>'reason', 'Blackout')
      );
  END IF;

  -- HARD CONSTRAINT: Court cannot be occupied NOW by an active match if scheduled now
  IF p_scheduled_at <= now() THEN
    SELECT COALESCE(other.match_code, other.id::text)
    INTO v_conflict_code
    FROM public.tournament_matches other
    WHERE other.id <> v_match.id
      AND other.tournament_id = p_tournament_id
      AND LOWER(BTRIM(other.court_number)) = LOWER(BTRIM(p_court))
      AND other.status IN ('in_progress', 'live', 'playing')
    LIMIT 1;

    IF v_conflict_code IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23P01',
        MESSAGE = format('court_in_use: court %s is currently occupied by active match %s', p_court, v_conflict_code);
    END IF;
  END IF;

  -- HARD CONSTRAINT: Player cannot have ACTUAL rest below minimum if previous match ended
  v_players := ARRAY_REMOVE(
    ARRAY[v_match.player1_id, v_match.player2_id, v_match.player3_id, v_match.player4_id],
    NULL
  );

  IF cardinality(v_players) > 0 THEN
    SELECT COALESCE(other.match_code, other.id::text)
    INTO v_conflict_code
    FROM public.tournament_matches other
    WHERE other.id <> v_match.id
      AND other.tournament_id = p_tournament_id
      AND other.status = 'completed'
      AND other.ended_at IS NOT NULL
      AND p_scheduled_at < other.ended_at + (v_min_rest || ' minutes')::interval
      AND ARRAY_REMOVE(
        ARRAY[other.player1_id, other.player2_id, other.player3_id, other.player4_id],
        NULL
      ) && v_players
    ORDER BY other.ended_at DESC
    LIMIT 1;

    IF v_conflict_code IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format('player_actual_rest_hard_conflict: player had less than %s minutes actual rest after %s',
          v_min_rest, v_conflict_code);
    END IF;
  END IF;

  -- Update the match schedule with override reason
  UPDATE public.tournament_matches
  SET court_number = p_court,
      scheduled_at = p_scheduled_at,
      status = 'scheduled',
      schedule_override_reason = btrim(p_reason),
      schedule_override_at = now(),
      schedule_overridden_by = auth.uid(),
      reminder_sent = false
  WHERE id = p_match_id;

  -- Fetch user email for audit log
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM public.players WHERE id = auth.uid();
  END IF;

  -- Insert audit log
  INSERT INTO public.admin_logs (
    admin_email,
    action,
    details,
    created_at
  ) VALUES (
    COALESCE(v_user_email, 'official'),
    'tournament_schedule_override',
    jsonb_build_object(
      'tournament_id', p_tournament_id,
      'match_id', p_match_id,
      'match_code', v_match.match_code,
      'conflict_type', p_conflict_type,
      'conflicting_id', p_conflicting_id,
      'reason', btrim(p_reason),
      'actor_id', auth.uid(),
      'previous_court', v_match.court_number,
      'previous_scheduled_at', v_match.scheduled_at,
      'new_court', p_court,
      'new_scheduled_at', p_scheduled_at,
      'policy', jsonb_build_object(
        'min_rest_minutes', v_min_rest,
        'estimated_match_minutes', v_est_match
      )
    ),
    now()
  );

  RETURN jsonb_build_object(
    'applied', true,
    'match_id', p_match_id,
    'court_number', p_court,
    'scheduled_at', p_scheduled_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.override_tournament_schedule(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.override_tournament_schedule(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

