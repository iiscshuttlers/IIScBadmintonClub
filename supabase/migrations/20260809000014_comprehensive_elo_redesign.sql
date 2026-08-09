-- Comprehensive ELO System Redesign

-- 1. Add match count columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS singles_matches_played INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS doubles_matches_played INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS mixed_matches_played   INTEGER DEFAULT 0;

-- 2. Update elo_config in site_data to have the new default settings
UPDATE site_data SET value = '{
  "k_factor_provisional": 40,
  "k_factor_established": 32,
  "k_factor_veteran": 24,
  "provisional_threshold": 10,
  "veteran_threshold": 30,
  "tournament_multiplier_club": 1.3,
  "tournament_multiplier_external": 1.5,
  "friendly_multiplier": 1.0,
  "single_set_multiplier": 0.75,
  "sweep_multiplier": 1.15,
  "full_match_multiplier": 1.0,
  "elo_floor": 100
}'::jsonb
WHERE key = 'elo_config';

-- Helper to parse sets and compute dominance
CREATE OR REPLACE FUNCTION get_match_dominance(p_sets TEXT[]) RETURNS NUMERIC AS $$
DECLARE
  v_set TEXT;
  v_parts TEXT[];
  v_w_score INTEGER;
  v_l_score INTEGER;
  v_dominance NUMERIC := 0.0;
  v_total_dominance NUMERIC := 0.0;
  v_valid_sets INTEGER := 0;
BEGIN
  IF p_sets IS NULL OR array_length(p_sets, 1) = 0 THEN
    RETURN 1.0; -- default competitive
  END IF;

  FOREACH v_set IN ARRAY p_sets LOOP
    BEGIN
      v_parts := string_to_array(trim(v_set), '-');
      IF array_length(v_parts, 1) = 2 THEN
        v_w_score := GREATEST(v_parts[1]::INTEGER, v_parts[2]::INTEGER);
        v_l_score := LEAST(v_parts[1]::INTEGER, v_parts[2]::INTEGER);
        IF v_w_score > 0 THEN
          v_dominance := (v_w_score - v_l_score)::NUMERIC / v_w_score::NUMERIC;
          v_total_dominance := v_total_dominance + v_dominance;
          v_valid_sets := v_valid_sets + 1;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- ignore parsing errors for individual sets
    END;
  END LOOP;

  IF v_valid_sets > 0 THEN
    v_dominance := v_total_dominance / v_valid_sets;
    -- Map dominance score to bonus multiplier
    IF v_dominance < 0.10 THEN RETURN 0.90; END IF;
    IF v_dominance < 0.25 THEN RETURN 1.00; END IF;
    IF v_dominance < 0.50 THEN RETURN 1.05; END IF;
    RETURN 1.10;
  END IF;

  RETURN 1.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_set_multiplier(p_sets TEXT[]) RETURNS NUMERIC AS $$
DECLARE
  num_sets INTEGER;
BEGIN
  IF p_sets IS NULL OR array_length(p_sets, 1) = 0 THEN
    RETURN 1.0; -- Default
  END IF;
  num_sets := array_length(p_sets, 1);
  IF num_sets = 1 THEN RETURN 0.75; END IF;
  IF num_sets = 2 THEN RETURN 1.15; END IF;
  RETURN 1.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_k_factor(p_matches INTEGER, p_config JSONB) RETURNS NUMERIC AS $$
DECLARE
  v_prov_thresh INTEGER := COALESCE((p_config->>'provisional_threshold')::INTEGER, 10);
  v_vet_thresh  INTEGER := COALESCE((p_config->>'veteran_threshold')::INTEGER, 30);
