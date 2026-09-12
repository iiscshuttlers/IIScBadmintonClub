-- Update RPCs to include both friendly matches (matches) and tournament matches (tournament_matches)
-- This ensures that players' win_loss_record, singles_record, doubles_record, and mixed_record 
-- include their tournament performances as well.

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

  WITH all_matches AS (
    SELECT player1_id, player2_id, team1_partner_id, team2_partner_id, winner_id
    FROM matches
    WHERE status = 'confirmed' 
      AND (player1_id = player_uuid OR player2_id = player_uuid OR team1_partner_id = player_uuid OR team2_partner_id = player_uuid)
    UNION ALL
    SELECT player1_id, player2_id, player3_id as team1_partner_id, player4_id as team2_partner_id, winner_id
    FROM tournament_matches
    WHERE status = 'completed' 
      AND (player1_id = player_uuid OR player2_id = player_uuid OR player3_id = player_uuid OR player4_id = player_uuid)
  )
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
  FROM all_matches m;

  UPDATE players
  SET 
    win_loss_record = COALESCE(overall_wins, 0) || 'W - ' || COALESCE(overall_losses, 0) || 'L',
    total_friendly_matches = COALESCE(overall_wins, 0) + COALESCE(overall_losses, 0) -- Might want to rename this column eventually, but keeping for compatibility
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
    SELECT player1_id, player2_id, winner_id FROM matches 
    WHERE status = 'confirmed' AND team1_partner_id IS NULL AND team2_partner_id IS NULL
      AND (player1_id = player_uuid OR player2_id = player_uuid)
    UNION ALL
    SELECT player1_id, player2_id, winner_id FROM tournament_matches
    WHERE status = 'completed' AND player3_id IS NULL AND player4_id IS NULL
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
  FROM all_singles m;

  -- Doubles (Same Gender)
  WITH all_doubles AS (
    SELECT m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id, m.winner_id FROM matches m
    WHERE status = 'confirmed' AND m.team1_partner_id IS NOT NULL AND m.team2_partner_id IS NOT NULL
      AND (
        ((SELECT gender FROM players WHERE id = m.player1_id) = (SELECT gender FROM players WHERE id = m.team1_partner_id))
        AND ((SELECT gender FROM players WHERE id = m.player2_id) = (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid)
    UNION ALL
    SELECT player1_id, player2_id, player3_id as team1_partner_id, player4_id as team2_partner_id, winner_id 
    FROM tournament_matches
    WHERE status = 'completed' AND player3_id IS NOT NULL AND player4_id IS NOT NULL
      AND (category ILIKE '%MD%' OR category ILIKE '%WD%' OR category ILIKE '%Doubles%')
      AND category NOT ILIKE '%XD%' AND category NOT ILIKE '%Mixed%'
      AND (player1_id = player_uuid OR player2_id = player_uuid OR player3_id = player_uuid OR player4_id = player_uuid)
  )
  SELECT
    COUNT(*) FILTER (WHERE
      (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO d_wins, d_losses
  FROM all_doubles m;

  -- Mixed Doubles
  WITH all_mixed AS (
    SELECT m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id, m.winner_id FROM matches m
    WHERE status = 'confirmed' AND m.team1_partner_id IS NOT NULL AND m.team2_partner_id IS NOT NULL
      AND (
        ((SELECT gender FROM players WHERE id = m.player1_id) <> (SELECT gender FROM players WHERE id = m.team1_partner_id))
        OR ((SELECT gender FROM players WHERE id = m.player2_id) <> (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid)
    UNION ALL
    SELECT player1_id, player2_id, player3_id as team1_partner_id, player4_id as team2_partner_id, winner_id 
    FROM tournament_matches
    WHERE status = 'completed' AND player3_id IS NOT NULL AND player4_id IS NOT NULL
      AND (category ILIKE '%XD%' OR category ILIKE '%Mixed%')
      AND (player1_id = player_uuid OR player2_id = player_uuid OR player3_id = player_uuid OR player4_id = player_uuid)
  )
  SELECT
    COUNT(*) FILTER (WHERE
      (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO xd_wins, xd_losses
  FROM all_mixed m;

  UPDATE players
  SET 
    singles_record = COALESCE(s_wins, 0) || 'W - ' || COALESCE(s_losses, 0) || 'L',
    doubles_record = COALESCE(d_wins, 0) || 'W - ' || COALESCE(d_losses, 0) || 'L',
    mixed_record = COALESCE(xd_wins, 0) || 'W - ' || COALESCE(xd_losses, 0) || 'L'
  WHERE id = player_uuid;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger recalculation for all existing players
SELECT recalculate_player_all_records(id) FROM players;
