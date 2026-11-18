-- Serialize tournament court reservations and revalidate immediately before a
-- match starts. A reservation is a 30-minute interval unless an actual end is
-- known. Rubbers belonging to the same team tie are treated as one reservation
-- because the current tie scheduler intentionally propagates one slot to them.

CREATE OR REPLACE FUNCTION public.assert_tournament_court_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_conflict_code text;
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

  v_start := COALESCE(NEW.started_at, NEW.scheduled_at);
  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;
  v_end := COALESCE(NEW.ended_at, v_start + interval '30 minutes');

  IF v_end <= v_start THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'court_interval_invalid: end must be later than start';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.tournament_id::text || ':' || LOWER(BTRIM(NEW.court_number)), 0)
  );

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
      COALESCE(other.started_at, other.scheduled_at) + interval '30 minutes'
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

DROP TRIGGER IF EXISTS tournament_matches_prevent_court_overlap ON public.tournament_matches;
CREATE TRIGGER tournament_matches_prevent_court_overlap
BEFORE INSERT OR UPDATE OF court_number, scheduled_at, started_at, ended_at, status
ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.assert_tournament_court_available();

REVOKE ALL ON FUNCTION public.assert_tournament_court_available() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.start_tournament_match_checked(
  p_match_id uuid,
  p_expected_court text,
  p_expected_scheduled_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_authorized boolean := false;
  v_conflict_code text;
  v_started_at timestamptz;
  v_players uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT * INTO v_match
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

  IF v_authorized IS NOT TRUE THEN
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_match.tournament_id::text || ':' || LOWER(BTRIM(v_match.court_number)), 0)
  );

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

    SELECT COALESCE(other.match_code, other.id::text)
    INTO v_conflict_code
    FROM public.tournament_matches other
    WHERE other.id <> v_match.id
      AND other.tournament_id = v_match.tournament_id
      AND other.status = 'completed'
      AND other.ended_at > now() - interval '15 minutes'
      AND ARRAY_REMOVE(
        ARRAY[other.player1_id, other.player2_id, other.player3_id, other.player4_id],
        NULL
      ) && v_players
    ORDER BY other.ended_at DESC
    LIMIT 1;

    IF v_conflict_code IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format('player_rest_conflict: a player finished %s less than 15 minutes ago', v_conflict_code);
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

REVOKE ALL ON FUNCTION public.start_tournament_match_checked(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_tournament_match_checked(uuid, text, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.start_tournament_match_checked(uuid, text, timestamptz)
IS 'Atomically revalidates authorization, court occupancy, active players and actual rest before starting a tournament match.';
