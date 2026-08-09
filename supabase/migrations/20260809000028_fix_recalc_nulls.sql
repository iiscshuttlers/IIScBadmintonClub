-- Fix recalculate_tournament_elo NULL handling

CREATE OR REPLACE FUNCTION recalculate_tournament_elo() RETURNS void AS $$
DECLARE
  m_record RECORD;
  v_config JSONB;
  
  p1_matches INTEGER; p2_matches INTEGER; p3_matches INTEGER; p4_matches INTEGER;
  p1_elo INTEGER; p2_elo INTEGER; p3_elo INTEGER; p4_elo INTEGER;
  p1_s_m INTEGER; p2_s_m INTEGER; p3_s_m INTEGER; p4_s_m INTEGER;
  p1_d_m INTEGER; p2_d_m INTEGER; p3_d_m INTEGER; p4_d_m INTEGER;
  p1_m_m INTEGER; p2_m_m INTEGER; p3_m_m INTEGER; p4_m_m INTEGER;
  p1_s_e INTEGER; p2_s_e INTEGER; p3_s_e INTEGER; p4_s_e INTEGER;
  p1_d_e INTEGER; p2_d_e INTEGER; p3_d_e INTEGER; p4_d_e INTEGER;
  p1_m_e INTEGER; p2_m_e INTEGER; p3_m_e INTEGER; p4_m_e INTEGER;
  
  change_p1 INTEGER; change_p2 INTEGER; change_p3 INTEGER; change_p4 INTEGER;

  team1_elo NUMERIC; team2_elo NUMERIC;
  team1_expected NUMERIC; team2_expected NUMERIC;
  team1_actual NUMERIC; team2_actual NUMERIC;

  v_is_singles BOOLEAN; v_is_doubles BOOLEAN; v_is_mixed BOOLEAN;
  v_category TEXT;
  
  v_t_mult NUMERIC;
  v_s_mult NUMERIC;
  v_d_mult NUMERIC;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config' LIMIT 1;
  IF v_config IS NULL THEN v_config := '{}'::jsonb; END IF;

  FOR m_record IN 
    SELECT tm.* FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    WHERE tm.status = 'completed' AND t.status != 'deleted'
    ORDER BY tm.scored_at ASC 
  LOOP
    v_category := COALESCE(m_record.category, 'Singles');
    v_is_singles := v_category ILIKE '%MS%' OR v_category ILIKE '%WS%' OR v_category ILIKE '%Singles%';
    v_is_doubles := v_category ILIKE '%MD%' OR v_category ILIKE '%WD%' OR v_category ILIKE '%Doubles%';
    v_is_mixed := v_category ILIKE '%XD%' OR v_category ILIKE '%Mixed%';

    -- Fetch P1 (guaranteed for a valid match, but COALESCE to be safe)
    IF m_record.player1_id IS NOT NULL THEN
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
             singles_elo, doubles_elo, mixed_elo, elo_rating 
      INTO p1_s_m, p1_d_m, p1_m_m, p1_s_e, p1_d_e, p1_m_e, p1_elo
      FROM players WHERE id = m_record.player1_id;
    ELSE
      p1_s_m := 0; p1_d_m := 0; p1_m_m := 0;
      p1_s_e := 1200; p1_d_e := 1200; p1_m_e := 1200; p1_elo := 1200;
    END IF;

    -- Fetch P2
    IF m_record.player2_id IS NOT NULL THEN
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
             singles_elo, doubles_elo, mixed_elo, elo_rating 
      INTO p2_s_m, p2_d_m, p2_m_m, p2_s_e, p2_d_e, p2_m_e, p2_elo
      FROM players WHERE id = m_record.player2_id;
    ELSE
      p2_s_m := 0; p2_d_m := 0; p2_m_m := 0;
      p2_s_e := 1200; p2_d_e := 1200; p2_m_e := 1200; p2_elo := 1200;
    END IF;

    -- Fetch P3 & P4 (if doubles/mixed)
    IF m_record.player3_id IS NOT NULL THEN
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
             singles_elo, doubles_elo, mixed_elo, elo_rating 
      INTO p3_s_m, p3_d_m, p3_m_m, p3_s_e, p3_d_e, p3_m_e, p3_elo
      FROM players WHERE id = m_record.player3_id;
    ELSE
      p3_s_m := 0; p3_d_m := 0; p3_m_m := 0;
      p3_s_e := 1200; p3_d_e := 1200; p3_m_e := 1200; p3_elo := 1200;
    END IF;
    
    IF m_record.player4_id IS NOT NULL THEN
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
             singles_elo, doubles_elo, mixed_elo, elo_rating 
      INTO p4_s_m, p4_d_m, p4_m_m, p4_s_e, p4_d_e, p4_m_e, p4_elo
      FROM players WHERE id = m_record.player4_id;
    ELSE
      p4_s_m := 0; p4_d_m := 0; p4_m_m := 0;
      p4_s_e := 1200; p4_d_e := 1200; p4_m_e := 1200; p4_elo := 1200;
    END IF;

    -- Determine Team ELOs and matches played based on category
    IF v_is_singles THEN 
      team1_elo := COALESCE(p1_s_e, 1200); 
      team2_elo := COALESCE(p2_s_e, 1200); 
      p1_matches := COALESCE(p1_s_m, 0); 
      p2_matches := COALESCE(p2_s_m, 0); 
    ELSIF v_is_doubles THEN 
      team1_elo := (COALESCE(p1_d_e, 1200) + COALESCE(p3_d_e, p1_d_e, 1200)) / 2.0; 
      team2_elo := (COALESCE(p2_d_e, 1200) + COALESCE(p4_d_e, p2_d_e, 1200)) / 2.0; 
      p1_matches := COALESCE(p1_d_m, 0); 
      p2_matches := COALESCE(p2_d_m, 0);
    ELSE 
      team1_elo := (COALESCE(p1_m_e, 1200) + COALESCE(p3_m_e, p1_m_e, 1200)) / 2.0; 
      team2_elo := (COALESCE(p2_m_e, 1200) + COALESCE(p4_m_e, p2_m_e, 1200)) / 2.0; 
      p1_matches := COALESCE(p1_m_m, 0); 
      p2_matches := COALESCE(p2_m_m, 0); 
    END IF;

    -- Determine Expected Scores
    team1_expected := COALESCE(get_expected_score(team1_elo, team2_elo), 0.5);
    team2_expected := COALESCE(get_expected_score(team2_elo, team1_elo), 0.5);

    -- Actual Outcomes
    IF m_record.winner_id = m_record.player1_id OR m_record.winner_id = m_record.player3_id THEN
      team1_actual := 1; team2_actual := 0;
    ELSIF m_record.winner_id = m_record.player2_id OR m_record.winner_id = m_record.player4_id THEN
      team1_actual := 0; team2_actual := 1;
    ELSE
      -- BYE or draw
      team1_actual := 0.5; team2_actual := 0.5;
    END IF;

    -- Multipliers
    v_t_mult := COALESCE((v_config->>'tournament_multiplier_club')::NUMERIC, 1.3);
    v_s_mult := COALESCE(get_set_multiplier(m_record.sets_history), 1.0);
    v_d_mult := COALESCE(get_match_dominance(m_record.sets_history), 1.0);

    -- Update P1
    IF m_record.player1_id IS NOT NULL THEN
      change_p1 := ROUND(COALESCE(get_k_factor(p1_matches, v_config), 32) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
      IF v_is_singles THEN p1_s_m := p1_s_m + 1; p1_s_e := GREATEST(100, p1_s_e + change_p1);
      ELSIF v_is_doubles THEN p1_d_m := p1_d_m + 1; p1_d_e := GREATEST(100, p1_d_e + change_p1);
      ELSE p1_m_m := p1_m_m + 1; p1_m_e := GREATEST(100, p1_m_e + change_p1); END IF;
      
      p1_elo := COALESCE(calculate_overall_elo(p1_s_e, p1_s_m, p1_d_e, p1_d_m, p1_m_e, p1_m_m), 1200);
      
      UPDATE players SET 
        singles_matches_played = p1_s_m, doubles_matches_played = p1_d_m, mixed_matches_played = p1_m_m,
        singles_elo = p1_s_e, doubles_elo = p1_d_e, mixed_elo = p1_m_e, elo_rating = p1_elo
      WHERE id = m_record.player1_id;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player1_id, p1_elo - change_p1, p1_elo, change_p1, team1_expected, team1_actual, v_category);
    END IF;

    -- Update P2
    IF m_record.player2_id IS NOT NULL THEN
      change_p2 := ROUND(COALESCE(get_k_factor(p2_matches, v_config), 32) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
      IF v_is_singles THEN p2_s_m := p2_s_m + 1; p2_s_e := GREATEST(100, p2_s_e + change_p2);
      ELSIF v_is_doubles THEN p2_d_m := p2_d_m + 1; p2_d_e := GREATEST(100, p2_d_e + change_p2);
      ELSE p2_m_m := p2_m_m + 1; p2_m_e := GREATEST(100, p2_m_e + change_p2); END IF;
      
      p2_elo := COALESCE(calculate_overall_elo(p2_s_e, p2_s_m, p2_d_e, p2_d_m, p2_m_e, p2_m_m), 1200);

      UPDATE players SET 
        singles_matches_played = p2_s_m, doubles_matches_played = p2_d_m, mixed_matches_played = p2_m_m,
        singles_elo = p2_s_e, doubles_elo = p2_d_e, mixed_elo = p2_m_e, elo_rating = p2_elo
      WHERE id = m_record.player2_id;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player2_id, p2_elo - change_p2, p2_elo, change_p2, team2_expected, team2_actual, v_category);
    END IF;

    -- Update P3
    IF m_record.player3_id IS NOT NULL THEN
      p3_matches := COALESCE(CASE WHEN v_is_doubles THEN p3_d_m ELSE p3_m_m END, 0);
      change_p3 := ROUND(COALESCE(get_k_factor(p3_matches, v_config), 32) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
      
      IF v_is_doubles THEN p3_d_m := p3_d_m + 1; p3_d_e := GREATEST(100, p3_d_e + change_p3);
      ELSE p3_m_m := p3_m_m + 1; p3_m_e := GREATEST(100, p3_m_e + change_p3); END IF;
      
      p3_elo := COALESCE(calculate_overall_elo(p3_s_e, p3_s_m, p3_d_e, p3_d_m, p3_m_e, p3_m_m), 1200);

      UPDATE players SET 
        singles_matches_played = p3_s_m, doubles_matches_played = p3_d_m, mixed_matches_played = p3_m_m,
        singles_elo = p3_s_e, doubles_elo = p3_d_e, mixed_elo = p3_m_e, elo_rating = p3_elo
      WHERE id = m_record.player3_id;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player3_id, p3_elo - change_p3, p3_elo, change_p3, team1_expected, team1_actual, v_category);
    END IF;

    -- Update P4
    IF m_record.player4_id IS NOT NULL THEN
      p4_matches := COALESCE(CASE WHEN v_is_doubles THEN p4_d_m ELSE p4_m_m END, 0);
      change_p4 := ROUND(COALESCE(get_k_factor(p4_matches, v_config), 32) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
      
      IF v_is_doubles THEN p4_d_m := p4_d_m + 1; p4_d_e := GREATEST(100, p4_d_e + change_p4);
      ELSE p4_m_m := p4_m_m + 1; p4_m_e := GREATEST(100, p4_m_e + change_p4); END IF;
      
      p4_elo := COALESCE(calculate_overall_elo(p4_s_e, p4_s_m, p4_d_e, p4_d_m, p4_m_e, p4_m_m), 1200);

      UPDATE players SET 
        singles_matches_played = p4_s_m, doubles_matches_played = p4_d_m, mixed_matches_played = p4_m_m,
        singles_elo = p4_s_e, doubles_elo = p4_d_e, mixed_elo = p4_m_e, elo_rating = p4_elo
      WHERE id = m_record.player4_id;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player4_id, p4_elo - change_p4, p4_elo, change_p4, team2_expected, team2_actual, v_category);
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
