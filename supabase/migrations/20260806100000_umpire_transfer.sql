-- Drop the old signature if it exists
DROP FUNCTION IF EXISTS admin_edit_tournament_match(UUID, SMALLINT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION admin_edit_tournament_match(
  p_match_id    UUID,
  p_winner_side SMALLINT,
  p_score       TEXT,
  p_sets        TEXT[],
  p_scored_by   UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id UUID;
  v_match     tournament_matches%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND (role IN ('admin', 'master_admin') OR id = (SELECT umpired_by FROM tournament_matches WHERE id = p_match_id))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or assigned umpire can edit match score';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF p_winner_side = 1 THEN v_winner_id := v_match.player1_id;
  ELSE                       v_winner_id := v_match.player2_id;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    scored_by    = p_scored_by,
    scored_at    = NOW()
  WHERE id = p_match_id;

  IF v_winner_id IS NOT NULL THEN
    PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_edit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID) TO authenticated;


-- RPC for transferring umpire duty
CREATE OR REPLACE FUNCTION transfer_umpire_duty(
  p_match_id UUID,
  p_new_umpire_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match tournament_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  -- Only admins or the currently assigned umpire can transfer
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE id = auth.uid() 
      AND (role IN ('admin', 'master_admin') OR id = v_match.umpired_by)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or currently assigned umpire can transfer duty';
  END IF;

  UPDATE tournament_matches
  SET umpired_by = p_new_umpire_id
  WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_umpire_duty(UUID, UUID) TO authenticated;
