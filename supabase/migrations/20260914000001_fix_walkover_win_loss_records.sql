-- Fix walkover stats being excluded from win/loss records, and fix the trigger to use the new RPC

CREATE OR REPLACE FUNCTION recalculate_player_all_records(player_uuid UUID)
RETURNS VOID AS $$
DECLARE
  overall_wins INT := 0;
  overall_losses INT := 0;
BEGIN
  -- ADMIN CHECK
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admins can trigger system-wide recalculations';
    END IF;
  END IF;

  WITH all_tourney AS (
    SELECT winner_id, player1_id, player2_id, player3_id as team1_partner_id, player4_id as team2_partner_id
    FROM tournament_matches
    WHERE status IN ('completed', 'walkover')
      AND score NOT ILIKE '%BYE%'
      AND (player1_id = player_uuid OR player2_id = player_uuid OR player3_id = player_uuid OR player4_id = player_uuid)
  )
  SELECT 
    COUNT(*) FILTER (
      WHERE ( (player1_id = player_uuid OR team1_partner_id = player_uuid) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
         OR ( (player2_id = player_uuid OR team2_partner_id = player_uuid) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
    ),
    COUNT(*) FILTER (
      WHERE ( (player1_id = player_uuid OR team1_partner_id = player_uuid) AND (winner_id = player2_id OR winner_id = team2_partner_id) )
         OR ( (player2_id = player_uuid OR team2_partner_id = player_uuid) AND (winner_id = player1_id OR winner_id = team1_partner_id) )
    )
  INTO overall_wins, overall_losses
  FROM all_tourney;

  UPDATE players
  SET 
    win_loss_record = COALESCE(overall_wins, 0) || 'W - ' || COALESCE(overall_losses, 0) || 'L',
    total_friendly_matches = COALESCE(overall_wins, 0) + COALESCE(overall_losses, 0)
  WHERE id = player_uuid;

  PERFORM recalculate_category_records(player_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION recalculate_category_records(player_uuid UUID)
RETURNS VOID AS $$
DECLARE
  s_wins  INT := 0; s_losses  INT := 0;
  d_wins  INT := 0; d_losses  INT := 0;
  xd_wins INT := 0; xd_losses INT := 0;
BEGIN
  -- ADMIN CHECK
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admins can trigger system-wide recalculations';
    END IF;
  END IF;

  -- Singles
  WITH all_singles AS (
    SELECT player1_id, player2_id, winner_id FROM tournament_matches
    WHERE status IN ('completed', 'walkover')
      AND score NOT ILIKE '%BYE%'
      AND (category ILIKE '%MS%' OR category ILIKE '%WS%' OR category ILIKE '%Singles%')
      AND (player1_id = player_uuid OR player2_id = player_uuid)
  )
  SELECT
    COUNT(*) FILTER (WHERE
      (player1_id = player_uuid AND winner_id = player1_id) OR
      (player2_id = player_uuid AND winner_id = player2_id)
    ),
    COUNT(*) FILTER (WHERE
      (player1_id = player_uuid AND winner_id <> player1_id) OR
      (player2_id = player_uuid AND winner_id <> player2_id)
    )
  INTO s_wins, s_losses
  FROM all_singles;

  -- Doubles (Mens & Womens, NOT Mixed)
  WITH all_doubles AS (
    SELECT player1_id, player2_id, player3_id as team1_partner_id, player4_id as team2_partner_id, winner_id 
    FROM tournament_matches
    WHERE status IN ('completed', 'walkover')
      AND score NOT ILIKE '%BYE%'
      AND (category ILIKE '%MD%' OR category ILIKE '%WD%' OR category ILIKE '%Doubles%')
      AND (category NOT ILIKE '%XD%' AND category NOT ILIKE '%Mixed%')
      AND (player1_id = player_uuid OR player2_id = player_uuid OR player3_id = player_uuid OR player4_id = player_uuid)
  )
  SELECT
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid) AND (winner_id = player1_id OR winner_id = team1_partner_id)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid) AND (winner_id = player2_id OR winner_id = team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid) AND (winner_id = player2_id OR winner_id = team2_partner_id)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid) AND (winner_id = player1_id OR winner_id = team1_partner_id))
    )
  INTO d_wins, d_losses
  FROM all_doubles;

  -- Mixed Doubles
  WITH all_mixed AS (
    SELECT player1_id, player2_id, player3_id as team1_partner_id, player4_id as team2_partner_id, winner_id 
    FROM tournament_matches
    WHERE status IN ('completed', 'walkover')
      AND score NOT ILIKE '%BYE%'
      AND (category ILIKE '%XD%' OR category ILIKE '%Mixed%')
      AND (player1_id = player_uuid OR player2_id = player_uuid OR player3_id = player_uuid OR player4_id = player_uuid)
  )
  SELECT
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid) AND (winner_id = player1_id OR winner_id = team1_partner_id)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid) AND (winner_id = player2_id OR winner_id = team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid) AND (winner_id = player2_id OR winner_id = team2_partner_id)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid) AND (winner_id = player1_id OR winner_id = team1_partner_id))
    )
  INTO xd_wins, xd_losses
  FROM all_mixed;

  -- Update player records
  UPDATE players
  SET
    singles_record = s_wins || 'W - ' || s_losses || 'L',
    doubles_record = d_wins || 'W - ' || d_losses || 'L',
    mixed_record   = xd_wins || 'W - ' || xd_losses || 'L'
  WHERE id = player_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
       IF rec.player1_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player1_id); END IF;
       IF rec.player2_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player2_id); END IF;
       IF rec.team1_partner_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.team1_partner_id); END IF;
       IF rec.team2_partner_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.team2_partner_id); END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'tournament_matches' THEN
    IF (TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'walkover') AND OLD.status NOT IN ('completed', 'walkover')) OR
       (TG_OP = 'UPDATE' AND OLD.status IN ('completed', 'walkover') AND NEW.status NOT IN ('completed', 'walkover')) OR
       (TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'walkover') AND NEW.winner_id IS DISTINCT FROM OLD.winner_id) OR
       (TG_OP = 'DELETE' AND OLD.status IN ('completed', 'walkover')) THEN
       
       rec := COALESCE(NEW, OLD);
       IF rec.player1_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player1_id); END IF;
       IF rec.player2_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player2_id); END IF;
       IF rec.player3_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player3_id); END IF;
       IF rec.player4_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player4_id); END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger recalculation for all existing players
SELECT recalculate_player_all_records(id) FROM players;
