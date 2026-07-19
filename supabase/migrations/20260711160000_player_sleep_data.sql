-- Daily sleep data synced from Health Connect, decoupled from any single match
-- since sleep happens the night before/after rather than during a match window.
CREATE TABLE IF NOT EXISTS player_sleep_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id),
  sleep_date      DATE NOT NULL,

  total_minutes   NUMERIC,
  deep_minutes    NUMERIC,
  rem_minutes     NUMERIC,
  light_minutes   NUMERIC,
  awake_minutes   NUMERIC,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, sleep_date)
);

CREATE INDEX IF NOT EXISTS idx_player_sleep_data_player ON player_sleep_data(player_id, sleep_date);

-- Backfill guard: purge any rows that predate the NOT NULL constraint and enforce it going forward.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_sleep_data' AND column_name = 'player_id' AND is_nullable = 'YES'
  ) THEN
    DELETE FROM player_sleep_data WHERE player_id IS NULL;
    ALTER TABLE player_sleep_data ALTER COLUMN player_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE player_sleep_data ENABLE ROW LEVEL SECURITY;

-- Sleep data is sensitive per-player data. Only the owning player (and admins) may read or write their own rows.

DROP POLICY IF EXISTS "Players can read own sleep data" ON player_sleep_data;
CREATE POLICY "Players can read own sleep data" ON player_sleep_data FOR SELECT USING (player_id = auth.uid());

DROP POLICY IF EXISTS "Players can insert own sleep data" ON player_sleep_data;
CREATE POLICY "Players can insert own sleep data" ON player_sleep_data FOR INSERT WITH CHECK (player_id = auth.uid());

DROP POLICY IF EXISTS "Players can update own sleep data" ON player_sleep_data;
CREATE POLICY "Players can update own sleep data" ON player_sleep_data FOR UPDATE USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

DROP POLICY IF EXISTS "Players can delete own sleep data" ON player_sleep_data;
CREATE POLICY "Players can delete own sleep data" ON player_sleep_data FOR DELETE USING (player_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all sleep data" ON player_sleep_data;
CREATE POLICY "Admins can read all sleep data" ON player_sleep_data FOR SELECT USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );
