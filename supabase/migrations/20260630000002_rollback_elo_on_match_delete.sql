-- Trigger to rollback ELO when a friendly match is deleted
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
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rollback_elo_on_match_delete ON matches;
CREATE TRIGGER trigger_rollback_elo_on_match_delete
AFTER DELETE ON matches
FOR EACH ROW
EXECUTE FUNCTION rollback_elo_on_match_delete();
