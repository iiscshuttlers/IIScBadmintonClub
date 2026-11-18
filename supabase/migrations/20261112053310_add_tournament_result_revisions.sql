-- Additive concurrency protection for final tournament results.
-- Existing clients can continue to call submit_tournament_match; updated clients
-- use submit_tournament_match_v2 for row locking, expected revisions and retries.

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS result_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result_operation_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_result_operation_id_key
  ON public.tournament_matches (result_operation_id)
  WHERE result_operation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_tournament_match_v2(
  p_match_id UUID,
  p_winner_side SMALLINT,
  p_score TEXT,
  p_sets TEXT[],
  p_umpire_id UUID,
  p_expected_revision BIGINT,
  p_operation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_authorized BOOLEAN := false;
  v_actor_player_id UUID;
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
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to submit this tournament match';
  END IF;

  SELECT id INTO v_actor_player_id
  FROM public.players
  WHERE id = auth.uid()
     OR email = (auth.jwt()->>'email')
     OR iisc_email = (auth.jwt()->>'email')
  ORDER BY (id = auth.uid()) DESC
  LIMIT 1;

  IF p_umpire_id IS NOT NULL AND p_umpire_id IS DISTINCT FROM v_actor_player_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'umpire_id must identify the authenticated official';
  END IF;

  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'operation_id is required';
  END IF;

  IF p_winner_side NOT IN (1, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'winner_side must be 1 or 2';
  END IF;

  -- A retry after an uncertain network response succeeds without applying Elo,
  -- bracket progression or tie scoring again.
  IF v_match.status = 'completed' THEN
    IF v_match.winner_side = p_winner_side
      AND v_match.score IS NOT DISTINCT FROM p_score
      AND v_match.sets_history IS NOT DISTINCT FROM p_sets THEN
      RETURN jsonb_build_object(
        'applied', false,
        'revision', v_match.result_revision,
        'operation_id', v_match.result_operation_id,
        'reason', 'already_applied'
      );
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'result_conflict: this match already has a different completed result';
  END IF;

  IF v_match.result_revision <> p_expected_revision THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = format(
        'result_revision_conflict: expected %s, current %s',
        p_expected_revision,
        v_match.result_revision
      );
  END IF;

  PERFORM public.submit_tournament_match(
    p_match_id,
    p_winner_side,
    p_score,
    p_sets,
    v_actor_player_id
  );

  UPDATE public.tournament_matches
  SET result_revision = v_match.result_revision + 1,
      result_operation_id = p_operation_id
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'applied', true,
    'revision', v_match.result_revision + 1,
    'operation_id', p_operation_id,
    'reason', 'applied'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_tournament_match_v2(
  UUID, SMALLINT, TEXT, TEXT[], UUID, BIGINT, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tournament_match_v2(
  UUID, SMALLINT, TEXT, TEXT[], UUID, BIGINT, UUID
) TO authenticated;

COMMENT ON FUNCTION public.submit_tournament_match_v2(
  UUID, SMALLINT, TEXT, TEXT[], UUID, BIGINT, UUID
) IS 'Atomically submits one tournament result with optimistic revision and idempotent operation checks.';

-- Enforce the launch checklist at the database boundary. Client checks remain
-- useful for guidance, but this trigger also protects direct REST updates and
-- stale admin screens that attempt to move a tournament to active.
CREATE OR REPLACE FUNCTION public.assert_tournament_ready_for_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_team BOOLEAN;
  v_entrant_count INTEGER;
  v_fixture_count INTEGER;
  v_match_count INTEGER;
  v_playable_count INTEGER;
  v_invalid_scoring_count INTEGER;
  v_unscheduled_count INTEGER;
  v_unresolved_pair_count INTEGER;
  v_failures TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  v_is_team := NEW.format_family = 'TEAM' OR NEW.tournament_type = 'team';

  IF NEW.start_date IS NULL OR NULLIF(BTRIM(NEW.venue), '') IS NULL THEN
    v_failures := array_append(v_failures, 'add both tournament date and venue');
  END IF;

  IF v_is_team THEN
    SELECT COUNT(*) INTO v_entrant_count
    FROM public.tournament_teams
    WHERE tournament_id = NEW.id;

    SELECT COUNT(*) INTO v_fixture_count
    FROM public.tournament_ties
    WHERE tournament_id = NEW.id;
  ELSE
    SELECT COUNT(*) INTO v_entrant_count
    FROM public.tournament_participants
    WHERE tournament_id = NEW.id;

    SELECT COUNT(*) INTO v_unresolved_pair_count
    FROM public.tournament_participants
    WHERE tournament_id = NEW.id
      AND (
        UPPER(category) IN ('MD', 'WD', 'XD')
        OR UPPER(category) LIKE '%DOUBLES%'
        OR UPPER(category) LIKE '%MIXED%'
      )
      AND partner_id IS NULL
      AND COALESCE(display_name, '') NOT LIKE '%&%';

    SELECT COUNT(*) INTO v_fixture_count
    FROM public.tournament_matches
    WHERE tournament_id = NEW.id;
  END IF;

  IF v_entrant_count = 0 THEN
    v_failures := array_append(v_failures, CASE WHEN v_is_team THEN 'add at least one team' ELSE 'add at least one participant' END);
  END IF;

  IF NOT v_is_team AND v_unresolved_pair_count > 0 THEN
    v_failures := array_append(v_failures, format('resolve %s doubles/XD partner assignment(s)', v_unresolved_pair_count));
  END IF;

  IF v_fixture_count = 0 THEN
    v_failures := array_append(v_failures, CASE WHEN v_is_team THEN 'generate tournament ties' ELSE 'generate tournament matches' END);
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE (player1_id IS NOT NULL OR NULLIF(BTRIM(team1_label), '') IS NOT NULL)
        AND (player2_id IS NOT NULL OR NULLIF(BTRIM(team2_label), '') IS NOT NULL)
        AND status NOT IN ('completed', 'walkover', 'cancelled')
    ),
    COUNT(*) FILTER (
      WHERE COALESCE(points_to_win, 0) <= 0
        OR COALESCE(best_of_sets, 0) <= 0
        OR MOD(best_of_sets, 2) = 0
        OR (COALESCE(golden_point, 0) <> 0 AND golden_point < points_to_win)
    ),
    COUNT(*) FILTER (
      WHERE (player1_id IS NOT NULL OR NULLIF(BTRIM(team1_label), '') IS NOT NULL)
        AND (player2_id IS NOT NULL OR NULLIF(BTRIM(team2_label), '') IS NOT NULL)
        AND status NOT IN ('completed', 'walkover', 'cancelled')
        AND (court_number IS NULL OR NULLIF(BTRIM(court_number), '') IS NULL OR scheduled_at IS NULL)
    )
  INTO v_match_count, v_playable_count, v_invalid_scoring_count, v_unscheduled_count
  FROM public.tournament_matches
  WHERE tournament_id = NEW.id;

  IF v_match_count = 0 THEN
    v_failures := array_append(v_failures, 'generate playable matches');
  ELSIF v_invalid_scoring_count > 0 THEN
    v_failures := array_append(v_failures, format('fix scoring rules for %s match(es)', v_invalid_scoring_count));
  END IF;

  IF v_playable_count = 0 THEN
    v_failures := array_append(v_failures, 'assign both sides to at least one playable match');
  ELSIF v_unscheduled_count > 0 THEN
    v_failures := array_append(v_failures, format('assign court and time for %s playable match(es)', v_unscheduled_count));
  END IF;

  IF cardinality(v_failures) > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'tournament_not_ready: ' || array_to_string(v_failures, '; ');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournaments_require_readiness_before_active ON public.tournaments;
CREATE TRIGGER tournaments_require_readiness_before_active
BEFORE INSERT OR UPDATE OF status ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.assert_tournament_ready_for_active();

REVOKE ALL ON FUNCTION public.assert_tournament_ready_for_active() FROM PUBLIC;
