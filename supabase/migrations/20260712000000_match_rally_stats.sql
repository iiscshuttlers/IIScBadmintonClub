-- Per-rally sensor breakdown, derived from the same PlayerMotion stream already
-- captured for match_sensor_analytics. Umpired matches close a rally on every
-- scored point (match.pointLog is the ground truth); practice sessions close a
-- rally on a detected stillness gap since there's no live scorer.
CREATE TABLE IF NOT EXISTS match_rally_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL,
  match_source      TEXT NOT NULL CHECK (match_source IN ('friendly', 'tournament', 'practice')),
  player_id         UUID REFERENCES players(id),

  game_num          INT,
  rally_number      INT NOT NULL,
  scoring_team      SMALLINT CHECK (scoring_team IN (1, 2)),
  t1_score          INT,
  t2_score          INT,

  started_at        TIMESTAMPTZ,
  duration_ms       INT NOT NULL,
  shot_count        INT NOT NULL DEFAULT 0,
  smash_count       INT NOT NULL DEFAULT 0,
  avg_intensity     NUMERIC,
  peak_intensity    NUMERIC,
  direction_changes INT DEFAULT 0,

  recorded_by       UUID REFERENCES players(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_rally_stats_match ON match_rally_stats(match_id, match_source);
CREATE INDEX IF NOT EXISTS idx_match_rally_stats_player ON match_rally_stats(player_id);

ALTER TABLE match_rally_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrs_public_read" ON match_rally_stats;
CREATE POLICY "mrs_public_read" ON match_rally_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "mrs_auth_insert" ON match_rally_stats;
CREATE POLICY "mrs_auth_insert" ON match_rally_stats
  FOR INSERT WITH CHECK (recorded_by = auth.uid());

DROP POLICY IF EXISTS "mrs_auth_update_own" ON match_rally_stats;
CREATE POLICY "mrs_auth_update_own" ON match_rally_stats
  FOR UPDATE USING (recorded_by = auth.uid());
