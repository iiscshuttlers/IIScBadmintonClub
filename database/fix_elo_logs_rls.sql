CREATE POLICY allow_read_elo_logs ON elo_calculation_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY allow_insert_elo_logs ON elo_calculation_logs FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);
CREATE POLICY allow_delete_elo_logs ON elo_calculation_logs FOR DELETE TO anon, authenticated, service_role USING (true);
