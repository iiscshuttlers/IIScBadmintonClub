-- ============================================================
-- Migration: Add Separate ELO for Singles, Doubles, Mixed
-- ============================================================

-- 1. Add new ELO columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS singles_elo INTEGER DEFAULT 1200;
ALTER TABLE players ADD COLUMN IF NOT EXISTS doubles_elo INTEGER DEFAULT 1200;
ALTER TABLE players ADD COLUMN IF NOT EXISTS mixed_elo INTEGER DEFAULT 1200;

-- 2. Initialize them with the current elo_rating to preserve progress
UPDATE players SET 
  singles_elo = elo_rating,
  doubles_elo = elo_rating,
  mixed_elo = elo_rating;

-- 3. Update the match confirmation RPC
CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id TEXT
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
  
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

    -- Assign specific ELO based on team type
    p1_elo := CASE WHEN team1_type = 'XD' THEN p1_m ELSE p1_d END;
    p3_elo := CASE WHEN team1_type = 'XD' THEN p3_m ELSE p3_d END;

    p2_elo := CASE WHEN team2_type = 'XD' THEN p2_m ELSE p2_d END;
    p4_elo := CASE WHEN team2_type = 'XD' THEN p4_m ELSE p4_d END;

    -- Team Elo is the average of both partners
    team1_elo := (p1_elo + p3_elo) / 2.0;
    team2_elo := (p2_elo + p4_elo) / 2.0;

    -- Multiplier Logic for cross-category Doubles
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
    p1_elo := p1_s;
    p2_elo := p2_s;
    
    team1_elo := p1_elo;
    team2_elo := p2_elo;

    IF p1_gender = 'Male' AND p2_gender = 'Female' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF p1_gender = 'Female' AND p2_gender = 'Male' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    END IF;
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
  END IF;

  -- Update Match Record
  UPDATE matches SET 
    status = 'confirmed', 
    elo_change_p1 = change_p1, 
    elo_change_p2 = change_p2,
    elo_change_p3 = change_p3,
    elo_change_p4 = change_p4
  WHERE id = match_uuid;

  -- Win Loss records updates unchanged (omitted re-calc queries for brevity, we leave them as they are in the full script normally, but wait, the existing function recalculates win/loss here. We must keep it!)
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

  IF m_record.category = 'Doubles' THEN
    WITH p3_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE winner_id = m_record.player1_id OR winner_id = m_record.team1_partner_id) as wins,
        COUNT(*) FILTER (WHERE winner_id != m_record.player1_id AND winner_id != m_record.team1_partner_id) as losses
      FROM matches 
      WHERE status = 'confirmed' AND (player1_id = m_record.team1_partner_id OR player2_id = m_record.team1_partner_id OR team1_partner_id = m_record.team1_partner_id OR team2_partner_id = m_record.team1_partner_id)
    )
    UPDATE players SET win_loss_record = (SELECT wins FROM p3_stats) || 'W - ' || (SELECT losses FROM p3_stats) || 'L' WHERE id = m_record.team1_partner_id;

    WITH p4_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE winner_id = m_record.player2_id OR winner_id = m_record.team2_partner_id) as wins,
        COUNT(*) FILTER (WHERE winner_id != m_record.player2_id AND winner_id != m_record.team2_partner_id) as losses
      FROM matches 
      WHERE status = 'confirmed' AND (player1_id = m_record.team2_partner_id OR player2_id = m_record.team2_partner_id OR team1_partner_id = m_record.team2_partner_id OR team2_partner_id = m_record.team2_partner_id)
    )
    UPDATE players SET win_loss_record = (SELECT wins FROM p4_stats) || 'W - ' || (SELECT losses FROM p4_stats) || 'L' WHERE id = m_record.team2_partner_id;
  END IF;

  RETURN jsonb_build_object(
    'p1_elo_change', change_p1,
    'p2_elo_change', change_p2,
    'p3_elo_change', change_p3,
    'p4_elo_change', change_p4
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
