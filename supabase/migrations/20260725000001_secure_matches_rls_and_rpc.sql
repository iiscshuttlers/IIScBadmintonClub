-- 1. Atomic Score Update RPC
CREATE OR REPLACE FUNCTION increment_match_score(match_id UUID, p1_increment INT, p2_increment INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE matches
  SET score = jsonb_set(
                jsonb_set(COALESCE(score, '{"p1":0, "p2":0}'::jsonb), '{p1}', (COALESCE((score->>'p1')::int, 0) + p1_increment)::text::jsonb),
                '{p2}', (COALESCE((score->>'p2')::int, 0) + p2_increment)::text::jsonb
              )
  WHERE id = match_id;
END;
$$;

-- 2. Enforce Strict Row Level Security on matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 3. Maintain Public Select (Required for Live Scoreboards)
DROP POLICY IF EXISTS "Anyone can read matches" ON matches;
CREATE POLICY "Anyone can read matches" ON matches
FOR SELECT
USING (true);

-- 4. Admins and Umpires can update matches
-- Using players table for RBAC, which is protected by triggers against client-side elevation
DROP POLICY IF EXISTS "Admins and Umpires can update matches" ON matches;
CREATE POLICY "Admins and Umpires can update matches" ON matches
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire'))
);

-- 5. Admins and Umpires can insert matches
DROP POLICY IF EXISTS "Admins and Umpires can insert matches" ON matches;
CREATE POLICY "Admins and Umpires can insert matches" ON matches
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire'))
);

-- 6. Admins can delete matches
DROP POLICY IF EXISTS "Admins can delete matches" ON matches;
CREATE POLICY "Admins can delete matches" ON matches
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
);
