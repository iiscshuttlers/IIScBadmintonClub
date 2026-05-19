-- ============================================================
-- Admin Features & Soft Delete System
-- ============================================================

-- Add soft delete column
ALTER TABLE players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an RPC to safely soft-delete a player
CREATE OR REPLACE FUNCTION soft_delete_player(
  player_id TEXT, 
  admin_email TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Strict Admin check
  IF admin_email != 'iiscbadmintonclub@gmail.com' AND admin_email != 'janmejayraja@iisc.ac.in' THEN
    RAISE EXCEPTION 'Unauthorized: Only verified admins can delete players.';
  END IF;

  -- Verify player exists
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = player_id) THEN
    RAISE EXCEPTION 'Player not found.';
  END IF;

  -- Mark as deleted
  UPDATE players SET deleted_at = NOW() WHERE id = player_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