BEGIN
  IF p_matches < v_prov_thresh THEN RETURN COALESCE((p_config->>'k_factor_provisional')::NUMERIC, 40.0); END IF;
  IF p_matches > v_vet_thresh THEN RETURN COALESCE((p_config->>'k_factor_veteran')::NUMERIC, 24.0); END IF;
  RETURN COALESCE((p_config->>'k_factor_established')::NUMERIC, 32.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_overall_elo(p_singles_elo INTEGER, p_singles_matches INTEGER, p_doubles_elo INTEGER, p_doubles_matches INTEGER, p_mixed_elo INTEGER, p_mixed_matches INTEGER) RETURNS INTEGER AS $$
DECLARE
  v_total_weight INTEGER;
  v_weighted_sum NUMERIC;
BEGIN
  v_total_weight := p_singles_matches + p_doubles_matches + p_mixed_matches;
  IF v_total_weight = 0 THEN
    RETURN p_singles_elo; -- Default fallback
  END IF;
  
  v_weighted_sum := (p_singles_elo * p_singles_matches) + (p_doubles_elo * p_doubles_matches) + (p_mixed_elo * p_mixed_matches);
  RETURN ROUND(v_weighted_sum / v_total_weight);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Update recalculate_tournament_elo
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
  
  v_t_mult NUMERIC;
  v_s_mult NUMERIC;
  v_d_mult NUMERIC;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config';
  v_t_mult := COALESCE((v_config->>'tournament_multiplier_club')::NUMERIC, 1.3);

  -- Reset all player stats before replaying
  UPDATE players SET 
    win_loss_record = '0W - 0L',
    singles_matches_played = 0,
    doubles_matches_played = 0,
    mixed_matches_played = 0,
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
      -- Fetch current values
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
      INTO p1_s_m, p1_d_m, p1_m_m, p1_s_e, p1_d_e, p1_m_e FROM players WHERE id = m_record.player1_id;
      
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
      INTO p2_s_m, p2_d_m, p2_m_m, p2_s_e, p2_d_e, p2_m_e FROM players WHERE id = m_record.player2_id;

      IF v_is_singles THEN team1_elo := p1_s_e; team2_elo := p2_s_e; p1_matches := p1_s_m; p2_matches := p2_s_m;
      ELSIF v_is_doubles THEN team1_elo := p1_d_e; team2_elo := p2_d_e; p1_matches := p1_d_m; p2_matches := p2_d_m;
      ELSE team1_elo := p1_m_e; team2_elo := p2_m_e; p1_matches := p1_m_m; p2_matches := p2_m_m; END IF;

      IF v_is_doubles OR v_is_mixed THEN
        IF m_record.player3_id IS NOT NULL THEN
          SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
          INTO p3_s_m, p3_d_m, p3_m_m, p3_s_e, p3_d_e, p3_m_e FROM players WHERE id = m_record.player3_id;
          IF v_is_doubles THEN team1_elo := (team1_elo + p3_d_e) / 2.0; p3_matches := p3_d_m; ELSE team1_elo := (team1_elo + p3_m_e) / 2.0; p3_matches := p3_m_m; END IF;
        END IF;
        IF m_record.player4_id IS NOT NULL THEN
          SELECT singles_matches_played, doubles_matches_played, mixed_matches_played, singles_elo, doubles_elo, mixed_elo 
          INTO p4_s_m, p4_d_m, p4_m_m, p4_s_e, p4_d_e, p4_m_e FROM players WHERE id = m_record.player4_id;
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
        singles_elo = p1_s_e, doubles_elo = p1_d_e, mixed_elo = p1_m_e,
        tournament_singles_elo = p1_s_e, tournament_doubles_elo = p1_d_e, tournament_mixed_elo = p1_m_e,
        elo_rating = p1_elo, tournament_elo = p1_elo
      WHERE id = m_record.player1_id;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player1_id, p1_elo - change_p1, p1_elo, change_p1, team1_expected, team1_actual, COALESCE(m_record.category, 'Singles'));

      -- Update Player 2
      IF v_is_singles THEN p2_s_m := p2_s_m + 1; p2_s_e := GREATEST(100, p2_s_e + change_p2);
      ELSIF v_is_doubles THEN p2_d_m := p2_d_m + 1; p2_d_e := GREATEST(100, p2_d_e + change_p2);
      ELSE p2_m_m := p2_m_m + 1; p2_m_e := GREATEST(100, p2_m_e + change_p2); END IF;
      
      p2_elo := calculate_overall_elo(p2_s_e, p2_s_m, p2_d_e, p2_d_m, p2_m_e, p2_m_m);
      
      UPDATE players SET 
        singles_matches_played = p2_s_m, doubles_matches_played = p2_d_m, mixed_matches_played = p2_m_m,
        singles_elo = p2_s_e, doubles_elo = p2_d_e, mixed_elo = p2_m_e,
        tournament_singles_elo = p2_s_e, tournament_doubles_elo = p2_d_e, tournament_mixed_elo = p2_m_e,
        elo_rating = p2_elo, tournament_elo = p2_elo
      WHERE id = m_record.player2_id;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player2_id, p2_elo - change_p2, p2_elo, change_p2, team2_expected, team2_actual, COALESCE(m_record.category, 'Singles'));

      -- Player 3 & 4
      IF v_is_doubles OR v_is_mixed THEN
        IF m_record.player3_id IS NOT NULL THEN
          change_p3 := ROUND(get_k_factor(p3_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
          IF v_is_doubles THEN p3_d_m := p3_d_m + 1; p3_d_e := GREATEST(100, p3_d_e + change_p3);
          ELSE p3_m_m := p3_m_m + 1; p3_m_e := GREATEST(100, p3_m_e + change_p3); END IF;
          p3_elo := calculate_overall_elo(p3_s_e, p3_s_m, p3_d_e, p3_d_m, p3_m_e, p3_m_m);
          
          UPDATE players SET 
            doubles_matches_played = p3_d_m, mixed_matches_played = p3_m_m,
            doubles_elo = p3_d_e, mixed_elo = p3_m_e,
            tournament_doubles_elo = p3_d_e, tournament_mixed_elo = p3_m_e,
            elo_rating = p3_elo, tournament_elo = p3_elo
          WHERE id = m_record.player3_id;
          INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
          VALUES (m_record.id, m_record.player3_id, p3_elo - change_p3, p3_elo, change_p3, team1_expected, team1_actual, COALESCE(m_record.category, 'Doubles'));
        END IF;

        IF m_record.player4_id IS NOT NULL THEN
          change_p4 := ROUND(get_k_factor(p4_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
          IF v_is_doubles THEN p4_d_m := p4_d_m + 1; p4_d_e := GREATEST(100, p4_d_e + change_p4);
          ELSE p4_m_m := p4_m_m + 1; p4_m_e := GREATEST(100, p4_m_e + change_p4); END IF;
          p4_elo := calculate_overall_elo(p4_s_e, p4_s_m, p4_d_e, p4_d_m, p4_m_e, p4_m_m);
          
          UPDATE players SET 
            doubles_matches_played = p4_d_m, mixed_matches_played = p4_m_m,
            doubles_elo = p4_d_e, mixed_elo = p4_m_e,
            tournament_doubles_elo = p4_d_e, tournament_mixed_elo = p4_m_e,
            elo_rating = p4_elo, tournament_elo = p4_elo
          WHERE id = m_record.player4_id;
          INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
          VALUES (m_record.id, m_record.player4_id, p4_elo - change_p4, p4_elo, change_p4, team2_expected, team2_actual, COALESCE(m_record.category, 'Doubles'));
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
