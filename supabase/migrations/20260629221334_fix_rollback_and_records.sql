-- 1. Create a function to comprehensively recalculate ALL match records for a player
CREATE OR REPLACE FUNCTION recalculate_player_all_records(player_uuid UUID)
RETURNS VOID AS $$
DECLARE
  overall_wins INT := 0;
  overall_losses INT := 0;
BEGIN
  -- Calculate overall wins and losses by explicitly searching for the player in the confirmed matches
  SELECT 
    COUNT(*) FILTER (
      WHERE ( (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
         OR ( (m.player2_id = player_uuid OR m.team2_partner_id = player_uuid) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
    ),
    COUNT(*) FILTER (
      WHERE ( (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
         OR ( (m.player2_id = player_uuid OR m.team2_partner_id = player_uuid) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
    )
  INTO overall_wins, overall_losses
  FROM matches m
  WHERE m.status = 'confirmed' 
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid);

  -- Update overall W/L and matches played
  UPDATE players
  SET 
    win_loss_record = COALESCE(overall_wins, 0) || 'W - ' || COALESCE(overall_losses, 0) || 'L',
    total_friendly_matches = COALESCE(overall_wins, 0) + COALESCE(overall_losses, 0)
  WHERE id = player_uuid;

  -- Calculate category specific records using the existing gender-aware function (Singles, Doubles, Mixed Doubles)
  PERFORM recalculate_category_records(player_uuid);
END;
$$ LANGUAGE plpgsql;


-- 2. Replace the match deletion trigger to mathematically rollback ELO correctly (dividing overall ELO by 3 as per active application logic)
CREATE OR REPLACE FUNCTION rollback_elo_on_match_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- We only roll back ELO if the match was confirmed (meaning ELO was actually awarded)
  IF OLD.status = 'confirmed' THEN

    -- Rollback Player 1
    IF OLD.player1_id IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - COALESCE(OLD.elo_change_p1 / 3, 0),
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - COALESCE(OLD.elo_change_p1, 0) ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD') THEN doubles_elo - COALESCE(OLD.elo_change_p1, 0) ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'XD') THEN mixed_elo - COALESCE(OLD.elo_change_p1, 0) ELSE mixed_elo END
      WHERE id = OLD.player1_id;
    END IF;

    -- Rollback Player 2
    IF OLD.player2_id IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - COALESCE(OLD.elo_change_p2 / 3, 0),
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - COALESCE(OLD.elo_change_p2, 0) ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD') THEN doubles_elo - COALESCE(OLD.elo_change_p2, 0) ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'XD') THEN mixed_elo - COALESCE(OLD.elo_change_p2, 0) ELSE mixed_elo END
      WHERE id = OLD.player2_id;
    END IF;

    -- Rollback Team 1 Partner
    IF OLD.team1_partner_id IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - COALESCE(OLD.elo_change_p3 / 3, 0),
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD') THEN doubles_elo - COALESCE(OLD.elo_change_p3, 0) ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'XD') THEN mixed_elo - COALESCE(OLD.elo_change_p3, 0) ELSE mixed_elo END
      WHERE id = OLD.team1_partner_id;
    END IF;

    -- Rollback Team 2 Partner
    IF OLD.team2_partner_id IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - COALESCE(OLD.elo_change_p4 / 3, 0),
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD') THEN doubles_elo - COALESCE(OLD.elo_change_p4, 0) ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'XD') THEN mixed_elo - COALESCE(OLD.elo_change_p4, 0) ELSE mixed_elo END
      WHERE id = OLD.team2_partner_id;
    END IF;

    -- Recalculate all W/L records and matches played for all involved players based on remaining matches
    IF OLD.player1_id IS NOT NULL THEN PERFORM recalculate_player_all_records(OLD.player1_id); END IF;
    IF OLD.player2_id IS NOT NULL THEN PERFORM recalculate_player_all_records(OLD.player2_id); END IF;
    IF OLD.team1_partner_id IS NOT NULL THEN PERFORM recalculate_player_all_records(OLD.team1_partner_id); END IF;
    IF OLD.team2_partner_id IS NOT NULL THEN PERFORM recalculate_player_all_records(OLD.team2_partner_id); END IF;

  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Execute a complete database correction for all players affected by the bug
DO $$
DECLARE
  pid UUID;
BEGIN
  -- Recalculate ALL ELOs accurately from scratch to eliminate corruption from buggy rollbacks
  PERFORM recalculate_all_elo();

  -- Recalculate all W/L and Match Records for every player
  FOR pid IN SELECT id FROM players WHERE deleted_at IS NULL LOOP
    PERFORM recalculate_player_all_records(pid);
  END LOOP;
END;
$$;
