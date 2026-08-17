-- Add missing record columns if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'singles_record') THEN
    ALTER TABLE players ADD COLUMN singles_record TEXT DEFAULT '0W - 0L';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'doubles_record') THEN
    ALTER TABLE players ADD COLUMN doubles_record TEXT DEFAULT '0W - 0L';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'mixed_record') THEN
    ALTER TABLE players ADD COLUMN mixed_record TEXT DEFAULT '0W - 0L';
  END IF;
END $$;

-- Create function to recalculate all win/loss records for a specific player
CREATE OR REPLACE FUNCTION recalculate_player_win_loss_records(p_player_id UUID)
RETURNS VOID AS $$
BEGIN
  WITH match_participants AS (
    -- Friendly Matches
    SELECT 
      m.id as match_id,
      COALESCE(m.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = m.player1_id OR p.id = m.team1_partner_id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) THEN true
        WHEN (p.id = m.player2_id OR p.id = m.team2_partner_id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) THEN true
        ELSE false
      END as is_win
    FROM matches m
    JOIN players p ON p.id IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id)
    WHERE m.status = 'confirmed' AND p.id = p_player_id

    UNION ALL

    -- Tournament Matches
    SELECT 
      tm.id as match_id,
      COALESCE(tm.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = tm.player1_id OR p.id = tm.player3_id) AND (tm.winner_id = tm.player1_id OR tm.winner_id = tm.player3_id) THEN true
        WHEN (p.id = tm.player2_id OR p.id = tm.player4_id) AND (tm.winner_id = tm.player2_id OR tm.winner_id = tm.player4_id) THEN true
        ELSE false
      END as is_win
    FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    JOIN players p ON p.id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
    WHERE tm.status = 'completed' AND t.status != 'deleted' AND p.id = p_player_id
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL -- Exclude BYEs
  ),
  aggregated_stats AS (
    SELECT 
      player_id,
      
      -- Overall
      COUNT(*) FILTER (WHERE is_win) as overall_wins,
      COUNT(*) FILTER (WHERE NOT is_win) as overall_losses,
      
      -- Singles
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND is_win) as singles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND NOT is_win) as singles_losses,
      
      -- Doubles
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND is_win) as doubles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND NOT is_win) as doubles_losses,
      
      -- Mixed
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND is_win) as mixed_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND NOT is_win) as mixed_losses
      
    FROM match_participants
    GROUP BY player_id
  )
  UPDATE players p
  SET 
    win_loss_record = COALESCE(ast.overall_wins, 0) || 'W - ' || COALESCE(ast.overall_losses, 0) || 'L',
    singles_record = COALESCE(ast.singles_wins, 0) || 'W - ' || COALESCE(ast.singles_losses, 0) || 'L',
    doubles_record = COALESCE(ast.doubles_wins, 0) || 'W - ' || COALESCE(ast.doubles_losses, 0) || 'L',
    mixed_record = COALESCE(ast.mixed_wins, 0) || 'W - ' || COALESCE(ast.mixed_losses, 0) || 'L'
  FROM aggregated_stats ast
  WHERE p.id = p_player_id AND p.id = ast.player_id;

  -- If player had no matches, reset them
  IF NOT FOUND THEN
    UPDATE players
    SET 
      win_loss_record = '0W - 0L',
      singles_record = '0W - 0L',
      doubles_record = '0W - 0L',
      mixed_record = '0W - 0L'
    WHERE id = p_player_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION recalculate_player_win_loss_records(UUID) TO authenticated;

-- Create function to recalculate all win/loss records globally
CREATE OR REPLACE FUNCTION recalculate_all_win_loss_records()
RETURNS VOID AS $$
DECLARE
  rec RECORD;
