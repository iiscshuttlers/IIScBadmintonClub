-- Shot tempo and direction-change tracking, derived from swing timestamps already
-- captured by the PlayerMotion sensor tracker (self-tracked and umpire-recorded).
ALTER TABLE match_sensor_analytics
  ADD COLUMN IF NOT EXISTS avg_shot_interval_ms NUMERIC,
  ADD COLUMN IF NOT EXISTS fastest_shot_interval_ms NUMERIC,
  ADD COLUMN IF NOT EXISTS direction_changes INT DEFAULT 0;
