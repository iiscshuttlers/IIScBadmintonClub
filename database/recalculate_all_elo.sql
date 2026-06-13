-- Run this in Supabase SQL Editor to completely recalculate all ELOs from scratch!
-- This will reset everyone to 1200 and then chronologically process every confirmed match
-- to accurately calculate Singles, Doubles, and Mixed ELOs based ONLY on the matches played.

DO $$
DECLARE
  m_record RECORD;
  
  p1_elo INTEGER; p1_matches INTEGER; p1_gender TEXT; k_p1 INTEGER; change_p1 INTEGER;
  p2_elo INTEGER; p2_matches INTEGER; p2_gender TEXT; k_p2 INTEGER; change_p2 INTEGER;
  p3_elo INTEGER := NULL; p3_matches INTEGER; p3_gender TEXT; k_p3 INTEGER; change_p3 INTEGER := 0;
  p4_elo INTEGER := NULL; p4_matches INTEGER; p4_gender TEXT; k_p4 INTEGER; change_p4 INTEGER := 0;

  p1_s INTEGER; p1_d INTEGER; p1_m INTEGER;
  p2_s INTEGER; p2_d INTEGER; p2_m INTEGER;
  p3_s INTEGER; p3_d INTEGER; p3_m INTEGER;
  p4_s INTEGER; p4_d INTEGER; p4_m INTEGER;

  team1_elo NUMERIC;
  team2_elo NUMERIC;
  team1_type TEXT;
  team2_type TEXT;
  team1_expected NUMERIC;
  team2_expected NUMERIC;
  team1_actual NUMERIC;
  team2_actual NUMERIC;

  elo_multiplier NUMERIC;
