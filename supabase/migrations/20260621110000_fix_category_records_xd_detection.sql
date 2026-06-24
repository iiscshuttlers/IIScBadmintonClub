-- Fix: recalculate_category_records was only counting category = 'Mixed Doubles'
-- for mixed_record. But umpire_submit_match stores all doubles as category = 'Doubles'
-- (same as the ELO trigger expects). XD vs MD/WD is determined by player genders,
-- mirroring the logic in the ELO trigger (fix_elo_and_recalculate_uuid.sql).
--
-- This migration:
--   1. Replaces recalculate_category_records with a gender-aware version.
--   2. Backfills all players who have confirmed doubles matches.

CREATE OR REPLACE FUNCTION recalculate_category_records(player_uuid UUID)
RETURNS VOID AS $$
DECLARE
  s_wins  INT := 0; s_losses  INT := 0;
  d_wins  INT := 0; d_losses  INT := 0;
  xd_wins INT := 0; xd_losses INT := 0;
BEGIN
  -- ── Singles ──────────────────────────────────────────────────────────────────
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
  FROM matches
  WHERE status = 'confirmed'
    AND category = 'Singles'
    AND (player1_id = player_uuid OR player2_id = player_uuid);

  UPDATE players
  SET singles_record = COALESCE(s_wins,0) || 'W - ' || COALESCE(s_losses,0) || 'L'
  WHERE id = player_uuid;

  -- ── Pure Doubles (MD/WD): same-gender team ────────────────────────────────────
  -- Mirrors ELO trigger: team1_type='XD' only when genders differ.
  -- We count 'Doubles' matches where team1's genders are the same (or unknown).
  SELECT
    COUNT(*) FILTER (WHERE
      ((m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
      ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      ((m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
      ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO d_wins, d_losses
  FROM matches m
  LEFT JOIN players pa ON pa.id = m.player1_id
  LEFT JOIN players pb ON pb.id = m.team1_partner_id
  WHERE m.status = 'confirmed'
    AND m.category = 'Doubles'
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid
         OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid)
    -- Same gender (MD/WD), or either gender unknown — conservative: not-XD
    AND (pa.gender = pb.gender OR pa.gender IS NULL OR pb.gender IS NULL);

  UPDATE players
  SET doubles_record = COALESCE(d_wins,0) || 'W - ' || COALESCE(d_losses,0) || 'L'
  WHERE id = player_uuid;

  -- ── Mixed Doubles (XD): mixed-gender team ─────────────────────────────────────
  -- Count 'Doubles' matches where both genders are known and differ,
  -- plus any legacy rows stored as 'Mixed Doubles'.
  SELECT
    COUNT(*) FILTER (WHERE
      ((m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
      ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      ((m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
      ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO xd_wins, xd_losses
  FROM matches m
  LEFT JOIN players pa ON pa.id = m.player1_id
  LEFT JOIN players pb ON pb.id = m.team1_partner_id
  WHERE m.status = 'confirmed'
    AND (
      m.category = 'Mixed Doubles'
      OR (
        m.category = 'Doubles'
        AND pa.gender IS NOT NULL AND pb.gender IS NOT NULL
        AND pa.gender <> pb.gender   -- mixed gender → XD
      )
    )
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid
         OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid);

  UPDATE players
  SET mixed_record = COALESCE(xd_wins,0) || 'W - ' || COALESCE(xd_losses,0) || 'L'
  WHERE id = player_uuid;
END;
$$ LANGUAGE plpgsql;

-- ── Backfill all players with confirmed doubles matches ────────────────────────
DO $$
DECLARE
  pid UUID;
BEGIN
  FOR pid IN
    SELECT DISTINCT unnest(ARRAY[player1_id, player2_id, team1_partner_id, team2_partner_id])
    FROM matches
    WHERE status = 'confirmed'
      AND category IN ('Singles', 'Doubles', 'Mixed Doubles')
  LOOP
    IF pid IS NOT NULL THEN
      PERFORM recalculate_category_records(pid);
    END IF;
  END LOOP;
END;
$$;
