-- Allow users to update their own votes
DROP POLICY IF EXISTS "update own vote" ON live_match_votes;
CREATE POLICY "update own vote" ON live_match_votes
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
