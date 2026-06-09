-- ==============================================================================
-- Migration: Kudos on Matches + "Looking to Play" player status
-- Run this in Supabase Dashboard → SQL Editor
-- ==============================================================================

-- 1. Add kudos tracking to matches table
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS kudos_users TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kudos_count INTEGER DEFAULT 0;

-- 2. RPC to toggle kudos on a match (identified by the current logged-in player's id)
CREATE OR REPLACE FUNCTION toggle_match_kudos(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id TEXT;
  v_is_liked  BOOLEAN;
BEGIN
  -- Resolve the authenticated user's player id
  SELECT id INTO v_player_id FROM players WHERE user_id = auth.uid();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or no player profile';
  END IF;

  SELECT v_player_id = ANY(kudos_users) INTO v_is_liked
  FROM matches WHERE id = p_match_id;

  IF v_is_liked THEN
    UPDATE matches
    SET kudos_users = array_remove(kudos_users, v_player_id),
        kudos_count = GREATEST(0, kudos_count - 1)
    WHERE id = p_match_id;
  ELSE
    UPDATE matches
    SET kudos_users = array_append(kudos_users, v_player_id),
        kudos_count = kudos_count + 1
    WHERE id = p_match_id;
  END IF;
END;
$$;

-- 3. Add "Looking to Play" status flag to players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_looking_to_play BOOLEAN DEFAULT false;

-- 4. Allow any authenticated player to update their own is_looking_to_play flag
--    (covers the UPDATE RLS policy; existing player self-update policy should already cover this,
--     but add an explicit one in case it doesn't)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'players'
      AND policyname = 'Players can update their own looking_to_play status'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Players can update their own looking_to_play status"
        ON public.players
        FOR UPDATE
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;
END;
$$;
