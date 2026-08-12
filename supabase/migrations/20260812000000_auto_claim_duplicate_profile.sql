-- Auto-Claim Duplicate Profile RPC
-- Allows a newly logged-in user to claim a shadow profile (created by an admin)
-- if their authenticated email exactly matches the shadow profile's email or iisc_email.
-- This securely transfers all match history and deletes the shadow row.

CREATE OR REPLACE FUNCTION auto_claim_duplicate_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_email TEXT;
  v_old_id UUID;
  v_new_id UUID;
BEGIN
  v_new_id := auth.uid();
  v_auth_email := (auth.jwt() ->> 'email');
  
  -- If user has no email in their auth token, we can't securely verify them.
  IF v_auth_email IS NULL THEN
    RETURN false;
  END IF;

  -- Find a player with this exact email that is NOT the current user
  -- (Prioritizing guest/shadow profiles that haven't been claimed yet)
  SELECT id INTO v_old_id 
  FROM players 
  WHERE (email = v_auth_email OR iisc_email = v_auth_email) 
    AND id != v_new_id
  ORDER BY is_guest DESC
  LIMIT 1;

  IF v_old_id IS NULL THEN
    RETURN false;
  END IF;

  -- Transfer all match references from the old ID to the new ID
  UPDATE matches SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE matches SET player2_id = v_new_id WHERE player2_id = v_old_id;
  UPDATE matches SET team1_partner_id = v_new_id WHERE team1_partner_id = v_old_id;
  UPDATE matches SET team2_partner_id = v_new_id WHERE team2_partner_id = v_old_id;
  UPDATE matches SET winner_id = v_new_id WHERE winner_id = v_old_id;
  UPDATE matches SET submitted_by = v_new_id WHERE submitted_by = v_old_id;
  
  -- Transfer tournament registrations
  UPDATE tournament_registrations SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE tournament_registrations SET player2_id = v_new_id WHERE player2_id = v_old_id;
  
  -- Transfer elo logs
  UPDATE elo_logs SET player_id = v_new_id WHERE player_id = v_old_id;

  -- Transfer venue presence
  UPDATE venue_presence_events SET player_id = v_new_id WHERE player_id = v_old_id;

  -- Transfer feedback
  UPDATE feedback SET user_id = v_new_id WHERE user_id = v_old_id;

  -- Delete the old row (zombie row)
  DELETE FROM players WHERE id = v_old_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_claim_duplicate_profile() TO authenticated;
