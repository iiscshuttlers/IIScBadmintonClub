-- debug_recalc

CREATE OR REPLACE FUNCTION debug_recalc() RETURNS void AS $$
DECLARE
  m_record RECORD;
  v_config JSONB;
  p1_matches INTEGER;
  p1_d_e INTEGER; p1_d_m INTEGER;
  p3_d_e INTEGER;
  team1_elo NUMERIC; team2_elo NUMERIC;
  team1_expected NUMERIC;
  change_p1 INTEGER;
BEGIN
  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config';
  
  FOR m_record IN 
    SELECT tm.* FROM tournament_matches tm WHERE player1_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b' OR player2_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b'
  LOOP
    RAISE NOTICE 'Match ID: %, Category: %', m_record.id, m_record.category;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
