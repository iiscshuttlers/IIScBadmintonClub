-- Fix category matching (MS, WS, MD, WD, XD) and update wins/losses for tournament matches
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
  
  v_k_newbie    NUMERIC;
  v_k_exp       NUMERIC;
  v_t_mult      NUMERIC;

  p1_elo INTEGER; p1_cat_elo INTEGER; p1_matches INTEGER; p1_gender TEXT; k_p1 NUMERIC; change_p1 INTEGER;
  p2_elo INTEGER; p2_cat_elo INTEGER; p2_matches INTEGER; p2_gender TEXT; k_p2 NUMERIC; change_p2 INTEGER;
  p3_elo INTEGER := NULL; p3_cat_elo INTEGER := NULL; p3_matches INTEGER; p3_gender TEXT; k_p3 NUMERIC; change_p3 INTEGER := 0;
  p4_elo INTEGER := NULL; p4_cat_elo INTEGER := NULL; p4_matches INTEGER; p4_gender TEXT; k_p4 NUMERIC; change_p4 INTEGER := 0;

  team1_elo NUMERIC;
  team2_elo NUMERIC;
  team1_expected NUMERIC;
  team2_expected NUMERIC;
  team1_actual NUMERIC;
  team2_actual NUMERIC;

  elo_multiplier NUMERIC := 1.0;
  num_sets INTEGER;
  sets_multiplier NUMERIC := 1.0;

  v_is_singles BOOLEAN := FALSE;
  v_is_doubles BOOLEAN := FALSE;
  v_is_mixed   BOOLEAN := FALSE;
