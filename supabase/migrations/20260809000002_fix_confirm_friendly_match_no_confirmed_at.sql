-- Fix confirm_friendly_match by removing non-existent confirmed_at column
CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id TEXT
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
BEGIN
  -- Fetch the match
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;
  
  -- Validation checks unless umpire_bypass is passed
  IF confirmer_id IS NULL OR (confirmer_id != 'umpire_bypass' AND confirmer_id != 'system') THEN
    IF (confirmer_id::uuid) = m_record.submitted_by THEN
      RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
    END IF;
    
    IF (confirmer_id::uuid) IS DISTINCT FROM m_record.player1_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.player2_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team1_partner_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team2_partner_id THEN
      RAISE EXCEPTION 'You were not a part of this match.';
    END IF;
  END IF;

  -- Mark match as completed
  UPDATE matches 
  SET status = 'completed'
  WHERE id = match_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', match_uuid,
    'status', 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION confirm_friendly_match(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_friendly_match(UUID, TEXT) TO authenticated;
