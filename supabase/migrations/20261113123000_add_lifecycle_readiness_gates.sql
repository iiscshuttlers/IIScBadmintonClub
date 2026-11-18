-- Migration: 20261113123000_add_lifecycle_readiness_gates.sql
-- Description: Lifecycle-specific readiness gates for announcing an event,
-- publishing draws/schedules, and starting live tournament play.

-- 1. RPC: verify_tournament_readiness
-- Evaluates the readiness of a tournament for a specific lifecycle action.
-- Actions: 'announce', 'publish_draw', 'start_play'.
CREATE OR REPLACE FUNCTION public.verify_tournament_readiness(
  p_tournament_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tour public.tournaments%ROWTYPE;
  v_is_team BOOLEAN := false;
  v_blockers JSONB[] := ARRAY[]::JSONB[];
  v_warnings JSONB[] := ARRAY[]::JSONB[];
  v_entrant_count INTEGER := 0;
  v_unresolved_pairs UUID[] := ARRAY[]::UUID[];
  v_fixture_count INTEGER := 0;
  v_invalid_scoring UUID[] := ARRAY[]::UUID[];
  v_playable_matches UUID[] := ARRAY[]::UUID[];
  v_unscheduled_matches UUID[] := ARRAY[]::UUID[];
  v_conflict_matches UUID[] := ARRAY[]::UUID[];
  v_unofficials_count INTEGER := 0;
  v_unresolved_count INTEGER := 0;
  v_invalid_scoring_count INTEGER := 0;
  v_unscheduled_count INTEGER := 0;
  v_blackout_count INTEGER := 0;
  v_blackout_period JSONB;
BEGIN
  IF p_action NOT IN ('announce', 'publish_draw', 'start_play') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = format('Invalid lifecycle action: %s. Expected announce, publish_draw, or start_play.', p_action);
  END IF;

  SELECT * INTO v_tour
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Tournament not found';
  END IF;

  -- Readiness reports contain draft configuration and entity identifiers. They
  -- are an organiser tool, not a public discovery endpoint.
  IF auth.role() <> 'service_role'
     AND NOT public.is_tournament_official(p_tournament_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Not authorized to inspect tournament readiness';
  END IF;

  v_is_team := (v_tour.format_family = 'TEAM' OR v_tour.tournament_type = 'team');

  -- ==========================================
  -- STAGE 1: ANNOUNCE (Event Info & Details)
  -- ==========================================
  IF NULLIF(BTRIM(v_tour.name), '') IS NULL THEN
    v_blockers := array_append(v_blockers, jsonb_build_object(
      'code', 'MISSING_DETAILS',
      'message', 'Tournament name is required',
      'fix_tab', 'setup'
    ));
  END IF;

  IF v_tour.start_date IS NULL THEN
    v_blockers := array_append(v_blockers, jsonb_build_object(
      'code', 'MISSING_DETAILS',
      'message', 'Tournament start date is required',
      'fix_tab', 'setup'
    ));
  END IF;

  IF NULLIF(BTRIM(v_tour.venue), '') IS NULL THEN
    v_blockers := array_append(v_blockers, jsonb_build_object(
      'code', 'MISSING_DETAILS',
      'message', 'Tournament venue is required',
      'fix_tab', 'setup'
    ));
  END IF;

  -- Announcement Warnings
  IF NULLIF(BTRIM(v_tour.description), '') IS NULL THEN
    v_warnings := array_append(v_warnings, jsonb_build_object(
      'code', 'MISSING_DESCRIPTION',
      'message', 'Tournament description is empty',
      'fix_tab', 'setup'
    ));
  END IF;

  IF NOT v_is_team AND (v_tour.categories IS NULL OR cardinality(v_tour.categories) = 0) THEN
    v_warnings := array_append(v_warnings, jsonb_build_object(
      'code', 'NO_CATEGORIES',
      'message', 'No playing categories selected (MS, WS, MD, WD, XD)',
      'fix_tab', 'setup'
    ));
  END IF;

  -- If only checking 'announce', return early
  IF p_action = 'announce' THEN
    RETURN jsonb_build_object(
      'action', p_action,
      'tournament_id', p_tournament_id,
      'allowed', (cardinality(v_blockers) = 0),
      'blockers', to_jsonb(v_blockers),
      'warnings', to_jsonb(v_warnings)
    );
  END IF;

  -- ==========================================
  -- STAGE 2: PUBLISH DRAW (Brackets & Pairs)
  -- ==========================================
  IF v_is_team THEN
    SELECT COUNT(*) INTO v_entrant_count
    FROM public.tournament_teams
    WHERE tournament_id = p_tournament_id;

    IF v_entrant_count < 2 THEN
      v_blockers := array_append(v_blockers, jsonb_build_object(
        'code', 'EMPTY_ENTRANTS',
        'message', 'Add at least two teams before publishing draw',
        'count', v_entrant_count,
        'fix_tab', 'teams'
      ));
    END IF;

    SELECT COUNT(*) INTO v_fixture_count
    FROM public.tournament_ties
    WHERE tournament_id = p_tournament_id;

    IF v_fixture_count = 0 THEN
      v_blockers := array_append(v_blockers, jsonb_build_object(
        'code', 'NO_FIXTURES',
        'message', 'Generate tournament ties before publishing fixtures',
        'count', 0,
        'fix_tab', 'fixtures'
      ));
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_entrant_count
    FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id;

    IF v_entrant_count < 2 THEN
      v_blockers := array_append(v_blockers, jsonb_build_object(
        'code', 'EMPTY_ENTRANTS',
        'message', 'Add at least two participants before publishing draw',
        'count', v_entrant_count,
        'fix_tab', 'participants'
      ));
    END IF;

    -- Check unresolved doubles/mixed pairs
    SELECT array_agg(id) INTO v_unresolved_pairs
    FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id
      AND (
        UPPER(category) IN ('MD', 'WD', 'XD')
        OR UPPER(category) LIKE '%DOUBLES%'
        OR UPPER(category) LIKE '%MIXED%'
      )
      AND partner_id IS NULL
      AND COALESCE(display_name, '') NOT LIKE '%&%';

    v_unresolved_count := COALESCE(cardinality(v_unresolved_pairs), 0);
    IF v_unresolved_count > 0 THEN
      v_blockers := array_append(v_blockers, jsonb_build_object(
        'code', 'UNRESOLVED_PAIRS',
        'message', format('Resolve partner assignments for %s doubles/XD entry(ies)', v_unresolved_count),
        'count', v_unresolved_count,
        'entity_ids', to_jsonb(v_unresolved_pairs),
        'fix_tab', 'participants'
      ));
    END IF;

    SELECT COUNT(*) INTO v_fixture_count
    FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id;

    IF v_fixture_count = 0 THEN
      v_blockers := array_append(v_blockers, jsonb_build_object(
        'code', 'NO_FIXTURES',
        'message', 'Generate tournament bracket / matches before publishing draw',
        'count', 0,
        'fix_tab', 'bracket'
      ));
    END IF;
  END IF;

  -- Check scoring rules on tournament matches
  SELECT array_agg(id) INTO v_invalid_scoring
  FROM public.tournament_matches
  WHERE tournament_id = p_tournament_id
    AND (
      COALESCE(points_to_win, 0) <= 0
      OR COALESCE(best_of_sets, 0) <= 0
      OR MOD(best_of_sets, 2) = 0
      OR (COALESCE(golden_point, 0) <> 0 AND golden_point < points_to_win)
    );

  v_invalid_scoring_count := COALESCE(cardinality(v_invalid_scoring), 0);
  IF v_fixture_count > 0 AND v_invalid_scoring_count > 0 THEN
    v_blockers := array_append(v_blockers, jsonb_build_object(
      'code', 'INVALID_SCORING',
      'message', format('Configure valid scoring rules for %s match(es)', v_invalid_scoring_count),
      'count', v_invalid_scoring_count,
      'entity_ids', to_jsonb(v_invalid_scoring),
      'fix_tab', 'rules'
    ));
  END IF;

  -- If only checking 'publish_draw', return now
  IF p_action = 'publish_draw' THEN
    RETURN jsonb_build_object(
      'action', p_action,
      'tournament_id', p_tournament_id,
      'allowed', (cardinality(v_blockers) = 0),
      'blockers', to_jsonb(v_blockers),
      'warnings', to_jsonb(v_warnings)
    );
  END IF;

  -- ==========================================
  -- STAGE 3: START PLAY (Live Play / Active)
  -- ==========================================
  -- Identify playable matches (both competitors known)
  SELECT array_agg(id) INTO v_playable_matches
  FROM public.tournament_matches
  WHERE tournament_id = p_tournament_id
    AND (player1_id IS NOT NULL OR NULLIF(BTRIM(team1_label), '') IS NOT NULL)
    AND (player2_id IS NOT NULL OR NULLIF(BTRIM(team2_label), '') IS NOT NULL)
    AND status NOT IN ('completed', 'walkover', 'cancelled');

  IF COALESCE(cardinality(v_playable_matches), 0) = 0 THEN
    v_blockers := array_append(v_blockers, jsonb_build_object(
      'code', 'NO_PLAYABLE_MATCHES',
      'message', 'Assign competitors to both sides of at least one playable match',
      'fix_tab', 'bracket'
    ));
  ELSE
    -- Check that playable matches have assigned court and time
    SELECT array_agg(id) INTO v_unscheduled_matches
    FROM public.tournament_matches
    WHERE id = ANY(v_playable_matches)
      AND (court_number IS NULL OR NULLIF(BTRIM(court_number), '') IS NULL OR scheduled_at IS NULL);

    v_unscheduled_count := COALESCE(cardinality(v_unscheduled_matches), 0);
    IF v_unscheduled_count > 0 THEN
      v_blockers := array_append(v_blockers, jsonb_build_object(
        'code', 'UNSCHEDULED_PLAYABLE_MATCHES',
        'message', format('Assign court and scheduled time for %s playable match(es)', v_unscheduled_count),
        'count', v_unscheduled_count,
        'entity_ids', to_jsonb(v_unscheduled_matches),
        'fix_tab', 'schedule'
      ));
    END IF;

    -- Hard conflicts are unavailable periods or a court occupied by a match
    -- that is already live. Estimated future overlaps remain warnings in the
    -- scheduling UI and are not promoted to an irreversible lifecycle block.
    SELECT array_agg(DISTINCT conflict_id) INTO v_conflict_matches
    FROM (
      SELECT m.id AS conflict_id
      FROM public.tournament_matches m,
           jsonb_array_elements(COALESCE(v_tour.unavailable_court_periods, '[]'::jsonb)) elem
      WHERE m.id = ANY(v_playable_matches)
        AND m.court_number IS NOT NULL
        AND m.scheduled_at IS NOT NULL
        AND LOWER(BTRIM(elem->>'court')) = LOWER(BTRIM(m.court_number))
        AND m.scheduled_at < (elem->>'end')::timestamptz
        AND (elem->>'start')::timestamptz < m.scheduled_at + ((COALESCE(v_tour.estimated_match_minutes, 30)) || ' minutes')::interval

      UNION

      SELECT candidate.id AS conflict_id
      FROM public.tournament_matches candidate
      JOIN public.tournament_matches active
        ON active.tournament_id = candidate.tournament_id
       AND active.id <> candidate.id
       AND LOWER(BTRIM(active.court_number)) = LOWER(BTRIM(candidate.court_number))
      WHERE candidate.id = ANY(v_playable_matches)
        AND candidate.court_number IS NOT NULL
        AND candidate.scheduled_at IS NOT NULL
        AND active.status IN ('in_progress', 'live', 'playing')
        AND COALESCE(active.started_at, active.scheduled_at) IS NOT NULL
        AND candidate.scheduled_at < COALESCE(
          active.ended_at,
          COALESCE(active.started_at, active.scheduled_at)
            + ((COALESCE(v_tour.estimated_match_minutes, 30)) || ' minutes')::interval
        )
        AND COALESCE(active.started_at, active.scheduled_at)
          < candidate.scheduled_at + ((COALESCE(v_tour.estimated_match_minutes, 30)) || ' minutes')::interval
    ) conflicts;

    v_blackout_count := COALESCE(cardinality(v_conflict_matches), 0);
    IF v_blackout_count > 0 THEN
      v_blockers := array_append(v_blockers, jsonb_build_object(
        'code', 'HARD_SCHEDULE_CONFLICT',
        'message', format('%s playable match(es) have an unavailable or occupied court', v_blackout_count),
        'count', v_blackout_count,
        'entity_ids', to_jsonb(v_conflict_matches),
        'fix_tab', 'schedule'
      ));
    END IF;

    -- Match official coverage warning (non-blocking for club tournaments)
    SELECT COUNT(*) INTO v_unofficials_count
    FROM public.tournament_matches
    WHERE id = ANY(v_playable_matches)
      AND umpired_by IS NULL;

    IF v_unofficials_count > 0 THEN
      v_warnings := array_append(v_warnings, jsonb_build_object(
        'code', 'MISSING_OFFICIALS',
        'message', format('%s playable match(es) have no assigned umpire / official', v_unofficials_count),
        'count', v_unofficials_count,
        'fix_tab', 'officials'
      ));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'action', p_action,
    'tournament_id', p_tournament_id,
    'allowed', (cardinality(v_blockers) = 0),
    'blockers', to_jsonb(v_blockers),
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;

-- 2. Update trigger function to use verify_tournament_readiness('start_play')
-- Protects direct REST updates from bypassing the start_play gate.
CREATE OR REPLACE FUNCTION public.assert_tournament_ready_for_active()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_report JSONB;
  v_blockers JSONB;
  v_elem JSONB;
  v_messages TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NEW.status <> 'active' OR (OLD.status IS NOT NULL AND OLD.status = 'active') THEN
    RETURN NEW;
  END IF;

  v_report := public.verify_tournament_readiness(NEW.id, 'start_play');

  IF (v_report->>'allowed')::boolean IS FALSE THEN
    v_blockers := v_report->'blockers';
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_blockers)
    LOOP
      v_messages := array_append(v_messages, v_elem->>'message');
    END LOOP;

    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'tournament_not_ready: ' || array_to_string(v_messages, '; ');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournaments_require_readiness_before_active ON public.tournaments;
CREATE TRIGGER tournaments_require_readiness_before_active
BEFORE INSERT OR UPDATE OF status ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.assert_tournament_ready_for_active();

-- 3. RPC: transition_tournament_lifecycle
-- Attributable, authorized lifecycle stage transitions with audited logging.
CREATE OR REPLACE FUNCTION public.transition_tournament_lifecycle(
  p_tournament_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report JSONB;
  v_authorized BOOLEAN := false;
  v_user_email TEXT;
  v_elem JSONB;
  v_messages TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
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
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to change tournament lifecycle';
  END IF;

  -- Evaluate the readiness gate for this specific action
  v_report := public.verify_tournament_readiness(p_tournament_id, p_action);

  IF (v_report->>'allowed')::boolean IS FALSE THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_report->'blockers')
    LOOP
      v_messages := array_append(v_messages, v_elem->>'message');
    END LOOP;

    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('Cannot %s tournament: %s', p_action, array_to_string(v_messages, '; '));
  END IF;

  -- Apply lifecycle changes
  IF p_action = 'announce' THEN
    -- Announcing ensures public details are published
    UPDATE public.tournaments
    SET show_participants = COALESCE(show_participants, true)
    WHERE id = p_tournament_id;
  ELSIF p_action = 'publish_draw' THEN
    UPDATE public.tournaments
    SET show_brackets = true,
        show_participants = true
    WHERE id = p_tournament_id;
  ELSIF p_action = 'start_play' THEN
    UPDATE public.tournaments
    SET status = 'active',
        show_brackets = true,
        show_participants = true
    WHERE id = p_tournament_id;
  END IF;

  -- Attributable audit logging
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM public.players WHERE id = auth.uid();
  END IF;

  INSERT INTO public.admin_logs (
    admin_email,
    action,
    details,
    created_at
  ) VALUES (
    COALESCE(v_user_email, 'official'),
    'tournament_lifecycle_transition',
    jsonb_build_object(
      'tournament_id', p_tournament_id,
      'lifecycle_action', p_action,
      'actor_id', auth.uid(),
      'report', v_report
    ),
    now()
  );

  RETURN jsonb_build_object(
    'applied', true,
    'action', p_action,
    'tournament_id', p_tournament_id,
    'report', v_report
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_tournament_readiness(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_tournament_readiness(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_tournament_readiness(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transition_tournament_lifecycle(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_tournament_lifecycle(UUID, TEXT) TO authenticated;

