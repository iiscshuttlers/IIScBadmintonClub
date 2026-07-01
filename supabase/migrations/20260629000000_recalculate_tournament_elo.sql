-- Function to completely recalculate tournament_elo for all players
-- Useful if tournament matches are deleted or a tournament is trashed.

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
  -- 1. Reset all players' tournament ELO to 1200
  UPDATE players SET tournament_elo = 1200;

  -- 2. Loop through all completed matches chronologically from non-deleted tournaments
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
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION recalculate_tournament_elo() TO authenticated;
