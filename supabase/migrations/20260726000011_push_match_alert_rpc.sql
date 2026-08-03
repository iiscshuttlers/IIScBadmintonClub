-- Allow any authenticated umpire/user to push a match score alert.
-- Uses SECURITY DEFINER to bypass RLS on site_data for this specific key.

CREATE OR REPLACE FUNCTION push_match_alert(
  p_message TEXT
) RETURNS VOID AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('match_alert', jsonb_build_object('message', p_message, 'time', extract(epoch from now()) * 1000))
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('message', p_message, 'time', extract(epoch from now()) * 1000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
