-- Add kudos columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS kudos_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS kudos_users uuid[] DEFAULT '{}';

-- Create or replace the RPC to toggle match kudos
CREATE OR REPLACE FUNCTION public.toggle_match_kudos(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_current_users uuid[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check if the match is in matches table (completed matches)
  SELECT kudos_users INTO v_current_users FROM public.matches WHERE id = p_match_id;
  
  IF FOUND THEN
    IF v_user_id = ANY(v_current_users) THEN
      UPDATE public.matches
      SET 
        kudos_users = array_remove(kudos_users, v_user_id),
        kudos_count = GREATEST(0, COALESCE(kudos_count, 0) - 1)
      WHERE id = p_match_id;
    ELSE
      UPDATE public.matches
      SET 
        kudos_users = array_append(COALESCE(kudos_users, '{}'), v_user_id),
        kudos_count = COALESCE(kudos_count, 0) + 1
      WHERE id = p_match_id;
    END IF;
    RETURN;
  END IF;

  -- 2. If not found in matches, check site_data (live matches)
  -- live_matches is a JSONB object mapping match_id -> match state
  -- We'll extract the current kudos_users string array from it if it exists.
  DECLARE
    v_site_data jsonb;
    v_match_data jsonb;
    v_users jsonb;
    v_new_users jsonb;
    v_count int;
  BEGIN
    SELECT value INTO v_site_data FROM public.site_data WHERE key = 'live_matches';
    IF v_site_data ? p_match_id::text THEN
      v_match_data := v_site_data -> p_match_id::text;
      v_users := COALESCE(v_match_data -> 'kudos_users', '[]'::jsonb);
      
      -- Check if user is in array
      IF v_users @> to_jsonb(v_user_id::text) THEN
        -- Remove user
        v_new_users := (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_users) elem WHERE elem #>> '{}' != v_user_id::text);
        v_new_users := COALESCE(v_new_users, '[]'::jsonb);
        v_count := GREATEST(0, COALESCE((v_match_data->>'kudos_count')::int, 0) - 1);
      ELSE
        -- Add user
        v_new_users := v_users || to_jsonb(v_user_id::text);
        v_count := COALESCE((v_match_data->>'kudos_count')::int, 0) + 1;
      END IF;
      
      -- Update site_data
      v_match_data := v_match_data || jsonb_build_object('kudos_users', v_new_users, 'kudos_count', v_count);
      UPDATE public.site_data 
      SET value = jsonb_set(value, array[p_match_id::text], v_match_data)
      WHERE key = 'live_matches';
      
      RETURN;
    END IF;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_match_kudos(uuid) TO authenticated;
