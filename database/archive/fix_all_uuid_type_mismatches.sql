-- ============================================================
-- Fix Remaining RPC Type Mismatches (TEXT -> UUID)
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. umpire_submit_match
DROP FUNCTION IF EXISTS umpire_submit_match(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION umpire_submit_match(
  umpire_id UUID,
  player1_id UUID,
  player2_id UUID,
  team1_partner_id UUID,
  team2_partner_id UUID,
  winner_id UUID,
  match_score TEXT,
  match_category TEXT,
  match_round TEXT,
  is_friendly BOOLEAN
) RETURNS UUID AS $$
DECLARE
  new_match_id UUID;
  inferred_category TEXT;
BEGIN
  IF team1_partner_id IS NULL AND team2_partner_id IS NULL THEN
    inferred_category := 'Singles';
  ELSIF team1_partner_id IS NOT NULL AND team2_partner_id IS NOT NULL THEN
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
    team1_partner_id,
    team2_partner_id,
    winner_id,
    match_score,
    CURRENT_DATE,
    is_friendly,
    'pending',
    umpire_id
  ) RETURNING id INTO new_match_id;
  
  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. umpire_update_match
DROP FUNCTION IF EXISTS umpire_update_match(UUID, TEXT, TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION umpire_update_match(
  match_uuid UUID,
  winner_id UUID,
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


-- 3. soft_delete_player
DROP FUNCTION IF EXISTS soft_delete_player(TEXT, TEXT);
DROP FUNCTION IF EXISTS soft_delete_player(UUID, UUID);

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
  UPDATE public.players SET buddies = array_remove(buddies, player_id::text);
  UPDATE public.players SET buddies = '{}' WHERE id = player_id;
  
  -- Clear buddy requests
  UPDATE public.players SET buddy_requests = array_remove(buddy_requests, player_id::text);
  UPDATE public.players SET buddy_requests = '{}' WHERE id = player_id;

END;
$$;


-- 4. approve_player
DROP FUNCTION IF EXISTS approve_player(TEXT, TEXT);
DROP FUNCTION IF EXISTS approve_player(UUID, UUID);

CREATE OR REPLACE FUNCTION approve_player(
  player_id UUID,
  admin_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = admin_id AND role IN ('admin', 'master_admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can approve players.';
  END IF;

  -- Verify player is pending
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND approval_status = 'pending') THEN
    RAISE EXCEPTION 'Player is not in pending state.';
  END IF;

  -- Update status
  UPDATE public.players SET approval_status = 'approved' WHERE id = player_id;
END;
$$;


-- 5. claim_find_lost_item
DROP FUNCTION IF EXISTS claim_find_lost_item(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION claim_find_lost_item(post_uuid UUID, claimer_id UUID, claimer_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.find_lost_posts
  SET resolved = true,
      claimed_by_id = claimer_id,
      claimed_by_name = claimer_name
  WHERE id = post_uuid;
END;
$$;