BEGIN
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

  v_is_singles := (v_match.category ILIKE '%Singles%' OR v_match.category IN ('MS','WS','BS','GS','S','SINGLES'));
  v_is_doubles := (v_match.category ILIKE '%Doubles%' OR v_match.category IN ('MD','WD','BD','GD','D','DOUBLES'));
  v_is_mixed   := (v_match.category ILIKE '%Mixed%'   OR v_match.category IN ('XD','MXD','M','MIXED'));

  SELECT (value->>'k_factor_newbie')::NUMERIC INTO v_k_newbie FROM site_data WHERE key = 'elo_config';
  SELECT (value->>'k_factor_experienced')::NUMERIC INTO v_k_exp FROM site_data WHERE key = 'elo_config';
  SELECT (value->>'tournament_multiplier')::NUMERIC INTO v_t_mult FROM site_data WHERE key = 'elo_config';
  
  v_k_newbie := COALESCE(v_k_newbie, 40.0);
  v_k_exp    := COALESCE(v_k_exp, 20.0);
  v_t_mult   := COALESCE(v_t_mult, 1.5);

  -- Player 1
  IF v_match.player1_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200), COALESCE(gender, 'Male') INTO p1_elo, p1_gender FROM players WHERE id = v_match.player1_id;
    IF v_is_singles THEN SELECT COALESCE(tournament_singles_elo, singles_elo, 1200) INTO p1_cat_elo FROM players WHERE id = v_match.player1_id;
    ELSIF v_is_doubles THEN SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p1_cat_elo FROM players WHERE id = v_match.player1_id;
    ELSIF v_is_mixed THEN SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p1_cat_elo FROM players WHERE id = v_match.player1_id;
    END IF;
    SELECT COUNT(*) INTO p1_matches FROM tournament_matches WHERE (player1_id = v_match.player1_id OR player2_id = v_match.player1_id OR player3_id = v_match.player1_id OR player4_id = v_match.player1_id) AND status = 'completed';
    k_p1 := CASE WHEN p1_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  -- Player 2
  IF v_match.player2_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200), COALESCE(gender, 'Male') INTO p2_elo, p2_gender FROM players WHERE id = v_match.player2_id;
    IF v_is_singles THEN SELECT COALESCE(tournament_singles_elo, singles_elo, 1200) INTO p2_cat_elo FROM players WHERE id = v_match.player2_id;
    ELSIF v_is_doubles THEN SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p2_cat_elo FROM players WHERE id = v_match.player2_id;
    ELSIF v_is_mixed THEN SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p2_cat_elo FROM players WHERE id = v_match.player2_id;
    END IF;
    SELECT COUNT(*) INTO p2_matches FROM tournament_matches WHERE (player1_id = v_match.player2_id OR player2_id = v_match.player2_id OR player3_id = v_match.player2_id OR player4_id = v_match.player2_id) AND status = 'completed';
    k_p2 := CASE WHEN p2_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  -- Player 3 & 4
  IF v_match.player3_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200), COALESCE(gender, 'Male') INTO p3_elo, p3_gender FROM players WHERE id = v_match.player3_id;
    IF v_is_doubles THEN SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p3_cat_elo FROM players WHERE id = v_match.player3_id;
    ELSIF v_is_mixed THEN SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p3_cat_elo FROM players WHERE id = v_match.player3_id;
    END IF;
    SELECT COUNT(*) INTO p3_matches FROM tournament_matches WHERE (player1_id = v_match.player3_id OR player2_id = v_match.player3_id OR player3_id = v_match.player3_id OR player4_id = v_match.player3_id) AND status = 'completed';
    k_p3 := CASE WHEN p3_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  IF v_match.player4_id IS NOT NULL THEN
    SELECT COALESCE(tournament_elo, elo_rating, 1200), COALESCE(gender, 'Male') INTO p4_elo, p4_gender FROM players WHERE id = v_match.player4_id;
    IF v_is_doubles THEN SELECT COALESCE(tournament_doubles_elo, doubles_elo, 1200) INTO p4_cat_elo FROM players WHERE id = v_match.player4_id;
    ELSIF v_is_mixed THEN SELECT COALESCE(tournament_mixed_elo, mixed_elo, 1200) INTO p4_cat_elo FROM players WHERE id = v_match.player4_id;
    END IF;
    SELECT COUNT(*) INTO p4_matches FROM tournament_matches WHERE (player1_id = v_match.player4_id OR player2_id = v_match.player4_id OR player3_id = v_match.player4_id OR player4_id = v_match.player4_id) AND status = 'completed';
    k_p4 := CASE WHEN p4_matches < 10 THEN v_k_newbie ELSE v_k_exp END;
  END IF;

  IF v_is_singles THEN
    team1_elo := p1_elo;
    team2_elo := p2_elo;
  ELSE
    team1_elo := (p1_elo + COALESCE(p3_elo, p1_elo)) / 2.0;
    team2_elo := (p2_elo + COALESCE(p4_elo, p2_elo)) / 2.0;
  END IF;

  IF p_sets IS NOT NULL AND array_length(p_sets, 1) > 0 THEN
    num_sets := array_length(p_sets, 1);
    IF num_sets = 2 THEN sets_multiplier := 1.2;
    ELSIF num_sets >= 3 THEN sets_multiplier := 1.0;
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

    IF v_is_singles THEN
      UPDATE players SET tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p1, singles_elo = COALESCE(singles_elo, 1200) + change_p1 WHERE id = v_match.player1_id;
    ELSIF v_is_doubles THEN
      UPDATE players SET tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p1, doubles_elo = COALESCE(doubles_elo, 1200) + change_p1 WHERE id = v_match.player1_id;
    ELSIF v_is_mixed THEN
      UPDATE players SET tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p1, mixed_elo = COALESCE(mixed_elo, 1200) + change_p1 WHERE id = v_match.player1_id;
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

    IF v_is_singles THEN
      UPDATE players SET tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p2, singles_elo = COALESCE(singles_elo, 1200) + change_p2 WHERE id = v_match.player2_id;
    ELSIF v_is_doubles THEN
      UPDATE players SET tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p2, doubles_elo = COALESCE(doubles_elo, 1200) + change_p2 WHERE id = v_match.player2_id;
    ELSIF v_is_mixed THEN
      UPDATE players SET tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p2, mixed_elo = COALESCE(mixed_elo, 1200) + change_p2 WHERE id = v_match.player2_id;
    END IF;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (p_match_id, v_match.player2_id, p2_elo, p2_elo + change_p2, change_p2, team2_expected, team2_actual, v_match.category);
  END IF;

  -- Player 3 & 4
  IF v_is_doubles OR v_is_mixed THEN
    change_p3 := round(k_p3 * (team1_actual - team1_expected) * elo_multiplier * sets_multiplier * v_t_mult);
    change_p4 := round(k_p4 * (team2_actual - team2_expected) * elo_multiplier * sets_multiplier * v_t_mult);
    
    IF v_match.player3_id IS NOT NULL THEN
      UPDATE players SET tournament_elo = COALESCE(tournament_elo, 1200) + change_p3, elo_rating = COALESCE(elo_rating, 1200) + change_p3 WHERE id = v_match.player3_id;
      IF v_is_doubles THEN UPDATE players SET tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p3, doubles_elo = COALESCE(doubles_elo, 1200) + change_p3 WHERE id = v_match.player3_id;
      ELSIF v_is_mixed THEN UPDATE players SET tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p3, mixed_elo = COALESCE(mixed_elo, 1200) + change_p3 WHERE id = v_match.player3_id;
      END IF;
      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (p_match_id, v_match.player3_id, p3_elo, p3_elo + change_p3, change_p3, team1_expected, team1_actual, v_match.category);
    END IF;

    IF v_match.player4_id IS NOT NULL THEN
      UPDATE players SET tournament_elo = COALESCE(tournament_elo, 1200) + change_p4, elo_rating = COALESCE(elo_rating, 1200) + change_p4 WHERE id = v_match.player4_id;
      IF v_is_doubles THEN UPDATE players SET tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p4, doubles_elo = COALESCE(doubles_elo, 1200) + change_p4 WHERE id = v_match.player4_id;
      ELSIF v_is_mixed THEN UPDATE players SET tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p4, mixed_elo = COALESCE(mixed_elo, 1200) + change_p4 WHERE id = v_match.player4_id;
      END IF;
      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (p_match_id, v_match.player4_id, p4_elo, p4_elo + change_p4, change_p4, team2_expected, team2_actual, v_match.category);
    END IF;
  END IF;

  -- Update Win / Loss record
  IF v_winner_id IS NOT NULL THEN
    UPDATE players SET 
      wins = COALESCE(wins, 0) + 1,
      win_loss_record = CONCAT(COALESCE(wins, 0) + 1, 'W - ', COALESCE(losses, 0), 'L')
    WHERE id = v_winner_id;
  END IF;

  IF v_loser_id IS NOT NULL THEN
    UPDATE players SET 
      losses = COALESCE(losses, 0) + 1,
      win_loss_record = CONCAT(COALESCE(wins, 0), 'W - ', COALESCE(losses, 0) + 1, 'L')
    WHERE id = v_loser_id;
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


