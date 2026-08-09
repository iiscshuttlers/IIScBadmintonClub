-- Update submit_tournament_match to update main elo_rating, singles_elo, doubles_elo, mixed_elo and insert into elo_calculation_logs
CREATE OR REPLACE FUNCTION submit_tournament_match(
  p_match_id    UUID,
  p_winner_side SMALLINT,
  p_score       TEXT,
  p_sets        TEXT[],
  p_umpire_id   UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id   UUID;
  v_loser_id    UUID;
  v_match       tournament_matches%ROWTYPE;
  
  -- Site config variables
  v_k_newbie    NUMERIC;
  v_k_exp       NUMERIC;
  v_t_mult      NUMERIC;

  -- Player variables
  p1_elo INTEGER; p1_cat_elo INTEGER; p1_matches INTEGER; p1_gender TEXT; k_p1 NUMERIC; change_p1 INTEGER; change_p1_cat INTEGER;
  p2_elo INTEGER; p2_cat_elo INTEGER; p2_matches INTEGER; p2_gender TEXT; k_p2 NUMERIC; change_p2 INTEGER; change_p2_cat INTEGER;
  p3_elo INTEGER := NULL; p3_cat_elo INTEGER := NULL; p3_matches INTEGER; p3_gender TEXT; k_p3 NUMERIC; change_p3 INTEGER := 0; change_p3_cat INTEGER := 0;
  p4_elo INTEGER := NULL; p4_cat_elo INTEGER := NULL; p4_matches INTEGER; p4_gender TEXT; k_p4 NUMERIC; change_p4 INTEGER := 0; change_p4_cat INTEGER := 0;

  -- Team variables
  team1_elo NUMERIC;
  team2_elo NUMERIC;
  team1_type TEXT;
  team2_type TEXT;
  team1_expected NUMERIC;
  team2_expected NUMERIC;
  team1_actual NUMERIC;
  team2_actual NUMERIC;

  elo_multiplier NUMERIC := 1.0;
  
  -- Set scaling variables
  num_sets INTEGER;
  sets_multiplier NUMERIC := 1.0;
BEGIN
  -- Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid()
    AND role IN ('admin','master_admin','umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament match not found';
  END IF;

  IF p_winner_side = 1 THEN
    v_winner_id := v_match.player1_id;
    v_loser_id  := v_match.player2_id;
    team1_actual := 1.0;
    team2_actual := 0.0;
  ELSE
    v_winner_id := v_match.player2_id;
    v_loser_id  := v_match.player1_id;
    team1_actual := 0.0;
    team2_actual := 1.0;
  END IF;

  -- Load site config parameters
  SELECT (value->>'k_factor_newbie')::NUMERIC INTO v_k_newbie FROM site_data WHERE key = 'elo_config';
  SELECT (value->>'k_factor_experienced')::NUMERIC INTO v_k_exp FROM site_data WHERE key = 'elo_config';
  SELECT (value->>'tournament_multiplier')::NUMERIC INTO v_t_mult FROM site_data WHERE key = 'elo_config';
  
  v_k_newbie := COALESCE(v_k_newbie, 40.0);
  v_k_exp    := COALESCE(v_k_exp, 20.0);
  v_t_mult   := COALESCE(v_t_mult, 1.5);

  -- Load Player 1
  IF v_match.player1_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200),
           COALESCE(gender, 'Male')
    INTO p1_elo, p1_gender
    FROM players WHERE id = v_match.player1_id;
    
    IF v_match.category = 'Singles' THEN
      SELECT COALESCE(tournament_singles_elo, singles_elo, 1200) INTO p1_cat_elo FROM players WHERE id = v_match.player1_id;
    ELSIF v_match.category = 'Doubles' THEN
      SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p1_cat_elo FROM players WHERE id = v_match.player1_id;
    ELSIF v_match.category = 'Mixed' THEN
      SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p1_cat_elo FROM players WHERE id = v_match.player1_id;
    END IF;
    
    SELECT COUNT(*) INTO p1_matches FROM tournament_matches
    WHERE (player1_id = v_match.player1_id OR player2_id = v_match.player1_id OR player3_id = v_match.player1_id OR player4_id = v_match.player1_id)
      AND status = 'completed';
    k_p1 := CASE WHEN p1_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  -- Load Player 2
  IF v_match.player2_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200),
           COALESCE(gender, 'Male')
    INTO p2_elo, p2_gender
    FROM players WHERE id = v_match.player2_id;
    
    IF v_match.category = 'Singles' THEN
      SELECT COALESCE(tournament_singles_elo, singles_elo, 1200) INTO p2_cat_elo FROM players WHERE id = v_match.player2_id;
    ELSIF v_match.category = 'Doubles' THEN
      SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p2_cat_elo FROM players WHERE id = v_match.player2_id;
    ELSIF v_match.category = 'Mixed' THEN
      SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p2_cat_elo FROM players WHERE id = v_match.player2_id;
    END IF;

    SELECT COUNT(*) INTO p2_matches FROM tournament_matches
    WHERE (player1_id = v_match.player2_id OR player2_id = v_match.player2_id OR player3_id = v_match.player2_id OR player4_id = v_match.player2_id)
      AND status = 'completed';
    k_p2 := CASE WHEN p2_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  -- Load Player 3 & 4 for Doubles/Mixed
  IF v_match.player3_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200), COALESCE(gender, 'Male') INTO p3_elo, p3_gender FROM players WHERE id = v_match.player3_id;
    IF v_match.category = 'Doubles' THEN
      SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p3_cat_elo FROM players WHERE id = v_match.player3_id;
    ELSIF v_match.category = 'Mixed' THEN
      SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p3_cat_elo FROM players WHERE id = v_match.player3_id;
    END IF;
    SELECT COUNT(*) INTO p3_matches FROM tournament_matches WHERE (player1_id = v_match.player3_id OR player2_id = v_match.player3_id OR player3_id = v_match.player3_id OR player4_id = v_match.player3_id) AND status = 'completed';
    k_p3 := CASE WHEN p3_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  IF v_match.player4_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200), COALESCE(gender, 'Male') INTO p4_elo, p4_gender FROM players WHERE id = v_match.player4_id;
    IF v_match.category = 'Doubles' THEN
      SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p4_cat_elo FROM players WHERE id = v_match.player4_id;
    ELSIF v_match.category = 'Mixed' THEN
      SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p4_cat_elo FROM players WHERE id = v_match.player4_id;
    END IF;
    SELECT COUNT(*) INTO p4_matches FROM tournament_matches WHERE (player1_id = v_match.player4_id OR player2_id = v_match.player4_id OR player3_id = v_match.player4_id OR player4_id = v_match.player4_id) AND status = 'completed';
    k_p4 := CASE WHEN p4_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  -- Calculate Team ELOs
  IF v_match.category = 'Singles' THEN
    team1_elo := p1_elo;
    team2_elo := p2_elo;
  ELSE
    team1_elo := (p1_elo + COALESCE(p3_elo, p1_elo)) / 2.0;
    team2_elo := (p2_elo + COALESCE(p4_elo, p2_elo)) / 2.0;
  END IF;

  -- Calculate Set Scaling
  IF p_sets IS NOT NULL AND array_length(p_sets, 1) > 0 THEN
    num_sets := array_length(p_sets, 1);
    IF num_sets = 2 THEN
      sets_multiplier := 1.2;
    ELSIF num_sets >= 3 THEN
      sets_multiplier := 1.0;
    END IF;
  END IF;

  team1_expected := 1.0 / (1.0 + power(10.0, (team2_elo - team1_elo) / 400.0));
  team2_expected := 1.0 / (1.0 + power(10.0, (team1_elo - team2_elo) / 400.0));

  change_p1 := round(k_p1 * (team1_actual - team1_expected) * elo_multiplier * sets_multiplier * v_t_mult);
  change_p2 := round(k_p2 * (team2_actual - team2_expected) * elo_multiplier * sets_multiplier * v_t_mult);

  -- Update Player 1
  IF v_match.player1_id IS NOT NULL THEN
    UPDATE players SET 
      tournament_elo = COALESCE(tournament_elo, 1200) + change_p1,
      elo_rating = COALESCE(elo_rating, 1200) + change_p1
    WHERE id = v_match.player1_id;

    IF v_match.category = 'Singles' THEN
      UPDATE players SET 
        tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p1,
        singles_elo = COALESCE(singles_elo, 1200) + change_p1
      WHERE id = v_match.player1_id;
    ELSIF v_match.category = 'Doubles' THEN
      UPDATE players SET 
        tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p1,
        doubles_elo = COALESCE(doubles_elo, 1200) + change_p1
      WHERE id = v_match.player1_id;
    ELSIF v_match.category = 'Mixed' THEN
      UPDATE players SET 
        tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p1,
        mixed_elo = COALESCE(mixed_elo, 1200) + change_p1
      WHERE id = v_match.player1_id;
    END IF;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (p_match_id, v_match.player1_id, p1_elo, p1_elo + change_p1, change_p1, team1_expected, team1_actual, v_match.category);
  END IF;

  -- Update Player 2
  IF v_match.player2_id IS NOT NULL THEN
    UPDATE players SET 
      tournament_elo = COALESCE(tournament_elo, 1200) + change_p2,
      elo_rating = COALESCE(elo_rating, 1200) + change_p2
    WHERE id = v_match.player2_id;

    IF v_match.category = 'Singles' THEN
      UPDATE players SET 
        tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p2,
        singles_elo = COALESCE(singles_elo, 1200) + change_p2
      WHERE id = v_match.player2_id;
    ELSIF v_match.category = 'Doubles' THEN
      UPDATE players SET 
        tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p2,
        doubles_elo = COALESCE(doubles_elo, 1200) + change_p2
      WHERE id = v_match.player2_id;
    ELSIF v_match.category = 'Mixed' THEN
      UPDATE players SET 
        tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p2,
        mixed_elo = COALESCE(mixed_elo, 1200) + change_p2
      WHERE id = v_match.player2_id;
    END IF;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (p_match_id, v_match.player2_id, p2_elo, p2_elo + change_p2, change_p2, team2_expected, team2_actual, v_match.category);
  END IF;

  -- Update Player 3 & 4 for Doubles/Mixed
  IF v_match.category = 'Doubles' OR v_match.category = 'Mixed' THEN
    change_p3 := round(k_p3 * (team1_actual - team1_expected) * elo_multiplier * sets_multiplier * v_t_mult);
    change_p4 := round(k_p4 * (team2_actual - team2_expected) * elo_multiplier * sets_multiplier * v_t_mult);
    
    IF v_match.player3_id IS NOT NULL THEN
      UPDATE players SET 
        tournament_elo = COALESCE(tournament_elo, 1200) + change_p3,
        elo_rating = COALESCE(elo_rating, 1200) + change_p3
      WHERE id = v_match.player3_id;

      IF v_match.category = 'Doubles' THEN
        UPDATE players SET tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p3, doubles_elo = COALESCE(doubles_elo, 1200) + change_p3 WHERE id = v_match.player3_id;
      ELSIF v_match.category = 'Mixed' THEN
        UPDATE players SET tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p3, mixed_elo = COALESCE(mixed_elo, 1200) + change_p3 WHERE id = v_match.player3_id;
      END IF;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (p_match_id, v_match.player3_id, p3_elo, p3_elo + change_p3, change_p3, team1_expected, team1_actual, v_match.category);
    END IF;

    IF v_match.player4_id IS NOT NULL THEN
      UPDATE players SET 
        tournament_elo = COALESCE(tournament_elo, 1200) + change_p4,
        elo_rating = COALESCE(elo_rating, 1200) + change_p4
      WHERE id = v_match.player4_id;

      IF v_match.category = 'Doubles' THEN
        UPDATE players SET tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p4, doubles_elo = COALESCE(doubles_elo, 1200) + change_p4 WHERE id = v_match.player4_id;
      ELSIF v_match.category = 'Mixed' THEN
        UPDATE players SET tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p4, mixed_elo = COALESCE(mixed_elo, 1200) + change_p4 WHERE id = v_match.player4_id;
      END IF;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (p_match_id, v_match.player4_id, p4_elo, p4_elo + change_p4, change_p4, team2_expected, team2_actual, v_match.category);
    END IF;
  END IF;

  -- Finalize Match
  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    locked       = TRUE,
    umpired_by   = p_umpire_id,
    scored_by    = auth.uid(),
    scored_at    = NOW()
  WHERE id = p_match_id;

  PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
END;
$$;
