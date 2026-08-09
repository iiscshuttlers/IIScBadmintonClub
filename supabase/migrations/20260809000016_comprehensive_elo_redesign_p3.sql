-- Update confirm_friendly_match to include new ELO logic
CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id TEXT
) RETURNS JSONB AS $$
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
  
  change_p1 INTEGER := 0; change_p2 INTEGER := 0; change_p3 INTEGER := 0; change_p4 INTEGER := 0;

  team1_elo NUMERIC; team2_elo NUMERIC;
  team1_expected NUMERIC; team2_expected NUMERIC;
  team1_actual NUMERIC; team2_actual NUMERIC;

  v_is_singles BOOLEAN; v_is_doubles BOOLEAN; v_is_mixed BOOLEAN;
  v_t_mult NUMERIC; v_s_mult NUMERIC; v_d_mult NUMERIC;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;
  
  -- Validation checks unless umpire_bypass is passed or system
  IF confirmer_id IS NULL OR (confirmer_id != 'umpire_bypass' AND confirmer_id != 'system') THEN
    IF (confirmer_id::uuid) = m_record.submitted_by THEN
      RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
    END IF;
    
    IF (confirmer_id::uuid) IS DISTINCT FROM m_record.player1_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.player2_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team1_partner_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team2_partner_id THEN
      RAISE EXCEPTION 'You were not a part of this match.';
    END IF;
  END IF;

  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config';
  v_t_mult := COALESCE((v_config->>'friendly_multiplier')::NUMERIC, 1.0);

  IF m_record.winner_id = m_record.player1_id OR m_record.winner_id = m_record.team1_partner_id THEN
    team1_actual := 1.0; team2_actual := 0.0;
  ELSE
    team1_actual := 0.0; team2_actual := 1.0;
  END IF;

  v_is_singles := (m_record.category ILIKE '%Singles%' OR m_record.category IN ('MS','WS','BS','GS','S','SINGLES'));
  v_is_doubles := (m_record.category ILIKE '%Doubles%' OR m_record.category IN ('MD','WD','BD','GD','D','DOUBLES'));
  v_is_mixed   := (m_record.category ILIKE '%Mixed%'   OR m_record.category IN ('XD','MXD','M','MIXED'));
  
  v_s_mult := get_set_multiplier(m_record.sets_history);
  v_d_mult := get_match_dominance(m_record.sets_history);

  IF m_record.player1_id IS NOT NULL AND m_record.player2_id IS NOT NULL THEN
    SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
    INTO p1_s_m, p1_d_m, p1_m_m, p1_s_e, p1_d_e, p1_m_e FROM players WHERE id = m_record.player1_id;
    
    SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
    INTO p2_s_m, p2_d_m, p2_m_m, p2_s_e, p2_d_e, p2_m_e FROM players WHERE id = m_record.player2_id;

    IF v_is_singles THEN team1_elo := p1_s_e; team2_elo := p2_s_e; p1_matches := p1_s_m; p2_matches := p2_s_m;
    ELSIF v_is_doubles THEN team1_elo := p1_d_e; team2_elo := p2_d_e; p1_matches := p1_d_m; p2_matches := p2_d_m;
    ELSE team1_elo := p1_m_e; team2_elo := p2_m_e; p1_matches := p1_m_m; p2_matches := p2_m_m; END IF;

    IF v_is_doubles OR v_is_mixed THEN
      IF m_record.team1_partner_id IS NOT NULL THEN
        SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
        INTO p3_s_m, p3_d_m, p3_m_m, p3_s_e, p3_d_e, p3_m_e FROM players WHERE id = m_record.team1_partner_id;
        IF v_is_doubles THEN team1_elo := (team1_elo + p3_d_e) / 2.0; p3_matches := p3_d_m; ELSE team1_elo := (team1_elo + p3_m_e) / 2.0; p3_matches := p3_m_m; END IF;
      END IF;
      IF m_record.team2_partner_id IS NOT NULL THEN
        SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
        INTO p4_s_m, p4_d_m, p4_m_m, p4_s_e, p4_d_e, p4_m_e FROM players WHERE id = m_record.team2_partner_id;
        IF v_is_doubles THEN team2_elo := (team2_elo + p4_d_e) / 2.0; p4_matches := p4_d_m; ELSE team2_elo := (team2_elo + p4_m_e) / 2.0; p4_matches := p4_m_m; END IF;
      END IF;
    END IF;

    team1_expected := 1.0 / (1.0 + POWER(10.0, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + POWER(10.0, (team1_elo - team2_elo) / 400.0));

    change_p1 := ROUND(get_k_factor(p1_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
    change_p2 := ROUND(get_k_factor(p2_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);

    -- Update Player 1
    IF v_is_singles THEN p1_s_m := p1_s_m + 1; p1_s_e := GREATEST(100, p1_s_e + change_p1);
    ELSIF v_is_doubles THEN p1_d_m := p1_d_m + 1; p1_d_e := GREATEST(100, p1_d_e + change_p1);
    ELSE p1_m_m := p1_m_m + 1; p1_m_e := GREATEST(100, p1_m_e + change_p1); END IF;
    p1_elo := calculate_overall_elo(p1_s_e, p1_s_m, p1_d_e, p1_d_m, p1_m_e, p1_m_m);
    
    UPDATE players SET 
      singles_matches_played = p1_s_m, doubles_matches_played = p1_d_m, mixed_matches_played = p1_m_m,
      singles_elo = p1_s_e, doubles_elo = p1_d_e, mixed_elo = p1_m_e, elo_rating = p1_elo
    WHERE id = m_record.player1_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (match_uuid, m_record.player1_id, p1_elo - change_p1, p1_elo, change_p1, team1_expected, team1_actual, COALESCE(m_record.category, 'Singles'));

    -- Update Player 2
    IF v_is_singles THEN p2_s_m := p2_s_m + 1; p2_s_e := GREATEST(100, p2_s_e + change_p2);
    ELSIF v_is_doubles THEN p2_d_m := p2_d_m + 1; p2_d_e := GREATEST(100, p2_d_e + change_p2);
    ELSE p2_m_m := p2_m_m + 1; p2_m_e := GREATEST(100, p2_m_e + change_p2); END IF;
    p2_elo := calculate_overall_elo(p2_s_e, p2_s_m, p2_d_e, p2_d_m, p2_m_e, p2_m_m);
    
    UPDATE players SET 
      singles_matches_played = p2_s_m, doubles_matches_played = p2_d_m, mixed_matches_played = p2_m_m,
      singles_elo = p2_s_e, doubles_elo = p2_d_e, mixed_elo = p2_m_e, elo_rating = p2_elo
    WHERE id = m_record.player2_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (match_uuid, m_record.player2_id, p2_elo - change_p2, p2_elo, change_p2, team2_expected, team2_actual, COALESCE(m_record.category, 'Singles'));

    -- Player 3 & 4
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
        VALUES (match_uuid, m_record.team1_partner_id, p3_elo - change_p3, p3_elo, change_p3, team1_expected, team1_actual, COALESCE(m_record.category, 'Doubles'));
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
        VALUES (match_uuid, m_record.team2_partner_id, p4_elo - change_p4, p4_elo, change_p4, team2_expected, team2_actual, COALESCE(m_record.category, 'Doubles'));
      END IF;
    END IF;
  END IF;

  -- Mark match as completed
  UPDATE matches 
  SET status = 'completed',
      elo_change_p1 = change_p1,
      elo_change_p2 = change_p2,
      elo_change_p3 = change_p3,
      elo_change_p4 = change_p4
  WHERE id = match_uuid;

  RETURN jsonb_build_object('success', true, 'match_id', match_uuid, 'status', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION confirm_friendly_match(UUID, TEXT) TO authenticated;

-- Update recalculate_all_elo
CREATE OR REPLACE FUNCTION recalculate_all_elo() RETURNS void AS $$
DECLARE
  m_record RECORD;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  UPDATE players SET 
    singles_matches_played = 0,
    doubles_matches_played = 0,
    mixed_matches_played = 0,
    singles_elo = 1200, 
    doubles_elo = 1200, 
    mixed_elo = 1200, 
    elo_rating = 1200, 
    tournament_elo = 1200,
    tournament_singles_elo = 1200,
    tournament_doubles_elo = 1200,
    tournament_mixed_elo = 1200,
    total_friendly_matches = 0,
    win_loss_record = '0W - 0L'
  WHERE id IS NOT NULL;

  DELETE FROM elo_calculation_logs WHERE match_uuid IN (SELECT id FROM matches);

  FOR m_record IN 
    SELECT * FROM matches 
    WHERE status = 'completed' OR status = 'confirmed'
    ORDER BY created_at ASC 
  LOOP
    BEGIN
      -- Set status back to pending so confirm_friendly_match doesn't throw
      UPDATE matches SET status = 'pending' WHERE id = m_record.id;
      PERFORM confirm_friendly_match(m_record.id, 'system');
    EXCEPTION WHEN OTHERS THEN
      UPDATE matches SET status = 'completed', elo_change_p1 = 0, elo_change_p2 = 0 WHERE id = m_record.id;
    END;
  END LOOP;

  PERFORM recalculate_tournament_elo();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION recalculate_all_elo() TO authenticated;
