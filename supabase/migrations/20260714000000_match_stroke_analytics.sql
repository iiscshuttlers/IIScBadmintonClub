CREATE TABLE IF NOT EXISTS match_stroke_analytics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL,
  match_source        TEXT NOT NULL CHECK (match_source IN ('friendly', 'tournament', 'practice')),
  rally_number        INT NOT NULL,
  stroke_type         TEXT NOT NULL CHECK (stroke_type IN ('Smash', 'Drop', 'Clear', 'Drive', 'Unknown')),
  confidence          NUMERIC NOT NULL,
  peak_acceleration   NUMERIC NOT NULL,
  
  processed_by        UUID REFERENCES players(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, match_source, rally_number)
);

CREATE INDEX IF NOT EXISTS idx_msa_match ON match_stroke_analytics(match_id, match_source);

-- RLS
ALTER TABLE match_stroke_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for match strokes" ON match_stroke_analytics;
CREATE POLICY "Public read access for match strokes" ON match_stroke_analytics FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert match strokes" ON match_stroke_analytics;
CREATE POLICY "Authenticated users can insert match strokes" ON match_stroke_analytics FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update strokes they processed" ON match_stroke_analytics;
CREATE POLICY "Users can update strokes they processed" ON match_stroke_analytics FOR UPDATE 
USING (auth.uid() = processed_by);
