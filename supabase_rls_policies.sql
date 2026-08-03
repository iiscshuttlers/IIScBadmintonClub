-- ==============================================================================
-- Red Team Mitigation: Row-Level Security (RLS) Policies
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable RLS on the critical tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_data ENABLE ROW LEVEL SECURITY;

-- 2. Lock down Tournaments
CREATE POLICY "Admins can update tournaments"
ON tournaments FOR UPDATE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('admin', 'master_admin')
);

CREATE POLICY "Admins can delete tournaments"
ON tournaments FOR DELETE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('master_admin')
);

-- 3. Lock down Friendly Matches
-- Only Admins, or the Umpire of the match, or the Players involved can update a match
CREATE POLICY "Authorized users can update matches"
ON matches FOR UPDATE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('admin', 'master_admin') OR
  auth.uid() = umpire_id OR
  auth.uid() = player1_id OR
  auth.uid() = player2_id OR
  auth.uid() = team1_partner_id OR
  auth.uid() = team2_partner_id
);

-- 4. Lock down Tournament Matches
-- Only Admins can manually update tournament matches (e.g. resolving disputes)
CREATE POLICY "Admins can update tournament matches"
ON tournament_matches FOR UPDATE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('admin', 'master_admin')
);

-- 5. Lock down Site Data (Broadcasts)
-- Only Admins or current Umpires should be writing to live_matches in site_data
CREATE POLICY "Admins and Umpires can write to site_data"
ON site_data FOR UPDATE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('admin', 'master_admin', 'umpire')
);

-- 6. RPC Function for Atomic Score Increments (Data Race Mitigation)
CREATE OR REPLACE FUNCTION increment_match_score(match_id UUID, p1_increment INT, p2_increment INT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Perform atomic jsonb replacement directly in Postgres to prevent Last-Write-Wins collisions
  UPDATE matches
  SET score = jsonb_set(
                jsonb_set(score, '{p1}', (COALESCE((score->>'p1')::int, 0) + p1_increment)::text::jsonb),
                '{p2}', (COALESCE((score->>'p2')::int, 0) + p2_increment)::text::jsonb
              )
  WHERE id = match_id;
END;
$$;
