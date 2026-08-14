-- RPC: link_label_to_player
-- Admin-only. Finds all tournament_matches where a text label was used 
-- (player slot is NULL but team label = the given name), and links them 
-- to a real registered player_id.
CREATE OR REPLACE FUNCTION public.link_label_to_player(
  p_label       TEXT,
  p_player_id   UUID,
  p_partner_id  UUID DEFAULT NULL
) RETURNS INT  -- returns count of rows updated
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INT := 0;
  v_tmp     INT;
BEGIN
  -- Only admins
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Link team1 slots that have the label but no player
  UPDATE tournament_matches
  SET player1_id  = p_player_id,
      player3_id  = COALESCE(p_partner_id, player3_id),
      team1_label = NULL
  WHERE team1_label ILIKE p_label
    AND player1_id IS NULL;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_updated := v_updated + v_tmp;

  -- Link team2 slots
  UPDATE tournament_matches
  SET player2_id  = p_player_id,
      player4_id  = COALESCE(p_partner_id, player4_id),
      team2_label = NULL
  WHERE team2_label ILIKE p_label
    AND player2_id IS NULL;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_updated := v_updated + v_tmp;

  -- Link tournament_participants with matching display_name
  UPDATE tournament_participants
  SET player_id    = p_player_id,
      partner_id   = COALESCE(p_partner_id, partner_id),
      display_name = NULL
  WHERE display_name ILIKE p_label
    AND player_id IS NULL;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_updated := v_updated + v_tmp;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_label_to_player(TEXT, UUID, UUID) TO authenticated;
