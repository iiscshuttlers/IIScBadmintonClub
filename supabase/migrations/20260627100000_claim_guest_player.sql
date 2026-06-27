-- Transfer all match history from a guest shadow profile to a real player account,
-- then delete the guest. Only admins and master_admins can call this.
CREATE OR REPLACE FUNCTION claim_guest_player(
  p_guest_id UUID,
  p_real_player_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can claim guest accounts';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_guest_id AND is_guest = true) THEN
    RAISE EXCEPTION 'Guest player not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_real_player_id AND (is_guest IS NULL OR is_guest = false)) THEN
    RAISE EXCEPTION 'Real player not found';
  END IF;

  -- Transfer all match references
  UPDATE matches SET player1_id      = p_real_player_id WHERE player1_id      = p_guest_id;
  UPDATE matches SET player2_id      = p_real_player_id WHERE player2_id      = p_guest_id;
  UPDATE matches SET team1_partner_id = p_real_player_id WHERE team1_partner_id = p_guest_id;
  UPDATE matches SET team2_partner_id = p_real_player_id WHERE team2_partner_id = p_guest_id;
  UPDATE matches SET winner_id       = p_real_player_id WHERE winner_id       = p_guest_id;
  UPDATE matches SET submitted_by    = p_real_player_id WHERE submitted_by    = p_guest_id;

  -- Delete the guest shadow profile
  DELETE FROM players WHERE id = p_guest_id AND is_guest = true;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_guest_player(UUID, UUID) TO authenticated;
