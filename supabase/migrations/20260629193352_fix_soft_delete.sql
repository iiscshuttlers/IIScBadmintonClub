CREATE OR REPLACE FUNCTION soft_delete_player(
  player_id UUID,
  admin_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = admin_id AND role IN ('admin', 'master_admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can delete players.';
  END IF;

  -- Ensure not deleting master_admin unless you are one
  IF EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND role = 'master_admin') THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = admin_id AND role = 'master_admin') THEN
      RAISE EXCEPTION 'Unauthorized: only master_admin can delete another master_admin.';
    END IF;
  END IF;

  -- Soft delete by setting deleted_at
  UPDATE public.players SET deleted_at = NOW() WHERE id = player_id;

  -- Clean up active relationships to prevent showing up in feeds
  -- Withdraw any pending matches
  UPDATE public.matches SET status = 'rejected' 
  WHERE status = 'pending' AND (player1_id = player_id OR player2_id = player_id OR team1_partner_id = player_id OR team2_partner_id = player_id);

  -- Remove buddy relationships
  UPDATE public.players SET buddies = array_remove(buddies, player_id::text) WHERE player_id::text = ANY(buddies);
  UPDATE public.players SET buddies = '{}' WHERE id = player_id;
  
  -- Clear buddy requests
  UPDATE public.players SET buddy_requests = array_remove(buddy_requests, player_id::text) WHERE player_id::text = ANY(buddy_requests);
  UPDATE public.players SET buddy_requests = '{}' WHERE id = player_id;

END;
$$;
