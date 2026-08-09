CREATE OR REPLACE FUNCTION recalculate_all_elo() RETURNS void AS $$
DECLARE
  m_record RECORD;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Reset all ELOs to base 1200 and matches played to 0
  UPDATE players SET 
    singles_matches_played = 0,
    doubles_matches_played = 0,
    mixed_matches_played = 0,
    singles_elo = 1200, 
    doubles_elo = 1200, 
    mixed_elo = 1200,
    tournament_singles_elo = 1200,
    tournament_doubles_elo = 1200,
    tournament_mixed_elo = 1200,
    elo_rating = 1200,
    tournament_elo = 1200
  WHERE id IS NOT NULL;

  -- Clear all calculation logs (satisfy safeupdate extension)
  DELETE FROM elo_calculation_logs WHERE id IS NOT NULL;

  -- Reset matches table ELO changes (friendly matches give 0 ELO)
  UPDATE matches SET elo_change_p1 = 0, elo_change_p2 = 0, elo_change_p3 = 0, elo_change_p4 = 0 WHERE status = 'completed';

  -- Process Tournament Matches
  PERFORM recalculate_tournament_elo();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