BEGIN
  -- We just apply the logic for all players efficiently using the same CTE but without the player_id filter
  WITH match_participants AS (
    SELECT 
      m.id as match_id,
      COALESCE(m.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = m.player1_id OR p.id = m.team1_partner_id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) THEN true
        WHEN (p.id = m.player2_id OR p.id = m.team2_partner_id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) THEN true
        ELSE false
      END as is_win
    FROM matches m
    JOIN players p ON p.id IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id)
    WHERE m.status = 'confirmed' AND p.id IS NOT NULL

    UNION ALL

    SELECT 
      tm.id as match_id,
      COALESCE(tm.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = tm.player1_id OR p.id = tm.player3_id) AND (tm.winner_id = tm.player1_id OR tm.winner_id = tm.player3_id) THEN true
        WHEN (p.id = tm.player2_id OR p.id = tm.player4_id) AND (tm.winner_id = tm.player2_id OR tm.winner_id = tm.player4_id) THEN true
        ELSE false
      END as is_win
    FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    JOIN players p ON p.id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
    WHERE tm.status = 'completed' AND t.status != 'deleted' AND p.id IS NOT NULL
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
  ),
  aggregated_stats AS (
    SELECT 
      player_id,
      COUNT(*) FILTER (WHERE is_win) as overall_wins,
      COUNT(*) FILTER (WHERE NOT is_win) as overall_losses,
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND is_win) as singles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND NOT is_win) as singles_losses,
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND is_win) as doubles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND NOT is_win) as doubles_losses,
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND is_win) as mixed_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND NOT is_win) as mixed_losses
    FROM match_participants
    GROUP BY player_id
  )
  UPDATE players p
  SET 
    win_loss_record = COALESCE(ast.overall_wins, 0) || 'W - ' || COALESCE(ast.overall_losses, 0) || 'L',
    singles_record = COALESCE(ast.singles_wins, 0) || 'W - ' || COALESCE(ast.singles_losses, 0) || 'L',
    doubles_record = COALESCE(ast.doubles_wins, 0) || 'W - ' || COALESCE(ast.doubles_losses, 0) || 'L',
    mixed_record = COALESCE(ast.mixed_wins, 0) || 'W - ' || COALESCE(ast.mixed_losses, 0) || 'L'
  FROM aggregated_stats ast
  WHERE p.id = ast.player_id;

  -- Reset players with NO matches
  UPDATE players
  SET 
    win_loss_record = '0W - 0L', singles_record = '0W - 0L', doubles_record = '0W - 0L', mixed_record = '0W - 0L'
  WHERE id NOT IN (
    SELECT p.id FROM matches m JOIN players p ON p.id IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id) WHERE m.status = 'confirmed' AND p.id IS NOT NULL
    UNION
    SELECT p.id FROM tournament_matches tm JOIN tournaments t ON t.id = tm.tournament_id JOIN players p ON p.id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id) WHERE tm.status = 'completed' AND t.status != 'deleted' AND p.id IS NOT NULL AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION recalculate_all_win_loss_records() TO authenticated;

-- Create Trigger function to auto-update
CREATE OR REPLACE FUNCTION trigger_update_win_loss_records()
RETURNS TRIGGER AS $$
DECLARE 
  rec RECORD;
BEGIN
  IF TG_TABLE_NAME = 'matches' THEN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed') OR
       (TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status != 'confirmed') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND NEW.winner_id IS DISTINCT FROM OLD.winner_id) OR
       (TG_OP = 'DELETE' AND OLD.status = 'confirmed') THEN
       
       rec := COALESCE(NEW, OLD);
       IF rec.player1_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.player1_id); END IF;
       IF rec.player2_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.player2_id); END IF;
       IF rec.team1_partner_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.team1_partner_id); END IF;
       IF rec.team2_partner_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.team2_partner_id); END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'tournament_matches' THEN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
       (TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status != 'completed') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND NEW.winner_id IS DISTINCT FROM OLD.winner_id) OR
       (TG_OP = 'DELETE' AND OLD.status = 'completed') THEN
       
       rec := COALESCE(NEW, OLD);
       IF rec.player1_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.player1_id); END IF;
       IF rec.player2_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.player2_id); END IF;
       IF rec.player3_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.player3_id); END IF;
       IF rec.player4_id IS NOT NULL THEN PERFORM recalculate_player_win_loss_records(rec.player4_id); END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_win_loss_friendly ON matches;
CREATE TRIGGER trg_update_win_loss_friendly
AFTER INSERT OR UPDATE OR DELETE ON matches
FOR EACH ROW EXECUTE FUNCTION trigger_update_win_loss_records();

DROP TRIGGER IF EXISTS trg_update_win_loss_tournament ON tournament_matches;
CREATE TRIGGER trg_update_win_loss_tournament
AFTER INSERT OR UPDATE OR DELETE ON tournament_matches
FOR EACH ROW EXECUTE FUNCTION trigger_update_win_loss_records();

-- Execute the global recalculation immediately to fix existing bad data
SELECT recalculate_all_win_loss_records();
