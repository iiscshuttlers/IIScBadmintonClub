-- Fix 1: Atomic live match upsert (eliminates read-modify-write race on site_data)
-- Two umpires scoring simultaneously can no longer clobber each other's broadcast.
CREATE OR REPLACE FUNCTION upsert_live_match(
  umpire_user_id TEXT,
  match_state JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO site_data (key, value)
  VALUES ('live_matches', jsonb_build_object(umpire_user_id, match_state))
  ON CONFLICT (key) DO UPDATE
  SET value = site_data.value || jsonb_build_object(umpire_user_id, match_state);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 1: Atomic live match removal
CREATE OR REPLACE FUNCTION remove_live_match(
  umpire_user_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE site_data
  SET value = value - umpire_user_id
  WHERE key = 'live_matches';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Store sets as structured data so edit mode doesn't parse display strings
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sets_history TEXT[] DEFAULT '{}';

-- Fix 2: Updated umpire_submit_match to persist sets_history on initial save
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
  is_friendly BOOLEAN,
  sets_history TEXT[] DEFAULT '{}'
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
    category, round, player1_id, player2_id,
    team1_partner_id, team2_partner_id, winner_id,
    score, sets_history, date, is_friendly, status, submitted_by
  ) VALUES (
    inferred_category, match_round, player1_id, player2_id,
    NULLIF(team1_partner_id, ''), NULLIF(team2_partner_id, ''),
    NULLIF(winner_id, ''), match_score, sets_history,
    CURRENT_DATE, is_friendly, 'pending', NULLIF(umpire_id, '')
  ) RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Updated umpire_update_match to actually persist sets_history
CREATE OR REPLACE FUNCTION umpire_update_match(
  match_uuid UUID,
  winner_id TEXT,
  match_score TEXT,
  match_category TEXT,
  sets_history TEXT[]
) RETURNS VOID AS $$
BEGIN
  UPDATE matches
  SET
    winner_id = umpire_update_match.winner_id,
    score = umpire_update_match.match_score,
    category = umpire_update_match.match_category,
    sets_history = umpire_update_match.sets_history
  WHERE id = umpire_update_match.match_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
