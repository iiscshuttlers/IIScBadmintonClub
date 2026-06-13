-- ============================================================
-- Migration: Add Separate ELO for Singles, Doubles, Mixed
-- ============================================================

-- 1. Add new ELO columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS singles_elo INTEGER DEFAULT 1200;
ALTER TABLE players ADD COLUMN IF NOT EXISTS doubles_elo INTEGER DEFAULT 1200;
ALTER TABLE players ADD COLUMN IF NOT EXISTS mixed_elo INTEGER DEFAULT 1200;

-- 2. Initialize them ONLY if they are not already set (to prevent overwriting if script run twice)
UPDATE players SET 
  singles_elo = COALESCE(singles_elo, 1200),
  doubles_elo = COALESCE(doubles_elo, 1200),
  mixed_elo = COALESCE(mixed_elo, 1200);

-- 2.5 Create ELO calculation logs table
CREATE TABLE IF NOT EXISTS elo_calculation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_uuid UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  player_id TEXT,
  previous_elo INTEGER,
  new_elo INTEGER,
  elo_change INTEGER,
  expected_score NUMERIC,
  actual_score NUMERIC,
  category TEXT
);

-- 3. Update the match confirmation RPC
DROP FUNCTION IF EXISTS confirm_friendly_match(UUID, TEXT);

CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id TEXT
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
  p_id TEXT;
  
  -- Player variables
  p1_elo INTEGER; p1_matches INTEGER; p1_gender TEXT; k_p1 INTEGER; change_p1 INTEGER;
  p2_elo INTEGER; p2_matches INTEGER; p2_gender TEXT; k_p2 INTEGER; change_p2 INTEGER;
  p3_elo INTEGER := NULL; p3_matches INTEGER; p3_gender TEXT; k_p3 INTEGER; change_p3 INTEGER := 0;
  p4_elo INTEGER := NULL; p4_matches INTEGER; p4_gender TEXT; k_p4 INTEGER; change_p4 INTEGER := 0;

  -- Raw Elo vars
  p1_s INTEGER; p1_d INTEGER; p1_m INTEGER;
  p2_s INTEGER; p2_d INTEGER; p2_m INTEGER;
  p3_s INTEGER; p3_d INTEGER; p3_m INTEGER;
  p4_s INTEGER; p4_d INTEGER; p4_m INTEGER;

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

  -- Get current Elo ratings and genders for primary players
  SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p1_s, p1_d, p1_m, p1_matches, p1_gender FROM players WHERE id = m_record.player1_id;
  SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p2_s, p2_d, p2_m, p2_matches, p2_gender FROM players WHERE id = m_record.player2_id;

  IF m_record.category = 'Singles' THEN
    IF p1_gender IS DISTINCT FROM p2_gender AND p1_gender IS NOT NULL AND p2_gender IS NOT NULL THEN
      RAISE EXCEPTION 'Cross-gender Singles matches (MS vs WS) are not allowed.';
    END IF;
  END IF;

  k_p1 := CASE WHEN p1_matches < 10 THEN 40 ELSE 20 END;
  k_p2 := CASE WHEN p2_matches < 10 THEN 40 ELSE 20 END;

  -- Determine actual outcome (1 = win, 0 = loss)
  team1_actual := CASE WHEN m_record.winner_id = m_record.player1_id OR m_record.winner_id = m_record.team1_partner_id THEN 1.0 ELSE 0.0 END;
  team2_actual := CASE WHEN m_record.winner_id = m_record.player2_id OR m_record.winner_id = m_record.team2_partner_id THEN 1.0 ELSE 0.0 END;

  -- If Doubles, fetch partner data and apply team logic
  IF m_record.category = 'Doubles' THEN
    SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p3_s, p3_d, p3_m, p3_matches, p3_gender FROM players WHERE id = m_record.team1_partner_id;
    SELECT singles_elo, doubles_elo, mixed_elo, total_friendly_matches, gender INTO p4_s, p4_d, p4_m, p4_matches, p4_gender FROM players WHERE id = m_record.team2_partner_id;
    
    k_p3 := CASE WHEN p3_matches < 10 THEN 40 ELSE 20 END;
    k_p4 := CASE WHEN p4_matches < 10 THEN 40 ELSE 20 END;

    -- Determine Team Types (MD, WD, XD)
    IF p1_gender = 'Male' AND p3_gender = 'Male' THEN team1_type := 'MD';
    ELSIF p1_gender = 'Female' AND p3_gender = 'Female' THEN team1_type := 'WD';
    ELSE team1_type := 'XD'; END IF;
    
    IF p2_gender = 'Male' AND p4_gender = 'Male' THEN team2_type := 'MD';
    ELSIF p2_gender = 'Female' AND p4_gender = 'Female' THEN team2_type := 'WD';
    ELSE team2_type := 'XD'; END IF;

    IF team1_type != team2_type THEN
      RAISE EXCEPTION 'Hybrid matches (e.g. % vs %) are not allowed. Teams must be the same format.', team1_type, team2_type;
    END IF;

    -- Assign specific ELO based on team type
    p1_elo := CASE WHEN team1_type = 'XD' THEN p1_m ELSE p1_d END;
    p3_elo := CASE WHEN team1_type = 'XD' THEN p3_m ELSE p3_d END;

    p2_elo := CASE WHEN team2_type = 'XD' THEN p2_m ELSE p2_d END;
    p4_elo := CASE WHEN team2_type = 'XD' THEN p4_m ELSE p4_d END;

    -- Team Elo is the average of both partners
    team1_elo := (p1_elo + p3_elo) / 2.0;
    team2_elo := (p2_elo + p4_elo) / 2.0;

  ELSIF m_record.category = 'Singles' THEN
    p1_elo := p1_s;
    p2_elo := p2_s;
    
    team1_elo := p1_elo;
    team2_elo := p2_elo;
  END IF;

  -- Calculate Expected Outcomes based on Team Elos
  team1_expected := 1.0 / (1.0 + power(10.0, (team2_elo - team1_elo) / 400.0));
  team2_expected := 1.0 / (1.0 + power(10.0, (team1_elo - team2_elo) / 400.0));

  -- Calculate Individual Elo Changes using personal K factors
  change_p1 := round(k_p1 * (team1_actual - team1_expected) * elo_multiplier);
  change_p2 := round(k_p2 * (team2_actual - team2_expected) * elo_multiplier);

  -- Update Primary Players specific ELO
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

  -- We still update elo_rating to act as a general average or legacy column so things don't break immediately
  UPDATE players SET elo_rating = elo_rating + (change_p1 / 2) WHERE id = m_record.player1_id;
  UPDATE players SET elo_rating = elo_rating + (change_p2 / 2) WHERE id = m_record.player2_id;

  -- Record ELO Logs
  INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category) VALUES
  (match_uuid, m_record.player1_id, p1_elo, p1_elo + change_p1, change_p1, team1_expected, team1_actual, m_record.category),
  (match_uuid, m_record.player2_id, p2_elo, p2_elo + change_p2, change_p2, team2_expected, team2_actual, m_record.category);

  -- Update Partners if Doubles
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

    -- Legacy update
    UPDATE players SET elo_rating = elo_rating + (change_p3 / 2) WHERE id = m_record.team1_partner_id;
    UPDATE players SET elo_rating = elo_rating + (change_p4 / 2) WHERE id = m_record.team2_partner_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category) VALUES
    (match_uuid, m_record.team1_partner_id, p3_elo, p3_elo + change_p3, change_p3, team1_expected, team1_actual, m_record.category),
    (match_uuid, m_record.team2_partner_id, p4_elo, p4_elo + change_p4, change_p4, team2_expected, team2_actual, m_record.category);
  END IF;

  -- Update Match Record
  UPDATE matches SET 
    status = 'confirmed', 
    elo_change_p1 = change_p1, 
    elo_change_p2 = change_p2,
    elo_change_p3 = change_p3,
    elo_change_p4 = change_p4
  WHERE id = match_uuid;

  -- Helper array of players to update
  FOR p_id IN SELECT unnest(ARRAY[m_record.player1_id, m_record.player2_id, m_record.team1_partner_id, m_record.team2_partner_id]) LOOP
    IF p_id IS NOT NULL THEN
      WITH p_stats AS (
        SELECT 
          COUNT(*) FILTER (
            WHERE ( (player1_id = p_id OR team1_partner_id = p_id) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
               OR ( (player2_id = p_id OR team2_partner_id = p_id) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
          ) as wins,
          COUNT(*) FILTER (
            WHERE ( (player1_id = p_id OR team1_partner_id = p_id) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
               OR ( (player2_id = p_id OR team2_partner_id = p_id) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
          ) as losses,
          COUNT(*) FILTER (
            WHERE category = 'Singles' AND (
              ( (player1_id = p_id OR team1_partner_id = p_id) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
              OR ( (player2_id = p_id OR team2_partner_id = p_id) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
            )
          ) as s_wins,
          COUNT(*) FILTER (
            WHERE category = 'Singles' AND (
              ( (player1_id = p_id OR team1_partner_id = p_id) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
              OR ( (player2_id = p_id OR team2_partner_id = p_id) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
            )
          ) as s_losses,
          COUNT(*) FILTER (
            WHERE category = 'Doubles' AND (
              ( (player1_id = p_id OR team1_partner_id = p_id) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
              OR ( (player2_id = p_id OR team2_partner_id = p_id) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
            )
          ) as d_wins,
          COUNT(*) FILTER (
            WHERE category = 'Doubles' AND (
              ( (player1_id = p_id OR team1_partner_id = p_id) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
              OR ( (player2_id = p_id OR team2_partner_id = p_id) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
            )
          ) as d_losses
        FROM matches 
        WHERE status = 'confirmed' 
          AND (player1_id = p_id OR player2_id = p_id OR team1_partner_id = p_id OR team2_partner_id = p_id)
      )
      UPDATE players SET 
        win_loss_record = COALESCE((SELECT wins FROM p_stats), 0) || 'W - ' || COALESCE((SELECT losses FROM p_stats), 0) || 'L',
        singles_record = COALESCE((SELECT s_wins FROM p_stats), 0) || 'W - ' || COALESCE((SELECT s_losses FROM p_stats), 0) || 'L',
        doubles_record = COALESCE((SELECT d_wins FROM p_stats), 0) || 'W - ' || COALESCE((SELECT d_losses FROM p_stats), 0) || 'L'
      WHERE id = p_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'p1_elo_change', change_p1,
    'p2_elo_change', change_p2,
    'p3_elo_change', change_p3,
    'p4_elo_change', change_p4
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
