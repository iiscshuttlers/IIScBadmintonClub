-- Relax RLS on live_match_votes so linked users (where auth.uid() != players.id) can still vote
DROP POLICY IF EXISTS "insert own vote" ON live_match_votes;
CREATE POLICY "insert own vote" ON live_match_votes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
