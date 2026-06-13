CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id TEXT DEFAULT 'umpire_bypass'
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
  
  -- Player variables
  p1_elo INTEGER; p1_matches INTEGER; p1_gender TEXT; k_p1 INTEGER; change_p1 INTEGER := 0;
  p2_elo INTEGER; p2_matches INTEGER; p2_gender TEXT; k_p2 INTEGER; change_p2 INTEGER := 0;
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
BEGIN
  -- Fetch the match
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;
  
  -- Ensure the confirmer is the OTHER player, unless bypassed by an umpire
  IF confirmer_id != 'umpire_bypass' THEN
    IF confirmer_id = m_record.submitted_by THEN
      RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
    END IF;
    
    IF confirmer_id IS DISTINCT FROM m_record.player1_id
      AND confirmer_id IS DISTINCT FROM m_record.player2_id
      AND confirmer_id IS DISTINCT FROM m_record.team1_partner_id
      AND confirmer_id IS DISTINCT FROM m_record.team2_partner_id THEN
      RAISE EXCEPTION 'You were not a part of this match.';
    END IF;
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

  IF m_record.category = 'Hybrid' THEN
    -- Hybrid matches are unranked (0 ELO change)
    change_p1 := 0;
    change_p2 := 0;
    change_p3 := 0;
    change_p4 := 0;
  ELSIF m_record.category = 'Doubles' THEN
    SELECT elo_rating, total_friendly_matches, gender INTO p3_elo, p3_matches, p3_gender FROM players WHERE id = m_record.team1_partner_id;
    SELECT elo_rating, total_friendly_matches, gender INTO p4_elo, p4_matches, p4_gender FROM players WHERE id = m_record.team2_partner_id;
    
    k_p3 := CASE WHEN p3_matches < 10 THEN 40 ELSE 20 END;
    k_p4 := CASE WHEN p4_matches < 10 THEN 40 ELSE 20 END;

    team1_elo := (p1_elo + p3_elo) / 2.0;
    team2_elo := (p2_elo + p4_elo) / 2.0;
    
    IF p1_gender = 'Male' AND p3_gender = 'Male' THEN team1_type := 'MD';
    ELSIF p1_gender = 'Female' AND p3_gender = 'Female' THEN team1_type := 'WD';
    ELSE team1_type := 'XD'; END IF;
    
    IF p2_gender = 'Male' AND p4_gender = 'Male' THEN team2_type := 'MD';
    ELSIF p2_gender = 'Female' AND p4_gender = 'Female' THEN team2_type := 'WD';
    ELSE team2_type := 'XD'; END IF;

    IF team1_type = 'MD' AND team2_type = 'XD' THEN elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF team1_type = 'MD' AND team2_type = 'WD' THEN elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF team1_type = 'XD' AND team2_type = 'MD' THEN elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    ELSIF team1_type = 'XD' AND team2_type = 'WD' THEN elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF team1_type = 'WD' AND team2_type = 'MD' THEN elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    ELSIF team1_type = 'WD' AND team2_type = 'XD' THEN elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    END IF;

    team1_expected := 1.0 / (1.0 + power(10.0, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + power(10.0, (team1_elo - team2_elo) / 400.0));

    change_p1 := round(k_p1 * (team1_actual - team1_expected) * elo_multiplier);
    change_p2 := round(k_p2 * (team2_actual - team2_expected) * elo_multiplier);
    change_p3 := round(k_p3 * (team1_actual - team1_expected) * elo_multiplier);
    change_p4 := round(k_p4 * (team2_actual - team2_expected) * elo_multiplier);
  ELSIF m_record.category = 'Singles' THEN
    IF p1_gender = 'Male' AND p2_gender = 'Female' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 0.5 ELSE 2.0 END;
    ELSIF p1_gender = 'Female' AND p2_gender = 'Male' THEN
      elo_multiplier := CASE WHEN team1_actual = 1.0 THEN 2.0 ELSE 0.5 END;
    END IF;

    team1_expected := 1.0 / (1.0 + power(10.0, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + power(10.0, (team1_elo - team2_elo) / 400.0));

    change_p1 := round(k_p1 * (team1_actual - team1_expected) * elo_multiplier);
    change_p2 := round(k_p2 * (team2_actual - team2_expected) * elo_multiplier);
  END IF;

  -- Update Primary Players
  UPDATE players SET elo_rating = p1_elo + change_p1, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player1_id;
  UPDATE players SET elo_rating = p2_elo + change_p2, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player2_id;

  -- Update Partners if they exist (applies to Doubles AND Hybrid)
  IF m_record.team1_partner_id IS NOT NULL THEN
    UPDATE players SET elo_rating = elo_rating + change_p3, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team1_partner_id;
  END IF;
  IF m_record.team2_partner_id IS NOT NULL THEN
    UPDATE players SET elo_rating = elo_rating + change_p4, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.team2_partner_id;
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

  -- Recalculate win_loss_record for player 3 (if exists)
  IF m_record.team1_partner_id IS NOT NULL THEN
    WITH p3_stats AS (
      SELECT 
        COUNT(*) FILTER (WHERE winner_id = m_record.player1_id OR winner_id = m_record.team1_partner_id) as wins,
        COUNT(*) FILTER (WHERE winner_id != m_record.player1_id AND winner_id != m_record.team1_partner_id) as losses
      FROM matches 
      WHERE status = 'confirmed' AND (player1_id = m_record.team1_partner_id OR player2_id = m_record.team1_partner_id OR team1_partner_id = m_record.team1_partner_id OR team2_partner_id = m_record.team1_partner_id)
    )
    UPDATE players SET win_loss_record = (SELECT wins FROM p3_stats) || 'W - ' || (SELECT losses FROM p3_stats) || 'L' WHERE id = m_record.team1_partner_id;
  END IF;

  -- Recalculate win_loss_record for player 4 (if exists)
  IF m_record.team2_partner_id IS NOT NULL THEN
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
