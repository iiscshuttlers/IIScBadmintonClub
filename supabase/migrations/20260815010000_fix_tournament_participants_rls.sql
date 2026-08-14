-- Fix: tournament_participants RLS policy was missing WITH CHECK on inserts
-- The original policy had FOR ALL USING (...) but no WITH CHECK clause,
-- causing "new row violates row-level security policy" errors on INSERT.

-- Drop all existing write policies and recreate with correct WITH CHECK
DROP POLICY IF EXISTS "tp_admin_all" ON tournament_participants;

CREATE POLICY "tp_admin_all" ON tournament_participants
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- Also fix tournament_round_rules for the same reason
DROP POLICY IF EXISTS "trr_admin_all" ON tournament_round_rules;

CREATE POLICY "trr_admin_all" ON tournament_round_rules
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- Also fix tournaments table
DROP POLICY IF EXISTS "tournaments_admin_write" ON tournaments;

CREATE POLICY "tournaments_admin_write" ON tournaments
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );
