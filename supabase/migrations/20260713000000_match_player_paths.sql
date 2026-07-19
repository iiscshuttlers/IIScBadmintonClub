-- On-device court path tracing for singles matches. A video is imported and
-- processed entirely client-side (MediaPipe Pose Landmarker, WASM); only the
-- small extracted numeric path data lands here, never the raw video.
CREATE TABLE IF NOT EXISTS match_video_calibration (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id                  UUID NOT NULL,
  match_source              TEXT NOT NULL CHECK (match_source IN ('friendly', 'tournament', 'practice')),

  court_width_m             NUMERIC NOT NULL DEFAULT 6.1,
  court_length_m            NUMERIC NOT NULL DEFAULT 13.4,
  src_points                JSONB NOT NULL,   -- [[px,py]x4] tapped pixel coords: nearLeft,nearRight,farRight,farLeft
  dst_points                JSONB NOT NULL,   -- matching court-meter coords, same order
  homography_matrix         JSONB NOT NULL,   -- flattened row-major 3x3, h33 normalized to 1
  video_frame_width         INT NOT NULL,
  video_frame_height        INT NOT NULL,

  sync_anchor_rally_number  INT NOT NULL,
  sync_anchor_wallclock     TIMESTAMPTZ NOT NULL,   -- copied from that rally's match_rally_stats.started_at
  sync_video_time_ms        INT NOT NULL,           -- video.currentTime*1000 at the marked moment

  created_by                UUID REFERENCES players(id),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, match_source)
);

CREATE TABLE IF NOT EXISTS match_player_paths (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL,
  match_source        TEXT NOT NULL CHECK (match_source IN ('friendly', 'tournament', 'practice')),
  rally_number        INT NOT NULL,
  side                TEXT NOT NULL CHECK (side IN ('near', 'far')),
  player_label        TEXT,

  points              JSONB NOT NULL,           -- [{t_ms,x_m,y_m,speed_mps,conf}], t_ms relative to rally start
  sample_count        INT NOT NULL DEFAULT 0,
  avg_speed_mps       NUMERIC,
  peak_speed_mps      NUMERIC,
  distance_covered_m  NUMERIC,

  calibration_id      UUID REFERENCES match_video_calibration(id),
  processed_by        UUID REFERENCES players(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, match_source, rally_number, side)
);

CREATE INDEX IF NOT EXISTS idx_mpp_match ON match_player_paths(match_id, match_source);

ALTER TABLE match_video_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mvc_public_read" ON match_video_calibration;
CREATE POLICY "mvc_public_read" ON match_video_calibration
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "mvc_auth_insert" ON match_video_calibration;
CREATE POLICY "mvc_auth_insert" ON match_video_calibration
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mvc_auth_update_own" ON match_video_calibration;
CREATE POLICY "mvc_auth_update_own" ON match_video_calibration
  FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "mpp_public_read" ON match_player_paths;
CREATE POLICY "mpp_public_read" ON match_player_paths
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "mpp_auth_insert" ON match_player_paths;
CREATE POLICY "mpp_auth_insert" ON match_player_paths
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mpp_auth_update_own" ON match_player_paths;
CREATE POLICY "mpp_auth_update_own" ON match_player_paths
  FOR UPDATE USING (processed_by = auth.uid());
