-- Migration: 20261113104500_add_tournament_score_correction.sql
-- Description: Add audited tournament score correction RPC with revision-matching,
-- authorization check, and downstream match guard.

CREATE OR REPLACE FUNCTION public.apply_tournament_match_correction(
  p_match_id UUID,
  p_winner_side SMALLINT,
  p_score TEXT,
  p_sets TEXT[],
  p_expected_revision BIGINT,
  p_reason TEXT,
  p_operation_id UUID,
  p_scored_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match tournament_matches%ROWTYPE;
  v_authorized BOOLEAN;
  v_winner_id UUID;
  v_actor_player_id UUID;
  v_user_email TEXT;
  v_downstream_active BOOLEAN;
  v_counts_for_elo BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A non-empty reason is required to correct a tournament match result';
  END IF;

  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'operation_id is required';
  END IF;

  IF p_winner_side NOT IN (1, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'winner_side must be 1 or 2';
  END IF;

  IF NULLIF(trim(p_score), '') IS NULL OR COALESCE(cardinality(p_sets), 0) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'score and at least one set are required';
  END IF;

  SELECT * INTO v_match
  FROM public.tournament_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Match not found';
  END IF;

  SELECT public.can_umpire_match(p_match_id, auth.uid()) INTO v_authorized;

  IF v_authorized IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to correct this tournament match result';
  END IF;

  IF v_match.status <> 'completed' OR v_match.winner_side IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Only a completed match result can be corrected';
  END IF;

  SELECT id INTO v_actor_player_id
  FROM public.players
  WHERE id = auth.uid()
     OR email = (auth.jwt()->>'email')
     OR iisc_email = (auth.jwt()->>'email')
  ORDER BY (id = auth.uid()) DESC
  LIMIT 1;

  IF p_scored_by IS NOT NULL AND p_scored_by IS DISTINCT FROM v_actor_player_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'scored_by must identify the authenticated official';
  END IF;

  -- A retry after an uncertain network response must not apply the correction,
  -- audit entry or bracket progression twice.
  IF v_match.result_operation_id = p_operation_id THEN
    IF v_match.winner_side = p_winner_side
      AND v_match.score IS NOT DISTINCT FROM p_score
      AND v_match.sets_history IS NOT DISTINCT FROM p_sets THEN
      RETURN jsonb_build_object(
        'applied', false,
        'revision', v_match.result_revision,
        'operation_id', p_operation_id,
        'reason', 'already_applied'
      );
    END IF;

    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'operation_id was already used with a different correction';
  END IF;

  -- Verify revision has not changed since the preview
  IF v_match.result_revision <> p_expected_revision THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = format('result_revision_conflict: expected %s, current %s', p_expected_revision, v_match.result_revision);
  END IF;

  SELECT COALESCE(counts_for_elo, false) INTO v_counts_for_elo
  FROM public.tournaments
  WHERE id = v_match.tournament_id;

  -- Reversing an already-applied Elo result or team-tie result requires a
  -- coordinated recalculation, which this narrow score-correction RPC does not
  -- perform. Score-only corrections remain safe for those matches.
  IF p_winner_side IS DISTINCT FROM v_match.winner_side
     AND (v_counts_for_elo OR v_match.tie_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '0A000',
      MESSAGE = 'winner_change_requires_coordinated_correction: ranked and team-event winner changes require an administrator recalculation';
  END IF;

  -- Check if downstream match has already started or completed
  IF v_match.advances_to_match IS NOT NULL OR v_match.advances_to_match_loser IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tournament_matches
      WHERE tournament_id = v_match.tournament_id
        AND match_code IN (v_match.advances_to_match, v_match.advances_to_match_loser)
        AND (
          status IN ('in_progress', 'live', 'completed', 'walkover')
          OR score IS NOT NULL
          OR started_at IS NOT NULL
        )
    ) INTO v_downstream_active;

    IF v_downstream_active THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'downstream_match_started: A downstream match has already started or completed. Please use controlled administrator correction.';
    END IF;
  END IF;

  IF p_winner_side = 1 THEN
    v_winner_id := v_match.player1_id;
  ELSIF p_winner_side = 2 THEN
    v_winner_id := v_match.player2_id;
  END IF;

  -- Update the tournament match with corrected result
  UPDATE public.tournament_matches
  SET winner_side = p_winner_side,
      winner_id = v_winner_id,
      score = p_score,
      sets_history = p_sets,
      status = 'completed',
      scored_by = COALESCE(v_actor_player_id, v_match.scored_by),
      scored_at = NOW(),
      result_revision = v_match.result_revision + 1,
      result_operation_id = p_operation_id
  WHERE id = p_match_id;

  -- Advance bracket progression
  PERFORM public.advance_tournament_winner(p_match_id);

  -- Use JWT claims first so the function does not depend on direct auth.users
  -- access, then fall back to the mapped player profile.
  v_user_email := auth.jwt()->>'email';
  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM public.players WHERE id = v_actor_player_id;
  END IF;

  -- Insert audit log entry
  INSERT INTO public.admin_logs (
    admin_email,
    action,
    details,
    created_at
  ) VALUES (
    COALESCE(v_user_email, 'official'),
    'tournament_score_correction',
    jsonb_build_object(
      'match_id', p_match_id,
      'tournament_id', v_match.tournament_id,
      'reason', trim(p_reason),
      'previous_revision', v_match.result_revision,
      'new_revision', v_match.result_revision + 1,
      'previous_winner_side', v_match.winner_side,
      'previous_score', v_match.score,
      'previous_sets', v_match.sets_history,
      'new_winner_side', p_winner_side,
      'new_score', p_score,
      'new_sets', p_sets,
      'operation_id', p_operation_id,
      'actor_id', auth.uid()
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'applied', true,
    'revision', v_match.result_revision + 1,
    'operation_id', p_operation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tournament_match_correction(
  UUID, SMALLINT, TEXT, TEXT[], BIGINT, TEXT, UUID, UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.apply_tournament_match_correction(
  UUID, SMALLINT, TEXT, TEXT[], BIGINT, TEXT, UUID, UUID
) TO authenticated;
