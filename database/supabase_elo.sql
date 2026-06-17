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
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_partner_id TEXT REFERENCES players(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_partner_id TEXT REFERENCES players(id);

-- Pending matches are private to the involved players. Confirmed matches remain public.
DROP POLICY IF EXISTS "Allow public read access to matches" ON matches;
DROP POLICY IF EXISTS "Allow public read access to confirmed matches" ON matches;
DROP POLICY IF EXISTS "Players can read their pending matches" ON matches;

CREATE POLICY "Allow public read access to confirmed matches"
  ON matches
  FOR SELECT
  USING (status IS DISTINCT FROM 'pending');

CREATE POLICY "Players can read their pending matches"
  ON matches
  FOR SELECT
  USING (
    status = 'pending'
    AND auth.uid() IN (player1_id, player2_id, team1_partner_id, team2_partner_id)
  );

-- 3. RPC to SUBMIT a match (Leaves it 'pending', NO Elo update yet)
CREATE OR REPLACE FUNCTION submit_friendly_match(
  submitter_id TEXT, 
  opponent_id TEXT, 
  match_winner_id TEXT, 
  match_score TEXT,
  submitter_partner_id TEXT DEFAULT NULL,
  opponent_partner_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_match_id UUID;
  existing_match_id UUID;
BEGIN
  IF match_winner_id != submitter_id AND match_winner_id != opponent_id THEN
    RAISE EXCEPTION 'Winner must be one of the two players.';
  END IF;

  -- ── Dedup: return existing pending match if submitted in the last 2 hours ──
  SELECT id INTO existing_match_id
  FROM matches
  WHERE status = 'pending'
    AND created_at > now() - INTERVAL '2 hours'
    AND (
      (player1_id = submitter_id AND player2_id = opponent_id)
      OR (player1_id = opponent_id AND player2_id = submitter_id)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_match_id IS NOT NULL THEN
    RETURN existing_match_id;
  END IF;

  INSERT INTO matches (
    category,
    round,
    player1_id,
    player2_id,
    team1_partner_id,
    team2_partner_id,
    winner_id,
    score,
    date,
    is_friendly,
    status,
    submitted_by
  ) VALUES (
    CASE WHEN submitter_partner_id IS NULL AND opponent_partner_id IS NULL THEN 'Singles' ELSE 'Doubles' END,
    'Friendly',
    submitter_id,
    opponent_id,
    submitter_partner_id,
    opponent_partner_id,
    match_winner_id,
    match_score,
    CURRENT_DATE,
    true,
    'pending',
    submitter_id
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
  
  IF confirmer_id IS DISTINCT FROM m_record.player1_id
    AND confirmer_id IS DISTINCT FROM m_record.player2_id
    AND confirmer_id IS DISTINCT FROM m_record.team1_partner_id
    AND confirmer_id IS DISTINCT FROM m_record.team2_partner_id THEN
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

  -- Recalculate win_loss_record for player 1
  WITH p1_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE winner_id = m_record.player1_id) as wins,
      COUNT(*) FILTER (WHERE winner_id != m_record.player1_id) as losses
    FROM matches 
    WHERE status = 'confirmed' AND (player1_id = m_record.player1_id OR player2_id = m_record.player1_id OR team1_partner_id = m_record.player1_id OR team2_partner_id = m_record.player1_id)
  )
  UPDATE players 
  SET win_loss_record = (SELECT wins FROM p1_stats) || 'W - ' || (SELECT losses FROM p1_stats) || 'L'
  WHERE id = m_record.player1_id;

  -- Recalculate win_loss_record for player 2
  WITH p2_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE winner_id = m_record.player2_id) as wins,
      COUNT(*) FILTER (WHERE winner_id != m_record.player2_id) as losses
    FROM matches 
    WHERE status = 'confirmed' AND (player1_id = m_record.player2_id OR player2_id = m_record.player2_id OR team1_partner_id = m_record.player2_id OR team2_partner_id = m_record.player2_id)
  )
  UPDATE players 
  SET win_loss_record = (SELECT wins FROM p2_stats) || 'W - ' || (SELECT losses FROM p2_stats) || 'L'
  WHERE id = m_record.player2_id;

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
  
  IF rejecter_id IS DISTINCT FROM m_record.player1_id
    AND rejecter_id IS DISTINCT FROM m_record.player2_id
    AND rejecter_id IS DISTINCT FROM m_record.team1_partner_id
    AND rejecter_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  UPDATE matches SET status = 'rejected' WHERE id = match_uuid;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
