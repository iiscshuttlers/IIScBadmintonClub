-- Add email column to tournament_participants for external (unlinked) players
-- so admins can see imported contact info without linking to a player record.
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS email TEXT;
