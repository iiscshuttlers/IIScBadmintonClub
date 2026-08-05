-- Add require_app_registration to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS require_app_registration BOOLEAN NOT NULL DEFAULT FALSE;
