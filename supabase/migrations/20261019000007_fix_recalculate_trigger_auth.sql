-- Fix: recalculate_player_all_records and recalculate_category_records have admin checks
-- that block the trigger_update_win_loss_records trigger fired by submit_tournament_match.
-- When a non-admin submits a score, the match UPDATE triggers win/loss recalculation,
-- which calls these functions, which then reject because auth.uid() is not admin.
--
-- Security: these functions are already REVOKEd from public/authenticated (20260726000006),
-- preventing direct RPC calls by anyone. The inline admin check is therefore redundant
-- and only breaks the trigger chain. Removing it restores trigger functionality while
-- maintaining the same external access control via REVOKE.

CREATE OR REPLACE FUNCTION recalculate_player_all_records(player_uuid UUID)
RETURNS VOID AS $$
DECLARE
  overall_wins INT := 0;
  overall_losses INT := 0;
BEGIN
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

  UPDATE players
  SET
    singles_record = s_wins || 'W - ' || s_losses || 'L',
    doubles_record = d_wins || 'W - ' || d_losses || 'L',
    mixed_record   = xd_wins || 'W - ' || xd_losses || 'L'
  WHERE id = player_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
