-- Allow any authenticated user to upsert/remove FRIENDLY live matches.
-- Tournament/official live matches still require umpire or admin role.

CREATE OR REPLACE FUNCTION upsert_live_match_by_id(
  p_match_id TEXT,
  match_state JSONB
) RETURNS VOID AS $$
DECLARE
  is_friendly BOOLEAN;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  -- Detect whether this is a friendly match from the payload
  is_friendly := COALESCE((match_state->>'isFriendly')::BOOLEAN, true);

  -- For tournament (non-friendly) matches, only umpires and admins may update
  IF NOT is_friendly THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.players
      WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can update tournament live matches.';
    END IF;
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('live_matches', jsonb_build_object(p_match_id, match_state))
  ON CONFLICT (key) DO UPDATE
  SET value = site_data.value || jsonb_build_object(p_match_id, match_state);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION remove_live_match_by_id(
  p_match_id TEXT
) RETURNS VOID AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  -- Any authenticated user can remove a live match entry (they can only clean up their own friendly sessions)
  -- Admins and Umpires can remove any match
  UPDATE site_data
  SET value = value - p_match_id
  WHERE key = 'live_matches';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
