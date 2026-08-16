-- Relax RLS for matches and tournament_matches to support email-based umpire matching
-- This prevents issues where umpires cannot update matches if their auth.uid() does not match their player.id

-- 1. Relax tournament_matches policies
DROP POLICY IF EXISTS "tm_admin_write" ON tournament_matches;
CREATE POLICY "tm_admin_write" ON tournament_matches
  FOR ALL USING (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    )
  ) WITH CHECK (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    )
  );

DROP POLICY IF EXISTS "tm_admin_read" ON tournament_matches;
CREATE POLICY "tm_admin_read" ON tournament_matches
  FOR SELECT USING (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    )
  );

-- 2. Relax matches policies
DROP POLICY IF EXISTS "Admins and Umpires can update matches" ON matches;
CREATE POLICY "Admins and Umpires can update matches" ON matches
  FOR UPDATE USING (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    )
  ) WITH CHECK (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    )
  );

DROP POLICY IF EXISTS "Admins and Umpires can insert matches" ON matches;
CREATE POLICY "Admins and Umpires can insert matches" ON matches
  FOR INSERT WITH CHECK (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    )
  );

DROP POLICY IF EXISTS "Admins can delete matches" ON matches;
CREATE POLICY "Admins can delete matches" ON matches
  FOR DELETE USING (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin')
    )
  );
