ALTER TABLE players RENAME COLUMN years_playing TO started_playing_year;

-- Convert existing data (assuming anyone with < 100 entered years of experience)
-- e.g., if they entered 7, it becomes 2026 - 7 = 2019
UPDATE players 
SET started_playing_year = EXTRACT(YEAR FROM CURRENT_DATE) - started_playing_year 
WHERE started_playing_year IS NOT NULL AND started_playing_year < 100;