-- Update recalculate_tournament_elo with normalized category matching & win/loss counts
CREATE OR REPLACE FUNCTION recalculate_tournament_elo() RETURNS void AS $$
DECLARE
  m_record RECORD;
  v_winner_elo  INTEGER;
  v_loser_elo   INTEGER;
  v_expected    NUMERIC;
  v_k           INTEGER := 32;
  v_winner_new  INTEGER;
  v_loser_new   INTEGER;
  v_winner_id   UUID;
  v_loser_id    UUID;
  
  v_p1_cat_elo INTEGER;
  v_p2_cat_elo INTEGER;
  v_p3_cat_elo INTEGER;
  v_p4_cat_elo INTEGER;

  change_p1 INTEGER;
  change_p2 INTEGER;
  change_p3 INTEGER;
  change_p4 INTEGER;

  team1_elo NUMERIC;
  team2_elo NUMERIC;
  team1_expected NUMERIC;
  team2_expected NUMERIC;
  team1_actual NUMERIC;
  team2_actual NUMERIC;

  v_is_singles BOOLEAN;
  v_is_doubles BOOLEAN;
  v_is_mixed   BOOLEAN;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Reset all player stats before replaying
  UPDATE players SET 
    wins = 0,
    losses = 0,
    win_loss_record = '0W - 0L',
    tournament_elo = 1200,
    tournament_singles_elo = 1200,
    tournament_doubles_elo = 1200,
    tournament_mixed_elo = 1200,
    singles_elo = 1200,
    doubles_elo = 1200,
    mixed_elo = 1200,
    elo_rating = 1200
  WHERE id IS NOT NULL;

  DELETE FROM elo_calculation_logs WHERE match_uuid IN (SELECT id FROM tournament_matches);

  FOR m_record IN 
    SELECT tm.* FROM tournament_matches tm
    LEFT JOIN tournaments t ON t.id = tm.tournament_id
    WHERE tm.status = 'completed' AND (t.status IS NULL OR t.status != 'deleted')
    ORDER BY COALESCE(tm.scored_at, tm.created_at) ASC 
  LOOP
    IF m_record.winner_side = 1 THEN
      v_winner_id := m_record.player1_id;
      v_loser_id  := m_record.player2_id;
      team1_actual := 1.0;
      team2_actual := 0.0;
    ELSE
      v_winner_id := m_record.player2_id;
      v_loser_id  := m_record.player1_id;
      team1_actual := 0.0;
      team2_actual := 1.0;
    END IF;

    v_is_singles := (m_record.category ILIKE '%Singles%' OR m_record.category IN ('MS','WS','BS','GS','S','SINGLES'));
    v_is_doubles := (m_record.category ILIKE '%Doubles%' OR m_record.category IN ('MD','WD','BD','GD','D','DOUBLES'));
    v_is_mixed   := (m_record.category ILIKE '%Mixed%'   OR m_record.category IN ('XD','MXD','M','MIXED'));

    IF m_record.player1_id IS NOT NULL AND m_record.player2_id IS NOT NULL THEN
      SELECT COALESCE(elo_rating, 1200) INTO v_winner_elo FROM players WHERE id = m_record.player1_id;
      SELECT COALESCE(elo_rating, 1200) INTO v_loser_elo  FROM players WHERE id = m_record.player2_id;

      team1_elo := v_winner_elo;
      team2_elo := v_loser_elo;

      IF v_is_doubles OR v_is_mixed THEN
        IF m_record.player3_id IS NOT NULL THEN
          SELECT COALESCE(elo_rating, 1200) INTO v_p3_cat_elo FROM players WHERE id = m_record.player3_id;
          team1_elo := (v_winner_elo + v_p3_cat_elo) / 2.0;
        END IF;
        IF m_record.player4_id IS NOT NULL THEN
          SELECT COALESCE(elo_rating, 1200) INTO v_p4_cat_elo FROM players WHERE id = m_record.player4_id;
          team2_elo := (v_loser_elo + v_p4_cat_elo) / 2.0;
        END IF;
      END IF;

      team1_expected := 1.0 / (1.0 + POWER(10.0, (team2_elo - team1_elo) / 400.0));
      team2_expected := 1.0 / (1.0 + POWER(10.0, (team1_elo - team2_elo) / 400.0));

      change_p1 := ROUND(v_k * (team1_actual - team1_expected));
      change_p2 := ROUND(v_k * (team2_actual - team2_expected));

      -- Update Player 1
      UPDATE players SET 
        elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p1),
        tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p1)
      WHERE id = m_record.player1_id;

      IF v_is_singles THEN
        UPDATE players SET singles_elo = COALESCE(singles_elo, 1200) + change_p1, tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p1 WHERE id = m_record.player1_id;
      ELSIF v_is_doubles THEN
        UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p1, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p1 WHERE id = m_record.player1_id;
      ELSIF v_is_mixed THEN
        UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p1, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p1 WHERE id = m_record.player1_id;
      END IF;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player1_id, v_winner_elo, v_winner_elo + change_p1, change_p1, team1_expected, team1_actual, COALESCE(m_record.category, 'Singles'));

      -- Update Player 2
      UPDATE players SET 
        elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p2),
        tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p2)
      WHERE id = m_record.player2_id;

      IF v_is_singles THEN
        UPDATE players SET singles_elo = COALESCE(singles_elo, 1200) + change_p2, tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p2 WHERE id = m_record.player2_id;
      ELSIF v_is_doubles THEN
        UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p2, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p2 WHERE id = m_record.player2_id;
      ELSIF v_is_mixed THEN
        UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p2, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p2 WHERE id = m_record.player2_id;
      END IF;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player2_id, v_loser_elo, v_loser_elo + change_p2, change_p2, team2_expected, team2_actual, COALESCE(m_record.category, 'Singles'));

      -- Player 3 & 4
      IF v_is_doubles OR v_is_mixed THEN
        change_p3 := ROUND(v_k * (team1_actual - team1_expected));
        change_p4 := ROUND(v_k * (team2_actual - team2_expected));

        IF m_record.player3_id IS NOT NULL THEN
          UPDATE players SET elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p3), tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p3) WHERE id = m_record.player3_id;
          IF v_is_doubles THEN UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p3, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p3 WHERE id = m_record.player3_id; END IF;
          IF v_is_mixed THEN UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p3, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p3 WHERE id = m_record.player3_id; END IF;
          INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
          VALUES (m_record.id, m_record.player3_id, v_p3_cat_elo, v_p3_cat_elo + change_p3, change_p3, team1_expected, team1_actual, COALESCE(m_record.category, 'Doubles'));
        END IF;

        IF m_record.player4_id IS NOT NULL THEN
          UPDATE players SET elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p4), tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p4) WHERE id = m_record.player4_id;
          IF v_is_doubles THEN UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p4, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p4 WHERE id = m_record.player4_id; END IF;
          IF v_is_mixed THEN UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p4, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p4 WHERE id = m_record.player4_id; END IF;
          INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
          VALUES (m_record.id, m_record.player4_id, v_p4_cat_elo, v_p4_cat_elo + change_p4, change_p4, team2_expected, team2_actual, COALESCE(m_record.category, 'Doubles'));
        END IF;
      END IF;

      -- Update Win / Loss record for tournament matches
      IF v_winner_id IS NOT NULL THEN
        UPDATE players SET 
          wins = COALESCE(wins, 0) + 1,
          win_loss_record = CONCAT(COALESCE(wins, 0) + 1, 'W - ', COALESCE(losses, 0), 'L')
        WHERE id = v_winner_id;
      END IF;

      IF v_loser_id IS NOT NULL THEN
        UPDATE players SET 
          losses = COALESCE(losses, 0) + 1,
          win_loss_record = CONCAT(COALESCE(wins, 0), 'W - ', COALESCE(losses, 0) + 1, 'L')
        WHERE id = v_loser_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION recalculate_tournament_elo() TO authenticated;
