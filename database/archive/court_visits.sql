-- Court visit tracking for crowdedness heatmap
-- Logged whenever a user sets their status to "Playing Right Now"

CREATE TABLE IF NOT EXISTS court_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  day_of_week smallint NOT NULL, -- 0 = Sunday, 6 = Saturday
  hour smallint NOT NULL          -- 0-23
);

-- Index for aggregation queries
CREATE INDEX IF NOT EXISTS court_visits_day_hour_idx ON court_visits (day_of_week, hour);

-- RLS
ALTER TABLE court_visits ENABLE ROW LEVEL SECURITY;

-- Users can insert their own visits
CREATE POLICY "Users can log own visits"
  ON court_visits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Aggregated read is open to all authenticated users (no individual rows exposed)
-- We expose only via a view/function, not raw table reads
CREATE POLICY "No direct reads"
  ON court_visits FOR SELECT
  USING (false);

-- Aggregation view — returns counts only, no user identity
CREATE OR REPLACE VIEW court_popularity AS
  SELECT
    day_of_week,
    hour,
    COUNT(*) AS visit_count
  FROM court_visits
  GROUP BY day_of_week, hour;

-- Grant access to the view
GRANT SELECT ON court_popularity TO authenticated;
