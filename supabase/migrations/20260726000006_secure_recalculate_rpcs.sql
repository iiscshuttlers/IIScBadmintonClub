-- Secure Database Locking Recalculation RPCs against DoS Attacks

-- 1. recalculate_tournament_elo
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

  UPDATE players SET tournament_elo = 1200;

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

REVOKE EXECUTE ON FUNCTION recalculate_tournament_elo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recalculate_tournament_elo() FROM authenticated;


-- 2. recalculate_all_elo
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
    total_friendly_matches = 0,
    win_loss_record = '0W - 0L';

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION recalculate_all_elo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recalculate_all_elo() FROM authenticated;


-- 3. recalculate_player_all_records
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

  UPDATE players
  SET 
    win_loss_record = COALESCE(overall_wins, 0) || 'W - ' || COALESCE(overall_losses, 0) || 'L',
    total_friendly_matches = COALESCE(overall_wins, 0) + COALESCE(overall_losses, 0)
  WHERE id = player_uuid;

  PERFORM recalculate_category_records(player_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION recalculate_player_all_records(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recalculate_player_all_records(UUID) FROM authenticated;


-- 4. recalculate_category_records
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
  FROM matches m
  WHERE m.status = 'confirmed'
    AND m.team1_partner_id IS NULL AND m.team2_partner_id IS NULL
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid);

  -- Doubles (Same Gender)
  SELECT
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) = (SELECT gender FROM players WHERE id = m.team1_partner_id))
        AND ((SELECT gender FROM players WHERE id = m.player2_id) = (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) = (SELECT gender FROM players WHERE id = m.team1_partner_id))
        AND ((SELECT gender FROM players WHERE id = m.player2_id) = (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO d_wins, d_losses
  FROM matches m
  WHERE m.status = 'confirmed'
    AND m.team1_partner_id IS NOT NULL AND m.team2_partner_id IS NOT NULL
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid);

  -- Mixed Doubles
  SELECT
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) <> (SELECT gender FROM players WHERE id = m.team1_partner_id))
        OR ((SELECT gender FROM players WHERE id = m.player2_id) <> (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) <> (SELECT gender FROM players WHERE id = m.team1_partner_id))
        OR ((SELECT gender FROM players WHERE id = m.player2_id) <> (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO xd_wins, xd_losses
  FROM matches m
  WHERE m.status = 'confirmed'
    AND m.team1_partner_id IS NOT NULL AND m.team2_partner_id IS NOT NULL
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid);

  UPDATE players
  SET
    singles_record = COALESCE(s_wins, 0) || 'W - ' || COALESCE(s_losses, 0) || 'L',
    doubles_record = COALESCE(d_wins, 0) || 'W - ' || COALESCE(d_losses, 0) || 'L',
    mixed_record   = COALESCE(xd_wins, 0) || 'W - ' || COALESCE(xd_losses, 0) || 'L'
  WHERE id = player_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION recalculate_category_records(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recalculate_category_records(UUID) FROM authenticated;
