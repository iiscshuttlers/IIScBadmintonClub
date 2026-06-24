-- Add is_admin column to players table
-- Replaces hardcoded email checks in DB functions and RLS policies

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Set existing admins
UPDATE players SET is_admin = true
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('iiscbadmintonclub@gmail.com', 'janmejayraja@iisc.ac.in')
);
