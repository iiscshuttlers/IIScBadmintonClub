-- Update push_match_alert to accept an optional title
CREATE OR REPLACE FUNCTION push_match_alert(
  p_message TEXT,
  p_title TEXT DEFAULT '🏸 Live Match Score'
) RETURNS VOID AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('match_alert', jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000))
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
