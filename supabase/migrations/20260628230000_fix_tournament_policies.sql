-- Fix tournament tables write policies to include WITH CHECK for inserts
-- 1. tournaments
DROP POLICY IF EXISTS "tournaments_admin_write" ON tournaments;
CREATE POLICY "tournaments_admin_write" ON tournaments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- 2. tournament_participants
DROP POLICY IF EXISTS "tp_admin_all" ON tournament_participants;
CREATE POLICY "tp_admin_all" ON tournament_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- 3. tournament_round_rules
DROP POLICY IF EXISTS "trr_admin_all" ON tournament_round_rules;
CREATE POLICY "trr_admin_all" ON tournament_round_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- 4. tournament_matches
DROP POLICY IF EXISTS "tm_admin_write" ON tournament_matches;
CREATE POLICY "tm_admin_write" ON tournament_matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin','umpire'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin','umpire'))
  );
