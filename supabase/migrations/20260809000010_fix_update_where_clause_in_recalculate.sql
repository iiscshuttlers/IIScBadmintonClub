-- Fix UPDATE statements lacking WHERE clauses in recalculate functions
CREATE OR REPLACE FUNCTION recalculate_tournament_elo() RETURNS void AS $$
DECLARE
  m_record RECORD;
  v_winner_elo  INTEGER;
  v_loser_elo   INTEGER;
  v_expected    NUMERIC;
  v_k           INTEGER := 32;
  v_winner_new  INTEGER;
  v_loser_new   INTEGER;
  v_winner_id   UUID;
  v_loser_id    UUID;
BEGIN
  -- ADMIN CHECK
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admins can trigger system-wide recalculations';
    END IF;
  END IF;

  UPDATE players SET tournament_elo = 1200 WHERE id IS NOT NULL;

  FOR m_record IN 
    SELECT tm.* FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    WHERE tm.status = 'completed' AND t.status != 'deleted'
    ORDER BY tm.scored_at ASC 
  LOOP
    IF m_record.winner_side = 1 THEN
      v_winner_id := m_record.player1_id;
      v_loser_id  := m_record.player2_id;
    ELSE
      v_winner_id := m_record.player2_id;
      v_loser_id  := m_record.player1_id;
    END IF;

    IF v_winner_id IS NOT NULL AND v_loser_id IS NOT NULL THEN
      SELECT tournament_elo INTO v_winner_elo FROM players WHERE id = v_winner_id;
      SELECT tournament_elo INTO v_loser_elo  FROM players WHERE id = v_loser_id;

      v_winner_elo := COALESCE(v_winner_elo, 1200);
      v_loser_elo  := COALESCE(v_loser_elo,  1200);

      v_expected  := 1.0 / (1.0 + POWER(10.0, (v_loser_elo - v_winner_elo) / 400.0));

      v_winner_new := v_winner_elo + ROUND(v_k * (1 - v_expected));
      v_loser_new  := v_loser_elo  + ROUND(v_k * (0 - (1 - v_expected)));

      v_winner_new := GREATEST(v_winner_new, 100);
      v_loser_new  := GREATEST(v_loser_new,  100);

      UPDATE players SET tournament_elo = v_winner_new WHERE id = v_winner_id;
      UPDATE players SET tournament_elo = v_loser_new  WHERE id = v_loser_id;
    END IF;

    -- Handle doubles partners if present
    IF m_record.winner_side = 1 THEN
      v_winner_id := m_record.player3_id;
      v_loser_id  := m_record.player4_id;
    ELSE
      v_winner_id := m_record.player4_id;
      v_loser_id  := m_record.player3_id;
    END IF;

    IF v_winner_id IS NOT NULL AND v_loser_id IS NOT NULL THEN
      SELECT tournament_elo INTO v_winner_elo FROM players WHERE id = v_winner_id;
      SELECT tournament_elo INTO v_loser_elo  FROM players WHERE id = v_loser_id;

      v_winner_elo := COALESCE(v_winner_elo, 1200);
      v_loser_elo  := COALESCE(v_loser_elo,  1200);

      v_expected  := 1.0 / (1.0 + POWER(10.0, (v_loser_elo - v_winner_elo) / 400.0));

      v_winner_new := v_winner_elo + ROUND(v_k * (1 - v_expected));
      v_loser_new  := v_loser_elo  + ROUND(v_k * (0 - (1 - v_expected)));

      v_winner_new := GREATEST(v_winner_new, 100);
      v_loser_new  := GREATEST(v_loser_new,  100);

      UPDATE players SET tournament_elo = v_winner_new WHERE id = v_winner_id;
      UPDATE players SET tournament_elo = v_loser_new  WHERE id = v_loser_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION recalculate_tournament_elo() TO authenticated;

CREATE OR REPLACE FUNCTION recalculate_all_elo() RETURNS void AS $$
DECLARE
  m_record RECORD;
BEGIN
  -- ADMIN CHECK
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admins can trigger system-wide recalculations';
    END IF;
  END IF;

  UPDATE players SET 
    singles_elo = 1200, 
    doubles_elo = 1200, 
    mixed_elo = 1200, 
    elo_rating = 1200, 
    tournament_elo = 1200,
    tournament_singles_elo = 1200,
    tournament_doubles_elo = 1200,
    tournament_mixed_elo = 1200,
    total_friendly_matches = 0,
    win_loss_record = '0W - 0L'
  WHERE id IS NOT NULL;

  FOR m_record IN 
    SELECT * FROM matches 
    WHERE status = 'confirmed' 
    ORDER BY created_at ASC 
  LOOP
    BEGIN
      PERFORM confirm_friendly_match(m_record.id, m_record.player2_id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE matches SET status = 'confirmed', elo_change_p1 = 0, elo_change_p2 = 0 WHERE id = m_record.id;
    END;
  END LOOP;

  PERFORM recalculate_tournament_elo();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION recalculate_all_elo() TO authenticated;
