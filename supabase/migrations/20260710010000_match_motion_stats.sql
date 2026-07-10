-- Persisted summary of on-court motion captured via the PlayerMotion plugin during umpiring.
-- One row per scored match (friendly or tournament); raw samples are not stored, only aggregates.

CREATE TABLE IF NOT EXISTS match_motion_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL,
  match_source      TEXT NOT NULL CHECK (match_source IN ('friendly', 'tournament')),
  sample_count      INT NOT NULL DEFAULT 0,
  avg_magnitude     NUMERIC,
  max_magnitude     NUMERIC,
  idle_pct          NUMERIC,
  walking_pct       NUMERIC,
  running_pct       NUMERIC,
  smash_sprint_pct  NUMERIC,
  recorded_by       UUID REFERENCES players(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, match_source)
);

CREATE INDEX IF NOT EXISTS idx_match_motion_stats_match ON match_motion_stats(match_id, match_source);

ALTER TABLE match_motion_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mms_public_read" ON match_motion_stats;
CREATE POLICY "mms_public_read" ON match_motion_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "mms_auth_insert" ON match_motion_stats;
CREATE POLICY "mms_auth_insert" ON match_motion_stats
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mms_auth_update_own" ON match_motion_stats;
CREATE POLICY "mms_auth_update_own" ON match_motion_stats
  FOR UPDATE USING (recorded_by = auth.uid());
