-- ============================================================
-- Elo Ranking & Anti-Fraud Friendly Matches System
-- ============================================================

-- 1. Add Elo rating to players (Default starting Elo is 1200)
ALTER TABLE players ADD COLUMN IF NOT EXISTS elo_rating INTEGER DEFAULT 1200;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_friendly_matches INTEGER DEFAULT 0;

-- 2. Add verification tracking to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_friendly BOOLEAN DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed'; -- 'pending', 'confirmed', 'rejected'
ALTER TABLE matches ADD COLUMN IF NOT EXISTS submitted_by TEXT REFERENCES players(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS elo_change_p1 INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS elo_change_p2 INTEGER;

-- 3. RPC to SUBMIT a match (Leaves it 'pending', NO Elo update yet)
CREATE OR REPLACE FUNCTION submit_friendly_match(
  submitter_id TEXT, 
  opponent_id TEXT, 
  match_winner_id TEXT, 
  match_score TEXT
) RETURNS UUID AS $$
DECLARE
  new_match_id UUID;
BEGIN
  IF match_winner_id != submitter_id AND match_winner_id != opponent_id THEN
    RAISE EXCEPTION 'Winner must be one of the two players.';
  END IF;

  INSERT INTO matches (
    category, round, player1_id, player2_id, winner_id, score, date, is_friendly, status, submitted_by
  ) VALUES (
    'Singles', 'Friendly', submitter_id, opponent_id, match_winner_id, match_score, CURRENT_DATE, true, 'pending', submitter_id
  ) RETURNING id INTO new_match_id;
  
  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC to CONFIRM a match (Calculates Elo, updates ratings, marks as 'confirmed')
CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id TEXT
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
  p1_elo INTEGER;
  p2_elo INTEGER;
  p1_matches INTEGER;
  p2_matches INTEGER;
  p1_expected NUMERIC;
  p2_expected NUMERIC;
  p1_actual NUMERIC;
  p2_actual NUMERIC;
  k_p1 INTEGER;
  k_p2 INTEGER;
  new_p1_elo INTEGER;
  new_p2_elo INTEGER;
  change_p1 INTEGER;
  change_p2 INTEGER;
BEGIN
  -- Fetch the match
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF m_record.status != 'pending' THEN
    RAISE EXCEPTION 'Match is already %', m_record.status;
  END IF;

  -- Ensure the confirmer is the OTHER player (not the submitter)
  IF confirmer_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
  END IF;
  
  IF confirmer_id != m_record.player1_id AND confirmer_id != m_record.player2_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  -- Get current Elo ratings
  SELECT elo_rating, total_friendly_matches INTO p1_elo, p1_matches FROM players WHERE id = m_record.player1_id;
  SELECT elo_rating, total_friendly_matches INTO p2_elo, p2_matches FROM players WHERE id = m_record.player2_id;

  -- Dynamic K-Factor
  k_p1 := CASE WHEN p1_matches < 10 THEN 40 ELSE 20 END;
  k_p2 := CASE WHEN p2_matches < 10 THEN 40 ELSE 20 END;

  -- Elo Expected Score
  p1_expected := 1.0 / (1.0 + power(10.0, (p2_elo - p1_elo) / 400.0));
  p2_expected := 1.0 / (1.0 + power(10.0, (p1_elo - p2_elo) / 400.0));

  -- Actual Score
  p1_actual := CASE WHEN m_record.winner_id = m_record.player1_id THEN 1.0 ELSE 0.0 END;
  p2_actual := CASE WHEN m_record.winner_id = m_record.player2_id THEN 1.0 ELSE 0.0 END;

  -- Calculate new Elo ratings
  new_p1_elo := round(p1_elo + k_p1 * (p1_actual - p1_expected));
  new_p2_elo := round(p2_elo + k_p2 * (p2_actual - p2_expected));
  
  change_p1 := new_p1_elo - p1_elo;
  change_p2 := new_p2_elo - p2_elo;

  -- Update Players
  UPDATE players SET elo_rating = new_p1_elo, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player1_id;
  UPDATE players SET elo_rating = new_p2_elo, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player2_id;

  -- Update Match Record
  UPDATE matches SET 
    status = 'confirmed', 
    elo_change_p1 = change_p1, 
    elo_change_p2 = change_p2 
  WHERE id = match_uuid;

  RETURN jsonb_build_object(
    'p1_elo_change', change_p1,
    'p2_elo_change', change_p2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC to REJECT a match
CREATE OR REPLACE FUNCTION reject_friendly_match(
  match_uuid UUID, 
  rejecter_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  m_record RECORD;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF rejecter_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You cannot reject your own submission.';
  END IF;
  
  IF rejecter_id != m_record.player1_id AND rejecter_id != m_record.player2_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  UPDATE matches SET status = 'rejected' WHERE id = match_uuid;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
