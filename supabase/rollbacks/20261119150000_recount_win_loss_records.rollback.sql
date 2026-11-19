-- Rollback for 20261119150000_recount_win_loss_records.sql
--
-- Restores the exact function text that was live before it (from
-- pg_get_functiondef on 2026-11-19): recalculate_player_all_records and
-- recalculate_category_records as left by 20261119140000, and
-- trigger_update_win_loss_records as left by 20261118120000. Then drops the
-- helper counted_match_results().
--
-- Stored records are NOT recounted. They keep the values the new rule wrote
-- until each player's next recount under the old rule, which counts byes
-- recorded as 'W/O' as wins and ignores losses to guests. The values before
-- the migration are in the git-ignored
-- backups/2026-11-19-win-loss-recount/players_records_before.json of the main
-- checkout, if they are ever needed.

CREATE OR REPLACE FUNCTION public.recalculate_player_all_records(player_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  overall_wins INT := 0;
  overall_losses INT := 0;
BEGIN
  WITH all_tourney AS (
    SELECT winner_id, player1_id, player2_id, player3_id as team1_partner_id, player4_id as team2_partner_id
    FROM tournament_matches
    WHERE status IN ('completed', 'walkover')
      AND score NOT ILIKE '%BYE%'
      AND tournament_id NOT IN (SELECT id FROM tournaments WHERE status = 'deleted')
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
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_category_records(player_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      AND tournament_id NOT IN (SELECT id FROM tournaments WHERE status = 'deleted')
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
      AND tournament_id NOT IN (SELECT id FROM tournaments WHERE status = 'deleted')
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
      AND tournament_id NOT IN (SELECT id FROM tournaments WHERE status = 'deleted')
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
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_win_loss_records()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  rec RECORD;
BEGIN
  IF TG_TABLE_NAME = 'tournament_matches' THEN
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
$function$
;

DROP FUNCTION IF EXISTS public.counted_match_results(uuid);
