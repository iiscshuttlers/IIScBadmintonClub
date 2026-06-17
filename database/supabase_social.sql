-- Add social features to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS followers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS following TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS buddies TEXT[] DEFAULT '{}';

-- Create RPC to toggle follow status
CREATE OR REPLACE FUNCTION toggle_follow(p_target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_following BOOLEAN;
  v_follower_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_user_id = p_target_id THEN RAISE EXCEPTION 'Cannot follow yourself'; END IF;

  SELECT p_target_id::text = ANY(following) INTO v_is_following
  FROM players WHERE id = v_user_id;

  IF v_is_following THEN
    UPDATE players SET following = array_remove(following, p_target_id::text) WHERE id = v_user_id;
    UPDATE players SET followers = array_remove(followers, v_user_id::text)   WHERE id = p_target_id;
  ELSE
    UPDATE players SET following = array_append(following, p_target_id::text) WHERE id = v_user_id;
    UPDATE players SET followers = array_append(followers, v_user_id::text)   WHERE id = p_target_id;

    SELECT full_name INTO v_follower_name FROM public.players WHERE id = v_user_id;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      p_target_id,
      'New Follower',
      v_follower_name || ' started following you.',
      'new_follower',
      '/player/' || v_user_id
    );
  END IF;
END;
$$;

-- Create RPC to toggle buddy status
CREATE OR REPLACE FUNCTION toggle_buddy(p_target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_buddy BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_user_id = p_target_id THEN RAISE EXCEPTION 'Cannot be buddy with yourself'; END IF;

  SELECT p_target_id::text = ANY(buddies) INTO v_is_buddy
  FROM players WHERE id = v_user_id;

  IF v_is_buddy THEN
    UPDATE players SET buddies = array_remove(buddies, p_target_id::text) WHERE id = v_user_id;
  ELSE
    UPDATE players SET buddies = array_append(buddies, p_target_id::text) WHERE id = v_user_id;
  END IF;
END;
$$;
