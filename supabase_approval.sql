-- ============================================================
-- Registration Approvals & Extra Info System
-- ============================================================

-- Add new columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS iisc_email TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sr_number TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Create an RPC to safely approve a player
CREATE OR REPLACE FUNCTION approve_player(
  player_id TEXT, 
  admin_email TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Strict Admin check
  IF admin_email != 'iiscbadmintonclub@gmail.com' AND admin_email != 'janmejay@iisc.ac.in' THEN
    RAISE EXCEPTION 'Unauthorized: Only verified admins can approve players.';
  END IF;

  -- Verify player exists
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = player_id) THEN
    RAISE EXCEPTION 'Player not found.';
  END IF;

  -- Mark as approved
  UPDATE players SET is_approved = true WHERE id = player_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
