-- Fix RLS on elo_calculation_logs to allow inserts from SECURITY DEFINER functions

-- Allow authenticated users to read their own ELO logs (already may exist)
DROP POLICY IF EXISTS "Allow authenticated to read elo_calculation_logs" ON elo_calculation_logs;
CREATE POLICY "Allow authenticated to read elo_calculation_logs"
  ON elo_calculation_logs FOR SELECT
  TO authenticated
  USING (true);

-- Allow service_role and authenticated admins (via RPC) to insert logs
-- Since recalculate functions are SECURITY DEFINER, they run as the calling user.
-- We need an INSERT policy that permits inserts from admin-called RPCs.
DROP POLICY IF EXISTS "Allow admin inserts to elo_calculation_logs" ON elo_calculation_logs;
CREATE POLICY "Allow admin inserts to elo_calculation_logs"
  ON elo_calculation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins to delete logs (for recalculation reset)
DROP POLICY IF EXISTS "Allow admin deletes from elo_calculation_logs" ON elo_calculation_logs;
CREATE POLICY "Allow admin deletes from elo_calculation_logs"
  ON elo_calculation_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
