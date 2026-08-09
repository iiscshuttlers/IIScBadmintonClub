-- Enhance recalculate_tournament_elo to update main elo_rating & category ELOs and log to elo_calculation_logs
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
  
  -- Singles / Category ELOs
  v_p1_cat_elo INTEGER;
  v_p2_cat_elo INTEGER;
  v_p3_cat_elo INTEGER;
  v_p4_cat_elo INTEGER;

  change_p1 INTEGER;
  change_p2 INTEGER;
  change_p3 INTEGER;
  change_p4 INTEGER;

  team1_elo NUMERIC;
  team2_elo NUMERIC;
  team1_expected NUMERIC;
  team2_expected NUMERIC;
  team1_actual NUMERIC;
  team2_actual NUMERIC;
BEGIN
  -- ADMIN CHECK
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admins can trigger system-wide recalculations';
    END IF;
  END IF;

  UPDATE players SET 
    tournament_elo = 1200,
    tournament_singles_elo = 1200,
    tournament_doubles_elo = 1200,
    tournament_mixed_elo = 1200
  WHERE id IS NOT NULL;

  FOR m_record IN 
    SELECT tm.* FROM tournament_matches tm
    LEFT JOIN tournaments t ON t.id = tm.tournament_id
    WHERE tm.status = 'completed' AND (t.status IS NULL OR t.status != 'deleted')
    ORDER BY COALESCE(tm.scored_at, tm.created_at) ASC 
  LOOP
    IF m_record.winner_side = 1 THEN
      v_winner_id := m_record.player1_id;
      v_loser_id  := m_record.player2_id;
      team1_actual := 1.0;
      team2_actual := 0.0;
    ELSE
      v_winner_id := m_record.player2_id;
      v_loser_id  := m_record.player1_id;
      team1_actual := 0.0;
      team2_actual := 1.0;
    END IF;

    IF m_record.player1_id IS NOT NULL AND m_record.player2_id IS NOT NULL THEN
      SELECT COALESCE(elo_rating, 1200) INTO v_winner_elo FROM players WHERE id = m_record.player1_id;
      SELECT COALESCE(elo_rating, 1200) INTO v_loser_elo  FROM players WHERE id = m_record.player2_id;

      team1_elo := v_winner_elo;
      team2_elo := v_loser_elo;

      IF m_record.category = 'Doubles' OR m_record.category = 'Mixed' THEN
        IF m_record.player3_id IS NOT NULL THEN
          SELECT COALESCE(elo_rating, 1200) INTO v_p3_cat_elo FROM players WHERE id = m_record.player3_id;
          team1_elo := (v_winner_elo + v_p3_cat_elo) / 2.0;
        END IF;
        IF m_record.player4_id IS NOT NULL THEN
          SELECT COALESCE(elo_rating, 1200) INTO v_p4_cat_elo FROM players WHERE id = m_record.player4_id;
          team2_elo := (v_loser_elo + v_p4_cat_elo) / 2.0;
        END IF;
      END IF;

      team1_expected := 1.0 / (1.0 + POWER(10.0, (team2_elo - team1_elo) / 400.0));
      team2_expected := 1.0 / (1.0 + POWER(10.0, (team1_elo - team2_elo) / 400.0));

      change_p1 := ROUND(v_k * (team1_actual - team1_expected));
      change_p2 := ROUND(v_k * (team2_actual - team2_expected));

      -- Update Player 1
      UPDATE players SET 
        elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p1),
        tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p1)
      WHERE id = m_record.player1_id;

      IF m_record.category = 'Singles' THEN
        UPDATE players SET singles_elo = COALESCE(singles_elo, 1200) + change_p1, tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p1 WHERE id = m_record.player1_id;
      ELSIF m_record.category = 'Doubles' THEN
        UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p1, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p1 WHERE id = m_record.player1_id;
      ELSIF m_record.category = 'Mixed' THEN
        UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p1, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p1 WHERE id = m_record.player1_id;
      END IF;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player1_id, v_winner_elo, v_winner_elo + change_p1, change_p1, team1_expected, team1_actual, COALESCE(m_record.category, 'Singles'));

      -- Update Player 2
      UPDATE players SET 
        elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p2),
        tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p2)
      WHERE id = m_record.player2_id;

      IF m_record.category = 'Singles' THEN
        UPDATE players SET singles_elo = COALESCE(singles_elo, 1200) + change_p2, tournament_singles_elo = COALESCE(tournament_singles_elo, 1200) + change_p2 WHERE id = m_record.player2_id;
      ELSIF m_record.category = 'Doubles' THEN
        UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p2, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p2 WHERE id = m_record.player2_id;
      ELSIF m_record.category = 'Mixed' THEN
        UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p2, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p2 WHERE id = m_record.player2_id;
      END IF;

      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player2_id, v_loser_elo, v_loser_elo + change_p2, change_p2, team2_expected, team2_actual, COALESCE(m_record.category, 'Singles'));

      -- Player 3 & 4
      IF (m_record.category = 'Doubles' OR m_record.category = 'Mixed') THEN
        change_p3 := ROUND(v_k * (team1_actual - team1_expected));
        change_p4 := ROUND(v_k * (team2_actual - team2_expected));

        IF m_record.player3_id IS NOT NULL THEN
          UPDATE players SET elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p3), tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p3) WHERE id = m_record.player3_id;
          IF m_record.category = 'Doubles' THEN UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p3, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p3 WHERE id = m_record.player3_id; END IF;
          IF m_record.category = 'Mixed' THEN UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p3, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p3 WHERE id = m_record.player3_id; END IF;
          INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
          VALUES (m_record.id, m_record.player3_id, v_p3_cat_elo, v_p3_cat_elo + change_p3, change_p3, team1_expected, team1_actual, COALESCE(m_record.category, 'Doubles'));
        END IF;

        IF m_record.player4_id IS NOT NULL THEN
          UPDATE players SET elo_rating = GREATEST(100, COALESCE(elo_rating, 1200) + change_p4), tournament_elo = GREATEST(100, COALESCE(tournament_elo, 1200) + change_p4) WHERE id = m_record.player4_id;
          IF m_record.category = 'Doubles' THEN UPDATE players SET doubles_elo = COALESCE(doubles_elo, 1200) + change_p4, tournament_doubles_elo = COALESCE(tournament_doubles_elo, 1200) + change_p4 WHERE id = m_record.player4_id; END IF;
          IF m_record.category = 'Mixed' THEN UPDATE players SET mixed_elo = COALESCE(mixed_elo, 1200) + change_p4, tournament_mixed_elo = COALESCE(tournament_mixed_elo, 1200) + change_p4 WHERE id = m_record.player4_id; END IF;
          INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
          VALUES (m_record.id, m_record.player4_id, v_p4_cat_elo, v_p4_cat_elo + change_p4, change_p4, team2_expected, team2_actual, COALESCE(m_record.category, 'Doubles'));
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION recalculate_tournament_elo() TO authenticated;
