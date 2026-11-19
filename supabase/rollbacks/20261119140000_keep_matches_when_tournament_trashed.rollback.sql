-- Rollback for 20261119140000_keep_matches_when_tournament_trashed.
--
-- Restores the function bodies exactly as they were on production on
-- 2026-11-19 (pg_get_functiondef text, no search_path setting), drops the
-- RLS policy and its helper. Grants are kept by CREATE OR REPLACE.
--
-- Not automatic: tournaments trashed while the migration was live keep their
-- matches. The old trigger deletes matches only at the moment of trashing, so
-- after this rollback those matches would show to admins and global umpires
-- and count in win/loss records again the next time a player is recounted.
-- To return fully to the old behaviour, also run the commented block at the
-- end (it deletes those matches and their point logs; it cannot be undone).

DROP POLICY IF EXISTS "tm_hide_trashed" ON public.tournament_matches;
DROP FUNCTION IF EXISTS public.trashed_tournament_ids();

CREATE OR REPLACE FUNCTION public.handle_deleted_tournament()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.status = 'deleted' AND OLD.status != 'deleted' THEN
    DELETE FROM tournament_matches WHERE tournament_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_player_all_records(player_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
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
$function$
;

-- Optional, destructive (see header):
-- DELETE FROM public.tournament_matches
--  WHERE tournament_id IN (SELECT id FROM public.tournaments WHERE status = 'deleted');
