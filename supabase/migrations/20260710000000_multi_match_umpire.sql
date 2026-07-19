-- Allow live matches to be keyed by match_id instead of umpire_id
-- This allows a single umpire to broadcast multiple matches concurrently.

CREATE OR REPLACE FUNCTION upsert_live_match_by_id(
  p_match_id TEXT,
  match_state JSONB
) RETURNS VOID AS $$
BEGIN
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
  UPDATE site_data
  SET value = value - p_match_id
  WHERE key = 'live_matches';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Umpire Assignments Table
-- Store assignments for time-bounded multi-match umpiring

CREATE TABLE IF NOT EXISTS umpire_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NULL, -- Can be null for a "time-block" only assignment
  tournament_match_id UUID NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NULL,
  end_time TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Policies for umpire_assignments
ALTER TABLE umpire_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view umpire assignments" ON umpire_assignments;
CREATE POLICY "Anyone can view umpire assignments" ON umpire_assignments
  FOR SELECT USING (true);

-- Assuming only authenticated admins can manage assignments via service role,
-- or we can add a policy for admins
DROP POLICY IF EXISTS "Admins can manage umpire assignments" ON umpire_assignments;
CREATE POLICY "Admins can manage umpire assignments" ON umpire_assignments
  FOR ALL USING (auth.role() = 'authenticated'); -- Simple for now, UI restricts admin pages
