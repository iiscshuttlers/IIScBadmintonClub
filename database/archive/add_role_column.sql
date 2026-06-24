-- Replace is_admin boolean with a role column supporting the full hierarchy:
-- master_admin > admin > umpire > player

-- Remove the is_admin column added earlier
ALTER TABLE players DROP COLUMN IF EXISTS is_admin CASCADE;

-- Add role column
ALTER TABLE players ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'player'
  CHECK (role IN ('master_admin', 'admin', 'umpire', 'player'));

-- Set master admin (you)
UPDATE players SET role = 'master_admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('iiscbadmintonclub@gmail.com', 'janmejayraja@iisc.ac.in', 'rajajanmejaya@gmail.com')
);

-- Migrate existing roles from site_data into players.role
-- Run this only if you have existing umpire/admin assignments in site_data
-- UPDATE players SET role = 'umpire' WHERE id IN (
--   SELECT value->>'id' FROM site_data, jsonb_array_elements(value::jsonb) AS value
--   WHERE key = 'roles' AND value->>'role' = 'umpire'
-- );

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS players_role_idx ON players (role);

-- Update broadcast_history RLS to use role column
DROP POLICY IF EXISTS "Admins can read broadcast history" ON broadcast_history;
DROP POLICY IF EXISTS "Admins can insert broadcast history" ON broadcast_history;

CREATE POLICY "Admins can read broadcast history"
  ON broadcast_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
  );

CREATE POLICY "Admins can insert broadcast history"
  ON broadcast_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
  );

-- Update court_visits insert policy (any authenticated user can log a visit — no change needed)
-- Update court_popularity view — no change needed
