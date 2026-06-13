CREATE OR REPLACE FUNCTION umpire_submit_match(
  umpire_id TEXT,
  player1_id TEXT,
  player2_id TEXT,
  team1_partner_id TEXT,
  team2_partner_id TEXT,
  winner_id TEXT,
  match_score TEXT,
  match_category TEXT,
  match_round TEXT,
  is_friendly BOOLEAN
) RETURNS UUID AS $$
DECLARE
  new_match_id UUID;
  inferred_category TEXT;
BEGIN
  IF (team1_partner_id IS NULL OR team1_partner_id = '') AND (team2_partner_id IS NULL OR team2_partner_id = '') THEN
    inferred_category := 'Singles';
  ELSIF (team1_partner_id IS NOT NULL AND team1_partner_id != '') AND (team2_partner_id IS NOT NULL AND team2_partner_id != '') THEN
    inferred_category := 'Doubles';
  ELSE
    inferred_category := 'Hybrid';
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
    inferred_category,
    match_round,
    player1_id,
    player2_id,
    NULLIF(team1_partner_id, ''),
    NULLIF(team2_partner_id, ''),
    NULLIF(winner_id, ''),
    match_score,
    CURRENT_DATE,
    is_friendly,
    'pending',
    NULLIF(umpire_id, '')
  ) RETURNING id INTO new_match_id;
  
  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
