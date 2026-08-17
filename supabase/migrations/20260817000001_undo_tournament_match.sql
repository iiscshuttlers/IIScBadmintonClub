-- Migration: Create undo_tournament_match RPC for reversing completed matches (Walkovers, BYEs, Mistakes)

CREATE OR REPLACE FUNCTION undo_tournament_match(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match tournament_matches%ROWTYPE;
  v_log elo_calculation_logs%ROWTYPE;
  v_next tournament_matches%ROWTYPE;
  v_is_singles BOOLEAN;
  v_is_doubles BOOLEAN;
  v_is_mixed BOOLEAN;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- 1. Check auth / permissions
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: only admins can undo tournament matches';
  END IF;
  
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  -- Only allow undoing if it is completed
  IF v_match.status != 'completed' THEN
    RAISE EXCEPTION 'Match is not completed, cannot undo.';
  END IF;

  -- 2. Reverse ELO and Matches Played
  FOR v_log IN SELECT * FROM elo_calculation_logs WHERE match_uuid = p_match_id LOOP
    v_is_singles := (v_log.category ILIKE '%Singles%' OR v_log.category IN ('MS','WS','BS','GS','S','SINGLES'));
    v_is_doubles := (v_log.category ILIKE '%Doubles%' OR v_log.category IN ('MD','WD','BD','GD','D','DOUBLES'));
    v_is_mixed   := (v_log.category ILIKE '%Mixed%'   OR v_log.category IN ('XD','MXD','M','MIXED'));
    
    UPDATE players SET
      singles_matches_played = CASE WHEN v_is_singles THEN GREATEST(0, singles_matches_played - 1) ELSE singles_matches_played END,
      doubles_matches_played = CASE WHEN v_is_doubles THEN GREATEST(0, doubles_matches_played - 1) ELSE doubles_matches_played END,
      mixed_matches_played = CASE WHEN v_is_mixed THEN GREATEST(0, mixed_matches_played - 1) ELSE mixed_matches_played END,
      singles_elo = CASE WHEN v_is_singles THEN GREATEST(100, singles_elo - v_log.elo_change) ELSE singles_elo END,
      doubles_elo = CASE WHEN v_is_doubles THEN GREATEST(100, doubles_elo - v_log.elo_change) ELSE doubles_elo END,
      mixed_elo = CASE WHEN v_is_mixed THEN GREATEST(100, mixed_elo - v_log.elo_change) ELSE mixed_elo END,
      tournament_singles_elo = CASE WHEN v_is_singles THEN GREATEST(100, tournament_singles_elo - v_log.elo_change) ELSE tournament_singles_elo END,
      tournament_doubles_elo = CASE WHEN v_is_doubles THEN GREATEST(100, tournament_doubles_elo - v_log.elo_change) ELSE tournament_doubles_elo END,
      tournament_mixed_elo = CASE WHEN v_is_mixed THEN GREATEST(100, tournament_mixed_elo - v_log.elo_change) ELSE tournament_mixed_elo END,
      elo_rating = GREATEST(100, elo_rating - v_log.elo_change),
      tournament_elo = GREATEST(100, tournament_elo - v_log.elo_change)
    WHERE id = v_log.player_id;
  END LOOP;
  
  DELETE FROM elo_calculation_logs WHERE match_uuid = p_match_id;

  -- 3. Revert next matches in bracket
  IF v_match.advances_to_match IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match;
    
    IF FOUND THEN
      IF v_match.advances_to_position = 1 THEN
        UPDATE tournament_matches
        SET player1_id = NULL, player3_id = NULL, team1_label = 'Winner of ' || v_match.match_code
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = NULL, player4_id = NULL, team2_label = 'Winner of ' || v_match.match_code
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;

  IF v_match.advances_to_match_loser IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match_loser;
    
    IF FOUND THEN
      IF v_match.advances_to_position_loser = 1 THEN
        UPDATE tournament_matches
        SET player1_id = NULL, player3_id = NULL, team1_label = 'Loser of ' || v_match.match_code
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = NULL, player4_id = NULL, team2_label = 'Loser of ' || v_match.match_code
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;

  -- 4. Revert Match itself
  UPDATE tournament_matches SET
    winner_side = NULL,
    winner_id = NULL,
    score = NULL,
    sets_history = '{}',
    status = CASE WHEN umpired_by IS NOT NULL THEN 'in_progress' ELSE 'scheduled' END,
    locked = FALSE,
    scored_by = NULL,
    scored_at = NULL
  WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION undo_tournament_match(UUID) TO authenticated;
