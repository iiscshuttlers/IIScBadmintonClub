-- Fix RBAC check for upsert_live_match_by_id to support master admin overrides
CREATE OR REPLACE FUNCTION upsert_live_match_by_id(
  p_match_id TEXT,
  match_state JSONB
) RETURNS VOID AS $$
DECLARE
  is_friendly BOOLEAN;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  -- Detect whether this is a friendly match from the payload
  is_friendly := COALESCE((match_state->>'isFriendly')::BOOLEAN, true);

  -- For tournament (non-friendly) matches, only umpires and admins may update
  IF NOT is_friendly THEN
    IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.players
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    ) THEN
      v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can update tournament live matches.';
    END IF;
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('live_matches', jsonb_build_object(p_match_id, match_state))
  ON CONFLICT (key) DO UPDATE
  SET value = site_data.value || jsonb_build_object(p_match_id, match_state);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
