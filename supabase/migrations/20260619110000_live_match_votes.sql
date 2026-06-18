-- Live match votes for "Who's going to win?" predictions
CREATE TABLE IF NOT EXISTS live_match_votes (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  live_match_id  text NOT NULL,
  user_id        uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  pick           smallint NOT NULL CHECK (pick IN (1, 2)),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (live_match_id, user_id)
);

ALTER TABLE live_match_votes ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can insert their own vote
DROP POLICY IF EXISTS "insert own vote" ON live_match_votes;
CREATE POLICY "insert own vote" ON live_match_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Anyone can read votes (needed for live tallies)
DROP POLICY IF EXISTS "read all votes" ON live_match_votes;
CREATE POLICY "read all votes" ON live_match_votes
  FOR SELECT USING (true);
