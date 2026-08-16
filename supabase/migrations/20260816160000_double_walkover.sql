-- Add support for Double Walkover / No Show (p_winner_side = 0)

CREATE OR REPLACE FUNCTION submit_tournament_match(
  p_match_id    UUID,
  p_winner_side SMALLINT,
  p_score       TEXT,
  p_sets        TEXT[],
  p_umpire_id   UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id   UUID; v_loser_id    UUID;
  v_match       tournament_matches%ROWTYPE;
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
  v_t_mult NUMERIC; v_s_mult NUMERIC; v_d_mult NUMERIC;
  v_is_authorized BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_submitter_player_id UUID;
  v_true_umpire_id UUID;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament match not found'; END IF;

  -- Resolve submitter player ID to avoid foreign key violations if auth.uid() is not in players
  SELECT id INTO v_submitter_player_id FROM players WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email')) LIMIT 1;

  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_authorized := true;
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role = 'umpire'
  ) THEN
    v_is_authorized := true;
  ELSIF auth.uid() = v_match.umpired_by THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Resolve true umpire ID for the same reason
  SELECT id INTO v_true_umpire_id FROM players WHERE id = p_umpire_id LIMIT 1;
  IF NOT FOUND THEN
    v_true_umpire_id := v_submitter_player_id;
  END IF;

  IF NOT v_is_admin AND v_match.locked THEN
    RAISE EXCEPTION 'Match results are locked. Contact an admin to modify.';
  END IF;

  IF NOT v_is_admin AND v_match.status = 'completed' AND v_match.scored_at IS NOT NULL AND v_match.scored_at < NOW() - INTERVAL '10 minutes' THEN
    RAISE EXCEPTION 'Match results can only be edited within 10 minutes of completion. Contact an admin.';
  END IF;

  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config';
  v_t_mult := COALESCE((v_config->>'tournament_multiplier_club')::NUMERIC, 1.3);

  IF p_winner_side = 1 THEN
    v_winner_id := v_match.player1_id; v_loser_id  := v_match.player2_id;
    team1_actual := 1.0; team2_actual := 0.0;
  ELSIF p_winner_side = 2 THEN
    v_winner_id := v_match.player2_id; v_loser_id  := v_match.player1_id;
    team1_actual := 0.0; team2_actual := 1.0;
  ELSE
    v_winner_id := NULL; v_loser_id := NULL;
    team1_actual := 0.0; team2_actual := 0.0;
  END IF;

  v_is_singles := (v_match.category ILIKE '%Singles%' OR v_match.category IN ('MS','WS','BS','GS','S','SINGLES'));
  v_is_doubles := (v_match.category ILIKE '%Doubles%' OR v_match.category IN ('MD','WD','BD','GD','D','DOUBLES'));
  v_is_mixed   := (v_match.category ILIKE '%Mixed%'   OR v_match.category IN ('XD','MXD','M','MIXED'));
  
  v_s_mult := get_set_multiplier(p_sets);
  v_d_mult := get_match_dominance(p_sets);

  -- Only calculate Elo if someone actually won/played
  IF p_winner_side IN (1, 2) AND v_match.player1_id IS NOT NULL AND v_match.player2_id IS NOT NULL THEN
    SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
    INTO p1_s_m, p1_d_m, p1_m_m, p1_s_e, p1_d_e, p1_m_e FROM players WHERE id = v_match.player1_id;
    
    SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
    INTO p2_s_m, p2_d_m, p2_m_m, p2_s_e, p2_d_e, p2_m_e FROM players WHERE id = v_match.player2_id;

    IF v_is_singles THEN team1_elo := p1_s_e; team2_elo := p2_s_e; p1_matches := p1_s_m; p2_matches := p2_s_m;
    ELSIF v_is_doubles THEN team1_elo := p1_d_e; team2_elo := p2_d_e; p1_matches := p1_d_m; p2_matches := p2_d_m;
    ELSE team1_elo := p1_m_e; team2_elo := p2_m_e; p1_matches := p1_m_m; p2_matches := p2_m_m; END IF;

    IF v_is_doubles OR v_is_mixed THEN
      IF v_match.player3_id IS NOT NULL THEN
        SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
        INTO p3_s_m, p3_d_m, p3_m_m, p3_s_e, p3_d_e, p3_m_e FROM players WHERE id = v_match.player3_id;
        IF v_is_doubles THEN team1_elo := (team1_elo + p3_d_e) / 2.0; p3_matches := p3_d_m; ELSE team1_elo := (team1_elo + p3_m_e) / 2.0; p3_matches := p3_m_m; END IF;
      END IF;
      IF v_match.player4_id IS NOT NULL THEN
        SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
        INTO p4_s_m, p4_d_m, p4_m_m, p4_s_e, p4_d_e, p4_m_e FROM players WHERE id = v_match.player4_id;
        IF v_is_doubles THEN team2_elo := (team2_elo + p4_d_e) / 2.0; p4_matches := p4_d_m; ELSE team2_elo := (team2_elo + p4_m_e) / 2.0; p4_matches := p4_m_m; END IF;
      END IF;
    END IF;

    team1_expected := 1.0 / (1.0 + POWER(10.0, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + POWER(10.0, (team1_elo - team2_elo) / 400.0));

    change_p1 := ROUND(get_k_factor(p1_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p1_s_m := p1_s_m + 1; p1_s_e := GREATEST(100, p1_s_e + change_p1);
    ELSIF v_is_doubles THEN p1_d_m := p1_d_m + 1; p1_d_e := GREATEST(100, p1_d_e + change_p1);
    ELSE p1_m_m := p1_m_m + 1; p1_m_e := GREATEST(100, p1_m_e + change_p1); END IF;
    p1_elo := calculate_overall_elo(p1_s_e, p1_s_m, p1_d_e, p1_d_m, p1_m_e, p1_m_m);
    
    UPDATE players SET 
      singles_matches_played = p1_s_m, doubles_matches_played = p1_d_m, mixed_matches_played = p1_m_m,
      singles_elo = p1_s_e, doubles_elo = p1_d_e, mixed_elo = p1_m_e,
      tournament_singles_elo = p1_s_e, tournament_doubles_elo = p1_d_e, tournament_mixed_elo = p1_m_e,
      elo_rating = p1_elo, tournament_elo = p1_elo
    WHERE id = v_match.player1_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (p_match_id, v_match.player1_id, p1_elo - change_p1, p1_elo, change_p1, team1_expected, team1_actual, COALESCE(v_match.category, 'Singles'));

    change_p2 := ROUND(get_k_factor(p2_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p2_s_m := p2_s_m + 1; p2_s_e := GREATEST(100, p2_s_e + change_p2);
    ELSIF v_is_doubles THEN p2_d_m := p2_d_m + 1; p2_d_e := GREATEST(100, p2_d_e + change_p2);
    ELSE p2_m_m := p2_m_m + 1; p2_m_e := GREATEST(100, p2_m_e + change_p2); END IF;
    p2_elo := calculate_overall_elo(p2_s_e, p2_s_m, p2_d_e, p2_d_m, p2_m_e, p2_m_m);
    
    UPDATE players SET 
      singles_matches_played = p2_s_m, doubles_matches_played = p2_d_m, mixed_matches_played = p2_m_m,
      singles_elo = p2_s_e, doubles_elo = p2_d_e, mixed_elo = p2_m_e,
      tournament_singles_elo = p2_s_e, tournament_doubles_elo = p2_d_e, tournament_mixed_elo = p2_m_e,
      elo_rating = p2_elo, tournament_elo = p2_elo
    WHERE id = v_match.player2_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (p_match_id, v_match.player2_id, p2_elo - change_p2, p2_elo, change_p2, team2_expected, team2_actual, COALESCE(v_match.category, 'Singles'));

    -- Player 3 & 4
    IF v_is_doubles OR v_is_mixed THEN
      IF v_match.player3_id IS NOT NULL THEN
        change_p3 := ROUND(get_k_factor(p3_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
        IF v_is_doubles THEN p3_d_m := p3_d_m + 1; p3_d_e := GREATEST(100, p3_d_e + change_p3);
        ELSE p3_m_m := p3_m_m + 1; p3_m_e := GREATEST(100, p3_m_e + change_p3); END IF;
        p3_elo := calculate_overall_elo(p3_s_e, p3_s_m, p3_d_e, p3_d_m, p3_m_e, p3_m_m);
        
        UPDATE players SET 
          doubles_matches_played = p3_d_m, mixed_matches_played = p3_m_m,
          doubles_elo = p3_d_e, mixed_elo = p3_m_e,
          tournament_doubles_elo = p3_d_e, tournament_mixed_elo = p3_m_e,
          elo_rating = p3_elo, tournament_elo = p3_elo
        WHERE id = v_match.player3_id;
        INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
        VALUES (p_match_id, v_match.player3_id, p3_elo - change_p3, p3_elo, change_p3, team1_expected, team1_actual, COALESCE(v_match.category, 'Doubles'));
      END IF;

      IF v_match.player4_id IS NOT NULL THEN
        change_p4 := ROUND(get_k_factor(p4_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
        IF v_is_doubles THEN p4_d_m := p4_d_m + 1; p4_d_e := GREATEST(100, p4_d_e + change_p4);
        ELSE p4_m_m := p4_m_m + 1; p4_m_e := GREATEST(100, p4_m_e + change_p4); END IF;
        p4_elo := calculate_overall_elo(p4_s_e, p4_s_m, p4_d_e, p4_d_m, p4_m_e, p4_m_m);
        
        UPDATE players SET 
          doubles_matches_played = p4_d_m, mixed_matches_played = p4_m_m,
          doubles_elo = p4_d_e, mixed_elo = p4_m_e,
          tournament_doubles_elo = p4_d_e, tournament_mixed_elo = p4_m_e,
          elo_rating = p4_elo, tournament_elo = p4_elo
        WHERE id = v_match.player4_id;
        INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
        VALUES (p_match_id, v_match.player4_id, p4_elo - change_p4, p4_elo, change_p4, team2_expected, team2_actual, COALESCE(v_match.category, 'Doubles'));
      END IF;
    END IF;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    locked       = TRUE,
    umpired_by   = COALESCE(umpired_by, v_true_umpire_id),
    scored_by    = COALESCE(scored_by, v_submitter_player_id),
    scored_at    = COALESCE(scored_at, NOW())
  WHERE id = p_match_id;

  PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
END;
$$;


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
  ELSIF p_winner_side = 2 THEN v_winner_id := v_match.player2_id;
  ELSE v_winner_id := NULL;
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

  PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
END;
$$;


CREATE OR REPLACE FUNCTION advance_tournament_winner(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match        tournament_matches%ROWTYPE;
  v_next         tournament_matches%ROWTYPE;
  v_winner_label TEXT;
  v_winner_p1    UUID;
  v_winner_p3    UUID;
  v_loser_label  TEXT;
  v_loser_p1     UUID;
  v_loser_p3     UUID;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- ── Advance winner ──────────────────────────────────────────────────────────
  IF v_match.advances_to_match IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_winner_p1    := v_match.player1_id;
        v_winner_p3    := v_match.player3_id;
        v_winner_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player1_id, v_match.player3_id));
        IF v_winner_label IS NULL OR trim(v_winner_label) = '' THEN
          v_winner_label := v_match.team1_label;
        END IF;
      ELSIF v_match.winner_side = 2 THEN
        v_winner_p1    := v_match.player2_id;
        v_winner_p3    := v_match.player4_id;
        v_winner_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player2_id, v_match.player4_id));
        IF v_winner_label IS NULL OR trim(v_winner_label) = '' THEN
          v_winner_label := v_match.team2_label;
        END IF;
      ELSE
        v_winner_p1    := NULL;
        v_winner_p3    := NULL;
        v_winner_label := 'BYE';
      END IF;

      IF v_match.advances_to_position = 1 THEN
        UPDATE tournament_matches
        SET player1_id = COALESCE(v_winner_p1, player1_id),
            player3_id = COALESCE(v_winner_p3, player3_id),
            team1_label = COALESCE(v_winner_label, team1_label)
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = COALESCE(v_winner_p1, player2_id),
            player4_id = COALESCE(v_winner_p3, player4_id),
            team2_label = COALESCE(v_winner_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;

  -- ── Advance loser to 3rd place match (if configured) ──────────────────────
  IF v_match.advances_to_match_loser IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match_loser;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_loser_p1    := v_match.player2_id;
        v_loser_p3    := v_match.player4_id;
        v_loser_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player2_id, v_match.player4_id));
        IF v_loser_label IS NULL OR trim(v_loser_label) = '' THEN
          v_loser_label := v_match.team2_label;
        END IF;
      ELSIF v_match.winner_side = 2 THEN
        v_loser_p1    := v_match.player1_id;
        v_loser_p3    := v_match.player3_id;
        v_loser_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player1_id, v_match.player3_id));
        IF v_loser_label IS NULL OR trim(v_loser_label) = '' THEN
          v_loser_label := v_match.team1_label;
        END IF;
      ELSE
        v_loser_p1    := NULL;
        v_loser_p3    := NULL;
        v_loser_label := 'BYE';
      END IF;

      IF v_match.advances_to_position_loser = 1 THEN
        UPDATE tournament_matches
        SET player1_id = COALESCE(v_loser_p1, player1_id),
            player3_id = COALESCE(v_loser_p3, player3_id),
            team1_label = COALESCE(v_loser_label, team1_label)
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = COALESCE(v_loser_p1, player2_id),
            player4_id = COALESCE(v_loser_p3, player4_id),
            team2_label = COALESCE(v_loser_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;
END;
$$;
