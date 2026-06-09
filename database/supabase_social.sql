-- Add social features to players table
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS followers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS following TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS buddies TEXT[] DEFAULT '{}';

-- Create RPC to toggle follow status
CREATE OR REPLACE FUNCTION toggle_follow(p_target_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_is_following BOOLEAN;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid()::text;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_user_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  -- Check if already following
  SELECT p_target_id = ANY(following) INTO v_is_following
  FROM players
  WHERE id = v_user_id;

  IF v_is_following THEN
    -- Unfollow
    UPDATE players SET following = array_remove(following, p_target_id) WHERE id = v_user_id;
    UPDATE players SET followers = array_remove(followers, v_user_id) WHERE id = p_target_id;
  ELSE
    -- Follow
    UPDATE players SET following = array_append(following, p_target_id) WHERE id = v_user_id;
    UPDATE players SET followers = array_append(followers, v_user_id) WHERE id = p_target_id;
  END IF;
END;
$$;

-- Create RPC to toggle buddy status
CREATE OR REPLACE FUNCTION toggle_buddy(p_target_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_is_buddy BOOLEAN;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid()::text;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_user_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot be buddy with yourself';
  END IF;

  -- Check if already buddy
  SELECT p_target_id = ANY(buddies) INTO v_is_buddy
  FROM players
  WHERE id = v_user_id;

  IF v_is_buddy THEN
    -- Remove buddy
    UPDATE players SET buddies = array_remove(buddies, p_target_id) WHERE id = v_user_id;
  ELSE
    -- Add buddy
    UPDATE players SET buddies = array_append(buddies, p_target_id) WHERE id = v_user_id;
  END IF;
END;
$$;
