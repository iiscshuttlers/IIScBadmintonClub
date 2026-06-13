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
    match_score = umpire_update_match.match_score,
    category = umpire_update_match.match_category
  WHERE id = umpire_update_match.match_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
