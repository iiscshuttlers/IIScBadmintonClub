-- Update trigger to also recalculate win/loss record for players when a match is deleted
CREATE OR REPLACE FUNCTION rollback_elo_on_match_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- We only roll back ELO if the match was confirmed (meaning ELO was actually applied)
  IF OLD.status = 'confirmed' AND OLD.is_friendly = true THEN
    
    -- Roll back Player 1
    IF OLD.player1_id IS NOT NULL AND OLD.elo_change_p1 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p1,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p1 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p1 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p1 ELSE mixed_elo END
      WHERE id = OLD.player1_id;
    END IF;

    -- Roll back Player 2
    IF OLD.player2_id IS NOT NULL AND OLD.elo_change_p2 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p2,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p2 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p2 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p2 ELSE mixed_elo END
      WHERE id = OLD.player2_id;
    END IF;

    -- Roll back Player 3 (Team 1 Partner)
    IF OLD.team1_partner_id IS NOT NULL AND OLD.elo_change_p3 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p3,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p3 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p3 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p3 ELSE mixed_elo END
      WHERE id = OLD.team1_partner_id;
    END IF;

    -- Roll back Player 4 (Team 2 Partner)
    IF OLD.team2_partner_id IS NOT NULL AND OLD.elo_change_p4 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p4,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p4 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p4 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p4 ELSE mixed_elo END
      WHERE id = OLD.team2_partner_id;
    END IF;

    -- Recalculate W/L records for all players involved in the deleted match
    UPDATE players p
    SET win_loss_record = (
      WITH p_stats AS (
        SELECT 
          COUNT(*) FILTER (
            WHERE ( (m.player1_id = p.id OR m.team1_partner_id = p.id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
               OR ( (m.player2_id = p.id OR m.team2_partner_id = p.id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
          ) as wins,
          COUNT(*) FILTER (
            WHERE ( (m.player1_id = p.id OR m.team1_partner_id = p.id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
               OR ( (m.player2_id = p.id OR m.team2_partner_id = p.id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
          ) as losses
        FROM matches m
        WHERE m.status = 'confirmed' 
          AND (m.player1_id = p.id OR m.player2_id = p.id OR m.team1_partner_id = p.id OR m.team2_partner_id = p.id)
      )
      SELECT COALESCE(wins, 0) || 'W - ' || COALESCE(losses, 0) || 'L' FROM p_stats
    )
    WHERE p.id IN (OLD.player1_id, OLD.player2_id, OLD.team1_partner_id, OLD.team2_partner_id)
      AND p.deleted_at IS NULL;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
