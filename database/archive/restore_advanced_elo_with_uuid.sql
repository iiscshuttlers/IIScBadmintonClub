-- ==============================================================================
-- RESTORE ADVANCED ELO ENGINE (WITH UUID SUPPORT)
-- This restores the Doubles logic, Sets Multiplier, Gender Scaling, and Form Tracking
-- that was accidentally overwritten by the naive UUID migration script.
-- ==============================================================================

-- Drop the old ones to avoid ambiguity
DROP FUNCTION IF EXISTS confirm_friendly_match(UUID, TEXT);
DROP FUNCTION IF EXISTS confirm_friendly_match(TEXT, TEXT);

CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id UUID
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
  
  -- Player variables
  p1_elo INTEGER; p1_matches INTEGER; p1_gender TEXT; k_p1 INTEGER; change_p1 INTEGER;
  p2_elo INTEGER; p2_matches INTEGER; p2_gender TEXT; k_p2 INTEGER; change_p2 INTEGER;
  p3_elo INTEGER := NULL; p3_matches INTEGER; p3_gender TEXT; k_p3 INTEGER; change_p3 INTEGER := 0;
  p4_elo INTEGER := NULL; p4_matches INTEGER; p4_gender TEXT; k_p4 INTEGER; change_p4 INTEGER := 0;

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
BEGIN
  -- Fetch the match
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;
  
  -- Ensure the confirmer is the OTHER player (not the submitter)
  IF confirmer_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
  END IF;
  
  IF confirmer_id IS DISTINCT FROM m_record.player1_id
    AND confirmer_id IS DISTINCT FROM m_record.player2_id
    AND confirmer_id IS DISTINCT FROM m_record.team1_partner_id
    AND confirmer_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  -- ── Server-side score integrity check ──────────────────────────────
  -- Parse actual set scores and verify the declared winner_id is consistent.
  -- Prevents submitter from logging "15-21" but claiming they won.
  DECLARE
    v_score_clean TEXT;
    v_all_parts   TEXT[];
    v_n           INTEGER;
    v_side1_sets  INTEGER := 0;
    v_side2_sets  INTEGER := 0;
    v_s           TEXT[];
    v_i           INTEGER;
    v_a           INTEGER;
    v_b           INTEGER;
    v_is_p1_winner BOOLEAN;
  BEGIN
    IF m_record.score IS NOT NULL AND trim(m_record.score) != '' THEN
      v_score_clean := trim(split_part(m_record.score, '[', 1));
      v_all_parts   := string_to_array(v_score_clean, ',');
      v_n           := array_length(v_all_parts, 1);
      IF v_n IS NOT NULL AND v_n BETWEEN 1 AND 3 THEN
        FOR v_i IN 1..v_n LOOP
          BEGIN
            v_s := string_to_array(trim(v_all_parts[v_i]), '-');
            v_a := trim(v_s[1])::INTEGER;
            v_b := trim(v_s[2])::INTEGER;
            IF v_a > v_b THEN v_side1_sets := v_side1_sets + 1;
            ELSIF v_b > v_a THEN v_side2_sets := v_side2_sets + 1;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL; -- skip unparseable set
          END;
        END LOOP;

        -- Only enforce when there's a clear winner by sets (not a 1-1 split)
        IF v_side1_sets != v_side2_sets THEN
          v_is_p1_winner := (v_side1_sets > v_side2_sets);
          IF v_is_p1_winner AND m_record.winner_id NOT IN (m_record.player1_id, m_record.team1_partner_id) THEN
            RAISE EXCEPTION 'Score mismatch: Team 1 won more sets but winner is declared as Team 2.';
          END IF;
          IF NOT v_is_p1_winner AND m_record.winner_id NOT IN (m_record.player2_id, m_record.team2_partner_id) THEN
            RAISE EXCEPTION 'Score mismatch: Team 2 won more sets but winner is declared as Team 1.';
          END IF;
        END IF;
      END IF;
    END IF;
  END;

  -- Determine number of sets played
  -- Strip doubles annotation (e.g. "[Mixed Doubles: A+B vs C+D]") before parsing
  IF m_record.score IS NULL OR trim(m_record.score) = '' THEN
    num_sets := 1;
    clean_score := '';
  ELSE
    clean_score := trim(split_part(m_record.score, '[', 1));
    num_sets := array_length(string_to_array(clean_score, ','), 1);
  END IF;

  IF num_sets > 3 THEN num_sets := 3; END IF;
  IF num_sets < 1 THEN num_sets := 1; END IF;

  -- Smart sets multiplier:
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

  -- Get current Elo ratings and genders for primary players
  SELECT elo_rating, total_friendly_matches, gender INTO p1_elo, p1_matches, p1_gender FROM players WHERE id = m_record.player1_id;
  SELECT elo_rating, total_friendly_matches, gender INTO p2_elo, p2_matches, p2_gender FROM players WHERE id = m_record.player2_id;

  k_p1 := CASE WHEN p1_matches < 10 THEN 40 ELSE 20 END;
  k_p2 := CASE WHEN p2_matches < 10 THEN 40 ELSE 20 END;

  -- Initialize Team Elos with primary players
  team1_elo := p1_elo;
  team2_elo := p2_elo;

  -- Determine actual outcome (1 = win, 0 = loss)
  team1_actual := CASE WHEN m_record.winner_id = m_record.player1_id OR m_record.winner_id = m_record.team1_partner_id THEN 1.0 ELSE 0.0 END;
  team2_actual := CASE WHEN m_record.winner_id = m_record.player2_id OR m_record.winner_id = m_record.team2_partner_id THEN 1.0 ELSE 0.0 END;

  -- If Doubles, fetch partner data and apply team logic
  IF m_record.category = 'Doubles' THEN
    SELECT elo_rating, total_friendly_matches, gender INTO p3_elo, p3_matches, p3_gender FROM players WHERE id = m_record.team1_partner_id;
    SELECT elo_rating, total_friendly_matches, gender INTO p4_elo, p4_matches, p4_gender FROM players WHERE id = m_record.team2_partner_id;
    
    k_p3 := CASE WHEN p3_matches < 10 THEN 40 ELSE 20 END;
    k_p4 := CASE WHEN p4_matches < 10 THEN 40 ELSE 20 END;

    -- Team Elo is the average of both partners
    team1_elo := (p1_elo + p3_elo) / 2.0;
    team2_elo := (p2_elo + p4_elo) / 2.0;
    
    -- Determine Team Types (MD, WD, XD)
    IF p1_gender = 'Male' AND p3_gender = 'Male' THEN team1_type := 'MD';
    ELSIF p1_gender = 'Female' AND p3_gender = 'Female' THEN team1_type := 'WD';
    ELSE team1_type := 'XD'; END IF;
    
    IF p2_gender = 'Male' AND p4_gender = 'Male' THEN team2_type := 'MD';
    ELSIF p2_gender = 'Female' AND p4_gender = 'Female' THEN team2_type := 'WD';
    ELSE team2_type := 'XD'; END IF;

    -- Multiplier Logic for Doubles Gender Balance
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

  ELSIF m_record.category = 'Singles' THEN
    IF p1_gender = 'Male' AND p2_gender = 'Female' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF p1_gender = 'Female' AND p2_gender = 'Male' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    END IF;
  END IF;

  -- Calculate Expected Outcomes based on Team Elos
  team1_expected := 1.0 / (1.0 + power(10.0, (team2_elo - team1_elo) / 400.0));
  team2_expected := 1.0 / (1.0 + power(10.0, (team1_elo - team2_elo) / 400.0));

  -- Calculate Individual Elo Changes using personal K factors, gender multiplier, AND sets multiplier
  change_p1 := round(k_p1 * (team1_actual - team1_expected) * elo_multiplier * sets_multiplier);
  change_p2 := round(k_p2 * (team2_actual - team2_expected) * elo_multiplier * sets_multiplier);

  -- Update Primary Players
  UPDATE players SET elo_rating = p1_elo + change_p1, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player1_id;
  UPDATE players SET elo_rating = p2_elo + change_p2, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player2_id;

  -- Update Partners if Doubles
  IF m_record.category = 'Doubles' THEN
    change_p3 := round(k_p3 * (team1_actual - team1_expected) * elo_multiplier * sets_multiplier);
    change_p4 := round(k_p4 * (team2_actual - team2_expected) * elo_multiplier * sets_multiplier);
    
    UPDATE players SET elo_rating = p3_elo + change_p3, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team1_partner_id;
    UPDATE players SET elo_rating = p4_elo + change_p4, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team2_partner_id;
  END IF;

  -- Update Match Record
  UPDATE matches SET 
    status = 'confirmed', 
    elo_change_p1 = change_p1, 
    elo_change_p2 = change_p2,
    elo_change_p3 = change_p3,
    elo_change_p4 = change_p4
  WHERE id = match_uuid;

  -- Recalculate win_loss_record for player 1
  WITH p1_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE winner_id = m_record.player1_id OR winner_id = m_record.team1_partner_id) as wins,
      COUNT(*) FILTER (WHERE winner_id != m_record.player1_id AND winner_id != m_record.team1_partner_id) as losses
    FROM matches 
    WHERE status = 'confirmed' AND (player1_id = m_record.player1_id OR player2_id = m_record.player1_id OR team1_partner_id = m_record.player1_id OR team2_partner_id = m_record.player1_id)
  )
  UPDATE players SET win_loss_record = (SELECT wins FROM p1_stats) || 'W - ' || (SELECT losses FROM p1_stats) || 'L' WHERE id = m_record.player1_id;

  -- Recalculate win_loss_record for player 2
  WITH p2_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE winner_id = m_record.player2_id OR winner_id = m_record.team2_partner_id) as wins,
      COUNT(*) FILTER (WHERE winner_id != m_record.player2_id AND winner_id != m_record.team2_partner_id) as losses
    FROM matches 
    WHERE status = 'confirmed' AND (player1_id = m_record.player2_id OR player2_id = m_record.player2_id OR team1_partner_id = m_record.player2_id OR team2_partner_id = m_record.player2_id)
  )
  UPDATE players SET win_loss_record = (SELECT wins FROM p2_stats) || 'W - ' || (SELECT losses FROM p2_stats) || 'L' WHERE id = m_record.player2_id;

  -- Recalculate win_loss_record for player 3
  IF m_record.category = 'Doubles' THEN
    WITH p3_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE winner_id = m_record.player1_id OR winner_id = m_record.team1_partner_id) as wins,
        COUNT(*) FILTER (WHERE winner_id != m_record.player1_id AND winner_id != m_record.team1_partner_id) as losses
      FROM matches 
      WHERE status = 'confirmed' AND (player1_id = m_record.team1_partner_id OR player2_id = m_record.team1_partner_id OR team1_partner_id = m_record.team1_partner_id OR team2_partner_id = m_record.team1_partner_id)
    )
    UPDATE players SET win_loss_record = (SELECT wins FROM p3_stats) || 'W - ' || (SELECT losses FROM p3_stats) || 'L' WHERE id = m_record.team1_partner_id;

    -- Recalculate win_loss_record for player 4
    WITH p4_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE winner_id = m_record.player2_id OR winner_id = m_record.team2_partner_id) as wins,
        COUNT(*) FILTER (WHERE winner_id != m_record.player2_id AND winner_id != m_record.team2_partner_id) as losses
      FROM matches 
      WHERE status = 'confirmed' AND (player1_id = m_record.team2_partner_id OR player2_id = m_record.team2_partner_id OR team1_partner_id = m_record.team2_partner_id OR team2_partner_id = m_record.team2_partner_id)
    )
    UPDATE players SET win_loss_record = (SELECT wins FROM p4_stats) || 'W - ' || (SELECT losses FROM p4_stats) || 'L' WHERE id = m_record.team2_partner_id;
  END IF;

  -- ── Update recent_form array for Dynamic Form Indicators ──
  DECLARE
    p1_res TEXT := CASE WHEN team1_actual = 1.0 THEN 'W' ELSE 'L' END;
    p2_res TEXT := CASE WHEN team2_actual = 1.0 THEN 'W' ELSE 'L' END;
  BEGIN
    UPDATE players SET recent_form = (ARRAY[p1_res] || COALESCE(recent_form, ARRAY[]::TEXT[]))[1:5] WHERE id = m_record.player1_id;
    UPDATE players SET recent_form = (ARRAY[p2_res] || COALESCE(recent_form, ARRAY[]::TEXT[]))[1:5] WHERE id = m_record.player2_id;
    IF m_record.category = 'Doubles' AND m_record.team1_partner_id IS NOT NULL THEN
      UPDATE players SET recent_form = (ARRAY[p1_res] || COALESCE(recent_form, ARRAY[]::TEXT[]))[1:5] WHERE id = m_record.team1_partner_id;
      UPDATE players SET recent_form = (ARRAY[p2_res] || COALESCE(recent_form, ARRAY[]::TEXT[]))[1:5] WHERE id = m_record.team2_partner_id;
    END IF;
  END;

  -- ── ELO Audit Trail: insert logs so the ranking history chart has data ──
  INSERT INTO elo_calculation_logs (player_id, match_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category, created_at)
  VALUES
    (m_record.player1_id, match_uuid, p1_elo, p1_elo + change_p1, change_p1, round(team1_expected::numeric, 4), team1_actual, m_record.category, now()),
    (m_record.player2_id, match_uuid, p2_elo, p2_elo + change_p2, change_p2, round(team2_expected::numeric, 4), team2_actual, m_record.category, now());

  IF m_record.category = 'Doubles' AND m_record.team1_partner_id IS NOT NULL THEN
    INSERT INTO elo_calculation_logs (player_id, match_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category, created_at)
    VALUES
      (m_record.team1_partner_id, match_uuid, p3_elo, p3_elo + change_p3, change_p3, round(team1_expected::numeric, 4), team1_actual, m_record.category, now()),
      (m_record.team2_partner_id, match_uuid, p4_elo, p4_elo + change_p4, change_p4, round(team2_expected::numeric, 4), team2_actual, m_record.category, now());
  END IF;

  -- ── Automated Achievement Engine: Giant Slayer Notification ──
  IF team1_actual = 1.0 AND (team2_elo - team1_elo) >= 150 THEN
    INSERT INTO notifications (user_id, message, type, source_id, created_at, read_status)
    VALUES (m_record.player1_id, '🏅 Achievement Unlocked: Giant Slayer! You defeated an opponent 150+ ELO points higher than you!', 'achievement', m_record.id::TEXT, NOW(), false);
    IF m_record.category = 'Doubles' AND m_record.team1_partner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, message, type, source_id, created_at, read_status)
      VALUES (m_record.team1_partner_id, '🏅 Achievement Unlocked: Giant Slayer! You defeated opponents 150+ ELO points higher than you!', 'achievement', m_record.id::TEXT, NOW(), false);
    END IF;
  ELSIF team2_actual = 1.0 AND (team1_elo - team2_elo) >= 150 THEN
    INSERT INTO notifications (user_id, message, type, source_id, created_at, read_status)
    VALUES (m_record.player2_id, '🏅 Achievement Unlocked: Giant Slayer! You defeated an opponent 150+ ELO points higher than you!', 'achievement', m_record.id::TEXT, NOW(), false);
    IF m_record.category = 'Doubles' AND m_record.team2_partner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, message, type, source_id, created_at, read_status)
      VALUES (m_record.team2_partner_id, '🏅 Achievement Unlocked: Giant Slayer! You defeated opponents 150+ ELO points higher than you!', 'achievement', m_record.id::TEXT, NOW(), false);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'p1_elo_change', change_p1,
    'p2_elo_change', change_p2,
    'p3_elo_change', change_p3,
    'p4_elo_change', change_p4
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
