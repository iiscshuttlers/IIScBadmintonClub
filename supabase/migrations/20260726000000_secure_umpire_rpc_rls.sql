-- Secure Umpire Assignments and Live Scoreboard RPCs

-- 1. Secure `upsert_live_match_by_id` RPC
CREATE OR REPLACE FUNCTION upsert_live_match_by_id(
  p_match_id TEXT,
  match_state JSONB
) RETURNS VOID AS $$
BEGIN
  -- Authorization Check: Only Admins or Umpires can update live scores
  IF NOT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can update live matches.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('live_matches', jsonb_build_object(p_match_id, match_state))
  ON CONFLICT (key) DO UPDATE
  SET value = site_data.value || jsonb_build_object(p_match_id, match_state);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Secure `remove_live_match_by_id` RPC
CREATE OR REPLACE FUNCTION remove_live_match_by_id(
  p_match_id TEXT
) RETURNS VOID AS $$
BEGIN
  -- Authorization Check: Only Admins or Umpires can remove live scores
  IF NOT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can manage live matches.';
  END IF;

  UPDATE site_data
  SET value = value - p_match_id
  WHERE key = 'live_matches';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Secure Umpire Assignments Table (Strict RBAC)
DROP POLICY IF EXISTS "Admins can manage umpire assignments" ON umpire_assignments;
CREATE POLICY "Admins can manage umpire assignments" ON umpire_assignments
  FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  );
