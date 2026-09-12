ALTER TABLE matches ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS video_url text;
