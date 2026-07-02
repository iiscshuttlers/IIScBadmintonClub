-- 1. Add tournament category ELO columns to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS tournament_singles_elo INTEGER DEFAULT 1200;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tournament_doubles_elo INTEGER DEFAULT 1200;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tournament_mixed_elo INTEGER DEFAULT 1200;

-- 2. Update submit_tournament_match to include advanced ELO calculation using config from site_data
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
  clean_score TEXT;
  set_parts TEXT[];
  set1_parts TEXT[];
  set2_parts TEXT[];
  set1_p1 INTEGER; set1_p2 INTEGER;
  set2_p1 INTEGER; set2_p2 INTEGER;
  p1_sets_won INTEGER; p2_sets_won INTEGER;

  v_category_col TEXT;
BEGIN
  -- Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid()
    AND role IN ('admin','master_admin','umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  
  IF v_match.locked THEN 
    IF NOT EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Match is locked; only admin or master_admin can edit'; 
    END IF;
  END IF;

  IF p_winner_side = 1 THEN
    v_winner_id := v_match.player1_id;
    v_loser_id  := v_match.player2_id;
  ELSE
    v_winner_id := v_match.player2_id;
    v_loser_id  := v_match.player1_id;
  END IF;

  -- Fetch config
  v_k_newbie := COALESCE((SELECT (value->'elo'->>'kNewbie')::numeric FROM site_data WHERE key = 'config'), 40.0);
  v_k_exp := COALESCE((SELECT (value->'elo'->>'kExperienced')::numeric FROM site_data WHERE key = 'config'), 20.0);
  v_t_mult := COALESCE((SELECT (value->'elo'->>'tournamentMultiplier')::numeric FROM site_data WHERE key = 'config'), 1.0);

  -- Determine number of sets played
  IF p_score IS NULL OR trim(p_score) = '' THEN
    num_sets := 1;
    clean_score := '';
  ELSE
    clean_score := trim(split_part(p_score, '[', 1));
    num_sets := array_length(string_to_array(clean_score, ','), 1);
  END IF;

  IF num_sets > 3 THEN num_sets := 3; END IF;
  IF num_sets < 1 THEN num_sets := 1; END IF;

  -- Smart sets multiplier
  IF num_sets = 1 THEN
    sets_multiplier := 1.0 / 3.0;
  ELSIF num_sets = 3 THEN
    sets_multiplier := 1.0;
  ELSE -- num_sets = 2
    BEGIN
      set_parts  := string_to_array(clean_score, ',');
      set1_parts := string_to_array(trim(set_parts[1]), '-');
      set2_parts := string_to_array(trim(set_parts[2]), '-');
      set1_p1 := trim(set1_parts[1])::INTEGER;
      set1_p2 := trim(set1_parts[2])::INTEGER;
      set2_p1 := trim(set2_parts[1])::INTEGER;
      set2_p2 := trim(set2_parts[2])::INTEGER;
      p1_sets_won := 0; p2_sets_won := 0;
      IF set1_p1 > set1_p2 THEN p1_sets_won := p1_sets_won + 1; ELSE p2_sets_won := p2_sets_won + 1; END IF;
      IF set2_p1 > set2_p2 THEN p1_sets_won := p1_sets_won + 1; ELSE p2_sets_won := p2_sets_won + 1; END IF;
      IF p1_sets_won = 2 OR p2_sets_won = 2 THEN
        sets_multiplier := 1.0;       -- 2-0 clean sweep
      ELSE
        sets_multiplier := 2.0 / 3.0; -- 1-1 split
      END IF;
    EXCEPTION WHEN OTHERS THEN
      sets_multiplier := 2.0 / 3.0;   -- fallback if score parsing fails
    END;
  END IF;

  -- Get current Elo ratings and genders for primary players (we use tournament_elo as base, and category as specific)
  SELECT COALESCE(tournament_elo, 1200), COALESCE(
    CASE 
      WHEN v_match.category = 'Singles' THEN tournament_singles_elo
      WHEN v_match.category = 'Doubles' THEN tournament_doubles_elo
      WHEN v_match.category = 'Mixed' THEN tournament_mixed_elo
      ELSE tournament_elo
    END, 1200
  ), (SELECT COUNT(*) FROM tournament_matches WHERE (player1_id = v_match.player1_id OR player2_id = v_match.player1_id OR player3_id = v_match.player1_id OR player4_id = v_match.player1_id) AND status = 'completed'), gender 
  INTO p1_elo, p1_cat_elo, p1_matches, p1_gender FROM players WHERE id = v_match.player1_id;

  SELECT COALESCE(tournament_elo, 1200), COALESCE(
    CASE 
      WHEN v_match.category = 'Singles' THEN tournament_singles_elo
      WHEN v_match.category = 'Doubles' THEN tournament_doubles_elo
      WHEN v_match.category = 'Mixed' THEN tournament_mixed_elo
      ELSE tournament_elo
    END, 1200
  ), (SELECT COUNT(*) FROM tournament_matches WHERE (player1_id = v_match.player2_id OR player2_id = v_match.player2_id OR player3_id = v_match.player2_id OR player4_id = v_match.player2_id) AND status = 'completed'), gender 
  INTO p2_elo, p2_cat_elo, p2_matches, p2_gender FROM players WHERE id = v_match.player2_id;

  k_p1 := CASE WHEN p1_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  k_p2 := CASE WHEN p2_matches < 10 THEN v_k_newbie ELSE v_k_exp END;

  team1_elo := p1_elo;
  team2_elo := p2_elo;

  team1_actual := CASE WHEN p_winner_side = 1 THEN 1.0 ELSE 0.0 END;
  team2_actual := CASE WHEN p_winner_side = 2 THEN 1.0 ELSE 0.0 END;

  IF v_match.category = 'Doubles' OR v_match.category = 'Mixed' THEN
    SELECT COALESCE(tournament_elo, 1200), COALESCE(
      CASE WHEN v_match.category = 'Doubles' THEN tournament_doubles_elo ELSE tournament_mixed_elo END, 1200
    ), (SELECT COUNT(*) FROM tournament_matches WHERE (player1_id = v_match.player3_id OR player2_id = v_match.player3_id OR player3_id = v_match.player3_id OR player4_id = v_match.player3_id) AND status = 'completed'), gender 
    INTO p3_elo, p3_cat_elo, p3_matches, p3_gender FROM players WHERE id = v_match.player3_id;

    SELECT COALESCE(tournament_elo, 1200), COALESCE(
      CASE WHEN v_match.category = 'Doubles' THEN tournament_doubles_elo ELSE tournament_mixed_elo END, 1200
    ), (SELECT COUNT(*) FROM tournament_matches WHERE (player1_id = v_match.player4_id OR player2_id = v_match.player4_id OR player3_id = v_match.player4_id OR player4_id = v_match.player4_id) AND status = 'completed'), gender 
    INTO p4_elo, p4_cat_elo, p4_matches, p4_gender FROM players WHERE id = v_match.player4_id;

    k_p3 := CASE WHEN p3_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
    k_p4 := CASE WHEN p4_matches < 10 THEN v_k_newbie ELSE v_k_exp END;

    team1_elo := (p1_elo + p3_elo) / 2.0;
    team2_elo := (p2_elo + p4_elo) / 2.0;
    
    IF p1_gender = 'Male' AND p3_gender = 'Male' THEN team1_type := 'MD';
    ELSIF p1_gender = 'Female' AND p3_gender = 'Female' THEN team1_type := 'WD';
    ELSE team1_type := 'XD'; END IF;
    
    IF p2_gender = 'Male' AND p4_gender = 'Male' THEN team2_type := 'MD';
    ELSIF p2_gender = 'Female' AND p4_gender = 'Female' THEN team2_type := 'WD';
    ELSE team2_type := 'XD'; END IF;

    IF team1_type = 'MD' AND team2_type = 'XD' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF team1_type = 'MD' AND team2_type = 'WD' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF team1_type = 'XD' AND team2_type = 'MD' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    ELSIF team1_type = 'XD' AND team2_type = 'WD' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF team1_type = 'WD' AND team2_type = 'MD' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    ELSIF team1_type = 'WD' AND team2_type = 'XD' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    END IF;
  ELSIF v_match.category = 'Singles' THEN
    IF p1_gender = 'Male' AND p2_gender = 'Female' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF p1_gender = 'Female' AND p2_gender = 'Male' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    END IF;
  END IF;

  team1_expected := 1.0 / (1.0 + power(10.0, (team2_elo - team1_elo) / 400.0));
  team2_expected := 1.0 / (1.0 + power(10.0, (team1_elo - team2_elo) / 400.0));

  -- Apply tournament multiplier as well
  change_p1 := round(k_p1 * (team1_actual - team1_expected) * elo_multiplier * sets_multiplier * v_t_mult);
  change_p2 := round(k_p2 * (team2_actual - team2_expected) * elo_multiplier * sets_multiplier * v_t_mult);

  UPDATE players SET tournament_elo = p1_elo + change_p1 WHERE id = v_match.player1_id;
  UPDATE players SET tournament_elo = p2_elo + change_p2 WHERE id = v_match.player2_id;

  -- Update specific category ELO
  IF v_match.category = 'Singles' THEN
    UPDATE players SET tournament_singles_elo = p1_cat_elo + change_p1 WHERE id = v_match.player1_id;
    UPDATE players SET tournament_singles_elo = p2_cat_elo + change_p2 WHERE id = v_match.player2_id;
  ELSIF v_match.category = 'Doubles' THEN
    UPDATE players SET tournament_doubles_elo = p1_cat_elo + change_p1 WHERE id = v_match.player1_id;
    UPDATE players SET tournament_doubles_elo = p2_cat_elo + change_p2 WHERE id = v_match.player2_id;
  ELSIF v_match.category = 'Mixed' THEN
    UPDATE players SET tournament_mixed_elo = p1_cat_elo + change_p1 WHERE id = v_match.player1_id;
    UPDATE players SET tournament_mixed_elo = p2_cat_elo + change_p2 WHERE id = v_match.player2_id;
  END IF;

  IF v_match.category = 'Doubles' OR v_match.category = 'Mixed' THEN
    change_p3 := round(k_p3 * (team1_actual - team1_expected) * elo_multiplier * sets_multiplier * v_t_mult);
    change_p4 := round(k_p4 * (team2_actual - team2_expected) * elo_multiplier * sets_multiplier * v_t_mult);
    
    UPDATE players SET tournament_elo = p3_elo + change_p3 WHERE id = v_match.player3_id;
    UPDATE players SET tournament_elo = p4_elo + change_p4 WHERE id = v_match.player4_id;
    
    IF v_match.category = 'Doubles' THEN
      UPDATE players SET tournament_doubles_elo = p3_cat_elo + change_p3 WHERE id = v_match.player3_id;
      UPDATE players SET tournament_doubles_elo = p4_cat_elo + change_p4 WHERE id = v_match.player4_id;
    ELSIF v_match.category = 'Mixed' THEN
      UPDATE players SET tournament_mixed_elo = p3_cat_elo + change_p3 WHERE id = v_match.player3_id;
      UPDATE players SET tournament_mixed_elo = p4_cat_elo + change_p4 WHERE id = v_match.player4_id;
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