BEGIN
  -- 1. Reset all players
  UPDATE players SET 
    singles_elo = 1200, 
    doubles_elo = 1200, 
    mixed_elo = 1200, 
    elo_rating = 1200, 
    total_friendly_matches = 0;
  
  -- 2. Clear previous logs
  DELETE FROM elo_calculation_logs;

  -- 3. Loop through all confirmed matches chronologically
  FOR m_record IN 
    SELECT * FROM matches 
    WHERE status = 'confirmed' 
    ORDER BY created_at ASC 
  LOOP
    elo_multiplier := 1.0;
    
    SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p1_s, p1_d, p1_m, p1_matches, p1_gender FROM players WHERE id = m_record.player1_id;
    SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p2_s, p2_d, p2_m, p2_matches, p2_gender FROM players WHERE id = m_record.player2_id;

    k_p1 := CASE WHEN p1_matches < 10 THEN 40 ELSE 20 END;
    k_p2 := CASE WHEN p2_matches < 10 THEN 40 ELSE 20 END;

    team1_actual := CASE WHEN m_record.winner_id = m_record.player1_id OR m_record.winner_id = m_record.team1_partner_id THEN 1.0 ELSE 0.0 END;
    team2_actual := CASE WHEN m_record.winner_id = m_record.player2_id OR m_record.winner_id = m_record.team2_partner_id THEN 1.0 ELSE 0.0 END;

    IF m_record.category = 'Doubles' THEN
      SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p3_s, p3_d, p3_m, p3_matches, p3_gender FROM players WHERE id = m_record.team1_partner_id;
      SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p4_s, p4_d, p4_m, p4_matches, p4_gender FROM players WHERE id = m_record.team2_partner_id;
      
      k_p3 := CASE WHEN p3_matches < 10 THEN 40 ELSE 20 END;
      k_p4 := CASE WHEN p4_matches < 10 THEN 40 ELSE 20 END;

      IF p1_gender = 'Male' AND p3_gender = 'Male' THEN team1_type := 'MD';
      ELSIF p1_gender = 'Female' AND p3_gender = 'Female' THEN team1_type := 'WD';
      ELSE team1_type := 'XD'; END IF;
      
      IF p2_gender = 'Male' AND p4_gender = 'Male' THEN team2_type := 'MD';
      ELSIF p2_gender = 'Female' AND p4_gender = 'Female' THEN team2_type := 'WD';
      ELSE team2_type := 'XD'; END IF;

      p1_elo := CASE WHEN team1_type = 'XD' THEN p1_m ELSE p1_d END;
      p3_elo := CASE WHEN team1_type = 'XD' THEN p3_m ELSE p3_d END;
      p2_elo := CASE WHEN team2_type = 'XD' THEN p2_m ELSE p2_d END;
      p4_elo := CASE WHEN team2_type = 'XD' THEN p4_m ELSE p4_d END;

      team1_elo := (p1_elo + p3_elo) / 2.0;
      team2_elo := (p2_elo + p4_elo) / 2.0;
    ELSIF m_record.category = 'Singles' THEN
      p1_elo := p1_s;
      p2_elo := p2_s;
      team1_elo := p1_elo;
      team2_elo := p2_elo;
    END IF;

    team1_expected := 1.0 / (1.0 + power(10.0, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + power(10.0, (team1_elo - team2_elo) / 400.0));

    change_p1 := round(k_p1 * (team1_actual - team1_expected) * elo_multiplier);
    change_p2 := round(k_p2 * (team2_actual - team2_expected) * elo_multiplier);

    IF m_record.category = 'Singles' THEN
      UPDATE players SET singles_elo = p1_elo + change_p1, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player1_id;
      UPDATE players SET singles_elo = p2_elo + change_p2, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player2_id;
    ELSIF m_record.category = 'Doubles' THEN
      IF team1_type = 'XD' THEN
        UPDATE players SET mixed_elo = p1_elo + change_p1, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player1_id;
      ELSE
        UPDATE players SET doubles_elo = p1_elo + change_p1, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player1_id;
      END IF;

      IF team2_type = 'XD' THEN
        UPDATE players SET mixed_elo = p2_elo + change_p2, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player2_id;
      ELSE
        UPDATE players SET doubles_elo = p2_elo + change_p2, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player2_id;
      END IF;
    END IF;

    UPDATE players SET elo_rating = elo_rating + (change_p1 / 2) WHERE id = m_record.player1_id;
    UPDATE players SET elo_rating = elo_rating + (change_p2 / 2) WHERE id = m_record.player2_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category) VALUES
    (m_record.id, m_record.player1_id, p1_elo, p1_elo + change_p1, change_p1, team1_expected, team1_actual, m_record.category),
    (m_record.id, m_record.player2_id, p2_elo, p2_elo + change_p2, change_p2, team2_expected, team2_actual, m_record.category);

    IF m_record.category = 'Doubles' THEN
      change_p3 := round(k_p3 * (team1_actual - team1_expected) * elo_multiplier);
      change_p4 := round(k_p4 * (team2_actual - team2_expected) * elo_multiplier);
      
      IF team1_type = 'XD' THEN
        UPDATE players SET mixed_elo = p3_elo + change_p3, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team1_partner_id;
      ELSE
        UPDATE players SET doubles_elo = p3_elo + change_p3, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team1_partner_id;
      END IF;

      IF team2_type = 'XD' THEN
        UPDATE players SET mixed_elo = p4_elo + change_p4, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team2_partner_id;
      ELSE
        UPDATE players SET doubles_elo = p4_elo + change_p4, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team2_partner_id;
      END IF;

      UPDATE players SET elo_rating = elo_rating + (change_p3 / 2) WHERE id = m_record.team1_partner_id;
      UPDATE players SET elo_rating = elo_rating + (change_p4 / 2) WHERE id = m_record.team2_partner_id;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category) VALUES
      (m_record.id, m_record.team1_partner_id, p3_elo, p3_elo + change_p3, change_p3, team1_expected, team1_actual, m_record.category),
      (m_record.id, m_record.team2_partner_id, p4_elo, p4_elo + change_p4, change_p4, team2_expected, team2_actual, m_record.category);
    END IF;

    UPDATE matches SET 
      elo_change_p1 = change_p1, 
      elo_change_p2 = change_p2,
      elo_change_p3 = change_p3,
      elo_change_p4 = change_p4
    WHERE id = m_record.id;
  END LOOP;
END $$;
