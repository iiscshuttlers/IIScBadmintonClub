-- 20261007010006_team_settings.sql
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS play_dead_rubbers boolean NOT NULL DEFAULT true;
