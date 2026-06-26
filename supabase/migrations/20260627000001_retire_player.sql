-- Migration to add is_retired to players table

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_retired BOOLEAN DEFAULT false;
