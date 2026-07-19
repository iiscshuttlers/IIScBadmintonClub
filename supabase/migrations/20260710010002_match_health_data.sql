CREATE TABLE IF NOT EXISTS match_health_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL,
  match_source    TEXT NOT NULL,
  player_id       UUID NOT NULL REFERENCES players(id),

  -- Heart rate
  hr_avg          NUMERIC,
  hr_max          NUMERIC,
  hr_min          NUMERIC,
  hr_resting      NUMERIC,
  hr_recovery     NUMERIC,     -- HR 1 min after match ends
  hr_zone_1_pct   NUMERIC,     -- <60% max HR (warm-up)
  hr_zone_2_pct   NUMERIC,     -- 60-70% (fat burn)
  hr_zone_3_pct   NUMERIC,     -- 70-80% (cardio)
  hr_zone_4_pct   NUMERIC,     -- 80-90% (peak)
  hr_zone_5_pct   NUMERIC,     -- >90% (max effort)
  hr_samples      JSONB,       -- [{time, bpm}, ...] for sparkline

  -- Activity
  steps           INT,
  calories_burned NUMERIC,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, match_source, player_id)
);

-- Backfill guard: this table may already exist from an earlier, looser migration.
-- Purge any rows that predate the NOT NULL constraint and enforce it going forward.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_health_data' AND column_name = 'player_id' AND is_nullable = 'YES'
  ) THEN
    DELETE FROM match_health_data WHERE player_id IS NULL;
    ALTER TABLE match_health_data ALTER COLUMN player_id SET NOT NULL;
  END IF;
END $$;

-- Add enable_rls and policies for the new table
ALTER TABLE match_health_data ENABLE ROW LEVEL SECURITY;

-- Health data (heart rate, HRV, SpO2) is sensitive per-player data. Only the
-- owning player (and admins) may read or write their own rows.

DROP POLICY IF EXISTS "Players can read own match health data" ON match_health_data;
CREATE POLICY "Players can read own match health data" ON match_health_data FOR SELECT USING (player_id = auth.uid());

DROP POLICY IF EXISTS "Players can insert own match health data" ON match_health_data;
CREATE POLICY "Players can insert own match health data" ON match_health_data FOR INSERT WITH CHECK (player_id = auth.uid());

DROP POLICY IF EXISTS "Players can update own match health data" ON match_health_data;
CREATE POLICY "Players can update own match health data" ON match_health_data FOR UPDATE USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

DROP POLICY IF EXISTS "Players can delete own match health data" ON match_health_data;
CREATE POLICY "Players can delete own match health data" ON match_health_data FOR DELETE USING (player_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all match health data" ON match_health_data;
CREATE POLICY "Admins can read all match health data" ON match_health_data FOR SELECT USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- Add started_at and ended_at to relevant match tables if not already present.
-- Assuming `matches` and `tournament_matches`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournament_matches' AND column_name='started_at') THEN
    ALTER TABLE tournament_matches ADD COLUMN started_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournament_matches' AND column_name='ended_at') THEN
    ALTER TABLE tournament_matches ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='started_at') THEN
    ALTER TABLE matches ADD COLUMN started_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='ended_at') THEN
    ALTER TABLE matches ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;
END $$;
