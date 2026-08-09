-- Fix ELO recalculation logic and logs
-- 1. TRUNCATE elo_calculation_logs in recalculate_all_elo
-- 2. Skip ELO math for friendly matches entirely in recalculate_all_elo (just update wins/losses)
-- 3. Insert elo_calculation_logs in recalculate_tournament_elo

CREATE OR REPLACE FUNCTION recalculate_all_elo() RETURNS void AS $$
DECLARE
  m_record RECORD;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Reset all ELOs to base 1200 and matches played to 0
  UPDATE players SET 
    singles_matches_played = 0,
    doubles_matches_played = 0,
    mixed_matches_played = 0,
    singles_elo = 1200, 
    doubles_elo = 1200, 
    mixed_elo = 1200,
    tournament_singles_elo = 1200,
    tournament_doubles_elo = 1200,
    tournament_mixed_elo = 1200,
    elo_rating = 1200,
    tournament_elo = 1200
  WHERE id IS NOT NULL;

  -- Clear all calculation logs
  DELETE FROM elo_calculation_logs WHERE id IS NOT NULL;

  -- Reset matches table ELO changes (friendly matches give 0 ELO)
  UPDATE matches SET elo_change_p1 = 0, elo_change_p2 = 0, elo_change_p3 = 0, elo_change_p4 = 0 WHERE status = 'completed';

  -- Process Tournament Matches
  PERFORM recalculate_tournament_elo();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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

  SELECT config INTO v_config FROM site_data LIMIT 1;
  IF v_config IS NULL THEN v_config := '{}'::jsonb; END IF;

  FOR m_record IN 
    SELECT tm.*, t.category FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    WHERE tm.status = 'completed' AND t.status != 'deleted'
    ORDER BY tm.scored_at ASC 
  LOOP
    v_category := COALESCE(m_record.category, 'Singles');
    v_is_singles := v_category ILIKE '%MS%' OR v_category ILIKE '%WS%' OR v_category ILIKE '%Singles%';
    v_is_doubles := v_category ILIKE '%MD%' OR v_category ILIKE '%WD%' OR v_category ILIKE '%Doubles%';
    v_is_mixed := v_category ILIKE '%XD%' OR v_category ILIKE '%Mixed%';

    IF NOT v_is_singles AND NOT v_is_doubles AND NOT v_is_mixed THEN
      v_is_singles := TRUE; -- Fallback
    END IF;

    -- Fetch current player stats
    SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
    INTO p1_s_m, p1_d_m, p1_m_m, p1_s_e, p1_d_e, p1_m_e FROM players WHERE id = m_record.player1_id;
    
    SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
    INTO p2_s_m, p2_d_m, p2_m_m, p2_s_e, p2_d_e, p2_m_e FROM players WHERE id = m_record.player2_id;

    IF v_is_doubles OR v_is_mixed THEN
      IF m_record.team1_partner_id IS NOT NULL THEN
        SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
        INTO p3_s_m, p3_d_m, p3_m_m, p3_s_e, p3_d_e, p3_m_e FROM players WHERE id = m_record.team1_partner_id;
      END IF;
      IF m_record.team2_partner_id IS NOT NULL THEN
        SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
        INTO p4_s_m, p4_d_m, p4_m_m, p4_s_e, p4_d_e, p4_m_e FROM players WHERE id = m_record.team2_partner_id;
      END IF;
    END IF;

    -- Map to generic team elos
    IF v_is_singles THEN team1_elo := p1_s_e; team2_elo := p2_s_e; p1_matches := p1_s_m; p2_matches := p2_s_m; END IF;
    IF v_is_doubles THEN team1_elo := (p1_d_e + p2_d_e)/2.0; team2_elo := (p3_d_e + p4_d_e)/2.0; p1_matches := p1_d_m; p2_matches := p3_d_m; END IF;
    IF v_is_mixed THEN team1_elo := (p1_m_e + p2_m_e)/2.0; team2_elo := (p3_m_e + p4_m_e)/2.0; p1_matches := p1_m_m; p2_matches := p3_m_m; END IF;

    -- Calculate expected
    team1_expected := 1.0 / (1.0 + POWER(10, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + POWER(10, (team1_elo - team2_elo) / 400.0));

    -- Actual scores
    team1_actual := CASE WHEN m_record.winner_side = 1 THEN 1.0 ELSE 0.0 END;
    team2_actual := CASE WHEN m_record.winner_side = 2 THEN 1.0 ELSE 0.0 END;

    -- Multipliers
    v_t_mult := COALESCE((v_config->>'club_tournament_multiplier')::NUMERIC, 1.0);
    v_s_mult := get_set_multiplier(array_length(m_record.sets_history, 1));
    v_d_mult := get_match_dominance(m_record.sets_history);

    -- Calculate & Update P1
    change_p1 := ROUND(get_k_factor(p1_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p1_s_m := p1_s_m + 1; p1_s_e := GREATEST(100, p1_s_e + change_p1);
    ELSIF v_is_doubles THEN p1_d_m := p1_d_m + 1; p1_d_e := GREATEST(100, p1_d_e + change_p1);
    ELSE p1_m_m := p1_m_m + 1; p1_m_e := GREATEST(100, p1_m_e + change_p1); END IF;
    p1_elo := calculate_overall_elo(p1_s_e, p1_s_m, p1_d_e, p1_d_m, p1_m_e, p1_m_m);
    UPDATE players SET 
      singles_matches_played = p1_s_m, doubles_matches_played = p1_d_m, mixed_matches_played = p1_m_m,
      singles_elo = p1_s_e, doubles_elo = p1_d_e, mixed_elo = p1_m_e, elo_rating = p1_elo
    WHERE id = m_record.player1_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (m_record.id, m_record.player1_id, p1_elo - change_p1, p1_elo, change_p1, team1_expected, team1_actual, v_category);

    -- Calculate & Update P2
    change_p2 := ROUND(get_k_factor(p2_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p2_s_m := p2_s_m + 1; p2_s_e := GREATEST(100, p2_s_e + change_p2);
    ELSIF v_is_doubles THEN p2_d_m := p2_d_m + 1; p2_d_e := GREATEST(100, p2_d_e + change_p2);
    ELSE p2_m_m := p2_m_m + 1; p2_m_e := GREATEST(100, p2_m_e + change_p2); END IF;
    p2_elo := calculate_overall_elo(p2_s_e, p2_s_m, p2_d_e, p2_d_m, p2_m_e, p2_m_m);
    UPDATE players SET 
      singles_matches_played = p2_s_m, doubles_matches_played = p2_d_m, mixed_matches_played = p2_m_m,
      singles_elo = p2_s_e, doubles_elo = p2_d_e, mixed_elo = p2_m_e, elo_rating = p2_elo
    WHERE id = m_record.player2_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (m_record.id, m_record.player2_id, p2_elo - change_p2, p2_elo, change_p2, team2_expected, team2_actual, v_category);

    -- P3 & P4 (if applicable)
    IF v_is_doubles OR v_is_mixed THEN
      IF m_record.team1_partner_id IS NOT NULL THEN
        change_p3 := ROUND(get_k_factor(p3_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
        IF v_is_doubles THEN p3_d_m := p3_d_m + 1; p3_d_e := GREATEST(100, p3_d_e + change_p3);
        ELSE p3_m_m := p3_m_m + 1; p3_m_e := GREATEST(100, p3_m_e + change_p3); END IF;
        p3_elo := calculate_overall_elo(p3_s_e, p3_s_m, p3_d_e, p3_d_m, p3_m_e, p3_m_m);
        UPDATE players SET 
          doubles_matches_played = p3_d_m, mixed_matches_played = p3_m_m,
          doubles_elo = p3_d_e, mixed_elo = p3_m_e, elo_rating = p3_elo
        WHERE id = m_record.team1_partner_id;

        INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
        VALUES (m_record.id, m_record.team1_partner_id, p3_elo - change_p3, p3_elo, change_p3, team1_expected, team1_actual, v_category);
      END IF;

      IF m_record.team2_partner_id IS NOT NULL THEN
        change_p4 := ROUND(get_k_factor(p4_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
        IF v_is_doubles THEN p4_d_m := p4_d_m + 1; p4_d_e := GREATEST(100, p4_d_e + change_p4);
        ELSE p4_m_m := p4_m_m + 1; p4_m_e := GREATEST(100, p4_m_e + change_p4); END IF;
        p4_elo := calculate_overall_elo(p4_s_e, p4_s_m, p4_d_e, p4_d_m, p4_m_e, p4_m_m);
        UPDATE players SET 
          doubles_matches_played = p4_d_m, mixed_matches_played = p4_m_m,
          doubles_elo = p4_d_e, mixed_elo = p4_m_e, elo_rating = p4_elo
        WHERE id = m_record.team2_partner_id;

        INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
        VALUES (m_record.id, m_record.team2_partner_id, p4_elo - change_p4, p4_elo, change_p4, team2_expected, team2_actual, v_category);
      END IF;
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
