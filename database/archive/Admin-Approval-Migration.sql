-- Add the is_approved column, defaulting to FALSE for future users
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Automatically approve all EXISTING users so they don't disappear from the directory
UPDATE players SET is_approved = TRUE WHERE is_approved IS NULL OR is_approved = FALSE;
