-- match_sensor_analytics migration
CREATE TABLE IF NOT EXISTS match_sensor_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL,
  match_source    TEXT NOT NULL CHECK (match_source IN ('friendly', 'tournament', 'practice')),
  player_id       UUID REFERENCES players(id),

  -- Accelerometer aggregates
  accel_avg       NUMERIC,
  accel_peak      NUMERIC,
  accel_std       NUMERIC,

  -- Gyroscope aggregates
  gyro_avg        NUMERIC,
  gyro_peak       NUMERIC,
  gyro_std        NUMERIC,

  -- Swing detection
  total_swings    INT DEFAULT 0,
  smash_count     INT DEFAULT 0,
  clear_count     INT DEFAULT 0,
  drive_count     INT DEFAULT 0,
  net_shot_count  INT DEFAULT 0,
  avg_swing_speed NUMERIC,
  max_swing_speed NUMERIC,

  -- Movement distribution (time-weighted)
  lateral_pct     NUMERIC,
  forward_back_pct NUMERIC,
  vertical_pct    NUMERIC,

  -- Fatigue estimation
  first_half_intensity  NUMERIC,
  second_half_intensity NUMERIC,
  fatigue_index         NUMERIC,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, match_source, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_sensor_analytics_match ON match_sensor_analytics(match_id, match_source);

ALTER TABLE match_sensor_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msa_public_read" ON match_sensor_analytics;
CREATE POLICY "msa_public_read" ON match_sensor_analytics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "msa_auth_insert" ON match_sensor_analytics;
CREATE POLICY "msa_auth_insert" ON match_sensor_analytics
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "msa_auth_update_own" ON match_sensor_analytics;
CREATE POLICY "msa_auth_update_own" ON match_sensor_analytics
  FOR UPDATE USING (player_id = auth.uid());
