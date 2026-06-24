-- Fix: singles_record, doubles_record, mixed_record were never updated on match confirm.
-- This migration:
--   1. Creates a helper function that recalculates all three category records for one player.
--   2. Creates an AFTER UPDATE trigger on matches so every future confirmation updates them.
--   3. Backfills all existing confirmed matches.
--
-- Category values stored in matches.category:
--   'Singles'       → singles_record
--   'Doubles'       → doubles_record
--   'Mixed Doubles' → mixed_record
--   'Hybrid'        → skipped (no ELO impact, no category record)

-- ── 1. Helper function ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recalculate_category_records(player_uuid UUID)
RETURNS VOID AS $$
DECLARE
  s_wins   INT := 0; s_losses   INT := 0;
  d_wins   INT := 0; d_losses   INT := 0;
  xd_wins  INT := 0; xd_losses  INT := 0;
BEGIN
  -- Singles record
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

  -- Doubles record
  SELECT
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid)
        AND (winner_id = player1_id OR winner_id = team1_partner_id)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid)
        AND (winner_id = player2_id OR winner_id = team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid)
        AND winner_id <> player1_id AND winner_id <> COALESCE(team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid)
        AND winner_id <> player2_id AND winner_id <> COALESCE(team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO d_wins, d_losses
  FROM matches
  WHERE status = 'confirmed'
    AND category = 'Doubles'
    AND (player1_id = player_uuid OR player2_id = player_uuid
         OR team1_partner_id = player_uuid OR team2_partner_id = player_uuid);

  UPDATE players
  SET doubles_record = COALESCE(d_wins,0) || 'W - ' || COALESCE(d_losses,0) || 'L'
  WHERE id = player_uuid;

  -- Mixed Doubles record
  SELECT
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid)
        AND (winner_id = player1_id OR winner_id = team1_partner_id)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid)
        AND (winner_id = player2_id OR winner_id = team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      ((player1_id = player_uuid OR team1_partner_id = player_uuid)
        AND winner_id <> player1_id AND winner_id <> COALESCE(team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
      ((player2_id = player_uuid OR team2_partner_id = player_uuid)
        AND winner_id <> player2_id AND winner_id <> COALESCE(team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO xd_wins, xd_losses
  FROM matches
  WHERE status = 'confirmed'
    AND category = 'Mixed Doubles'
    AND (player1_id = player_uuid OR player2_id = player_uuid
         OR team1_partner_id = player_uuid OR team2_partner_id = player_uuid);

  UPDATE players
  SET mixed_record = COALESCE(xd_wins,0) || 'W - ' || COALESCE(xd_losses,0) || 'L'
  WHERE id = player_uuid;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Trigger function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_update_category_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status transitions to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    -- Skip Hybrid — no ELO, no category record
    IF NEW.category <> 'Hybrid' THEN
      PERFORM recalculate_category_records(NEW.player1_id);
      PERFORM recalculate_category_records(NEW.player2_id);
      IF NEW.team1_partner_id IS NOT NULL THEN
        PERFORM recalculate_category_records(NEW.team1_partner_id);
      END IF;
      IF NEW.team2_partner_id IS NOT NULL THEN
        PERFORM recalculate_category_records(NEW.team2_partner_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists so re-runs are safe
DROP TRIGGER IF EXISTS on_match_confirmed_update_category_records ON matches;

CREATE TRIGGER on_match_confirmed_update_category_records
  AFTER UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_category_records();

-- ── 3. Backfill all existing confirmed matches ─────────────────────────────
-- Collect every unique player that has at least one confirmed match and
-- recalculate their category records from scratch.

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
