-- Recount every player's stored win/loss records, count them the way the app
-- shows results, and keep them in step with every change that affects a result.
--
-- players.win_loss_record, singles_record, doubles_record and mixed_record
-- (and total_friendly_matches, the overall count) are shown in the players
-- directory, profiles and previews, and current_club_ranks() ranks by them.
-- trigger_update_win_loss_records() recounts a match's players with
-- recalculate_player_all_records() / recalculate_category_records().
--
-- On 2026-11-19, stored records no longer matched the matches. Three causes:
--
-- 1. The trigger only reacted to an UPDATE that changed status into or out of
--    completed/walkover, or changed winner_id. It ignored an INSERT of a
--    finished match (draws insert round-one byes as completed 'W/O' rows), and
--    an UPDATE that changed the players, winner_side, score, labels or
--    category of a finished match. Those players were never recounted.
-- 2. The rule counted a win when winner_id was the player (or partner), and a
--    loss when winner_id was on the other side. A side with no account (a
--    guest name or a BYE) has no player id, so winner_id is NULL when it wins:
--    12 matches lost to a guest never counted for the registered players in
--    them. 3 matches have a winner_id that is not one of their players.
-- 3. Byes are excluded only by score ILIKE '%BYE%', but draws record them as
--    'W/O' with the label 'BYE' on the empty side. A plain recount with the old
--    rule would add 110 wins from 81 byes (a doubles bye gives both partners a
--    win). The app (lib/matchView, drawReveal, bracketPredict) treats a side
--    labelled /\bbye\b/i as a bye, not a match.
--
-- Rehearsed on prod (rolled back): after this migration, 60 players' overall
-- W/L changes (37 gain wins, 29 gain losses, 2 lose a loss; at most 4 wins or
-- 2 losses for one player, nobody loses a win) and 154 players have at least
-- one stored value updated (overall, a category record, or the match count).
-- Every player's records then equal a separate calculation of the rule above.
--
-- Now a match counts for a player when:
--   status is completed or walkover, winner_side is 1 or 2 (0 is a double
--   walkover: no result), its tournament is not in the trash, and neither side
--   is a bye (label /\mbye\M/i, or 'BYE' in the score).
-- The player won if their side (1: player1/player3, 2: player2/player4) is
-- winner_side, and lost otherwise. winner_side is what the app shows as the
-- winner. Walkovers against a real opponent still count, as since
-- 20260914000001. The singles/doubles/mixed split by category is unchanged.
--
-- The trigger now recounts, for INSERT, DELETE and UPDATE, the players before
-- and after the change, whenever the row is or was finished and a counted
-- field changed. The recount functions update a player only when a value
-- changes.
--
-- The functions keep their names, arguments and grants, so old clients are
-- unaffected. The new helper counted_match_results() is not callable through
-- the API.
--
-- Last, every player is recounted once.
--
-- Rollback: supabase/rollbacks/20261119150000_recount_win_loss_records.rollback.sql
-- (restores the previous function text; recounting with the old rule would
-- count byes as wins again).

CREATE OR REPLACE FUNCTION public.counted_match_results(player_uuid uuid)
 RETURNS TABLE (category text, won boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT m.category::text,
         (CASE WHEN player_uuid IN (m.player1_id, m.player3_id) THEN 1 ELSE 2 END) = m.winner_side
    FROM public.tournament_matches m
    JOIN public.tournaments t ON t.id = m.tournament_id
   WHERE player_uuid IN (m.player1_id, m.player2_id, m.player3_id, m.player4_id)
     AND m.status IN ('completed', 'walkover')
     AND m.winner_side IN (1, 2)
     AND t.status <> 'deleted'
     AND coalesce(m.score, '') NOT ILIKE '%BYE%'
     AND coalesce(m.team1_label, '') !~* '\mbye\M'
     AND coalesce(m.team2_label, '') !~* '\mbye\M';
$function$;

REVOKE ALL ON FUNCTION public.counted_match_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.counted_match_results(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recalculate_player_all_records(player_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_wins   int;
  v_losses int;
BEGIN
  SELECT count(*) FILTER (WHERE won), count(*) FILTER (WHERE NOT won)
    INTO v_wins, v_losses
    FROM public.counted_match_results(player_uuid);

  UPDATE public.players
     SET win_loss_record = v_wins || 'W - ' || v_losses || 'L',
         total_friendly_matches = v_wins + v_losses
   WHERE id = player_uuid
     AND (win_loss_record, total_friendly_matches)
         IS DISTINCT FROM (v_wins || 'W - ' || v_losses || 'L', v_wins + v_losses);

  PERFORM public.recalculate_category_records(player_uuid);
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_category_records(player_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_singles text;
  v_doubles text;
  v_mixed   text;
BEGIN
  SELECT count(*) FILTER (WHERE won AND s) || 'W - ' || count(*) FILTER (WHERE NOT won AND s) || 'L',
         count(*) FILTER (WHERE won AND d) || 'W - ' || count(*) FILTER (WHERE NOT won AND d) || 'L',
         count(*) FILTER (WHERE won AND x) || 'W - ' || count(*) FILTER (WHERE NOT won AND x) || 'L'
    INTO v_singles, v_doubles, v_mixed
    FROM (
      SELECT r.won,
             (r.category ILIKE '%MS%' OR r.category ILIKE '%WS%' OR r.category ILIKE '%Singles%') AS s,
             ((r.category ILIKE '%MD%' OR r.category ILIKE '%WD%' OR r.category ILIKE '%Doubles%')
               AND r.category NOT ILIKE '%XD%' AND r.category NOT ILIKE '%Mixed%') AS d,
             (r.category ILIKE '%XD%' OR r.category ILIKE '%Mixed%') AS x
        FROM public.counted_match_results(player_uuid) r
    ) c;

  UPDATE public.players
     SET singles_record = v_singles,
         doubles_record = v_doubles,
         mixed_record   = v_mixed
   WHERE id = player_uuid
     AND (singles_record, doubles_record, mixed_record) IS DISTINCT FROM (v_singles, v_doubles, v_mixed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_update_win_loss_records()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_player uuid;
BEGIN
  -- Only a row that is, or was, finished can change a record.
  IF NOT ((TG_OP <> 'DELETE' AND NEW.status IN ('completed', 'walkover'))
       OR (TG_OP <> 'INSERT' AND OLD.status IN ('completed', 'walkover'))) THEN
    RETURN NULL;
  END IF;

  -- An update that leaves every counted field alone changes nothing.
  IF TG_OP = 'UPDATE'
     AND (NEW.status, NEW.winner_side, NEW.player1_id, NEW.player2_id, NEW.player3_id, NEW.player4_id,
          NEW.score, NEW.category, NEW.team1_label, NEW.team2_label, NEW.tournament_id)
         IS NOT DISTINCT FROM
         (OLD.status, OLD.winner_side, OLD.player1_id, OLD.player2_id, OLD.player3_id, OLD.player4_id,
          OLD.score, OLD.category, OLD.team1_label, OLD.team2_label, OLD.tournament_id) THEN
    RETURN NULL;
  END IF;

  -- Recount everyone on the row before and after the change.
  FOR v_player IN
    SELECT DISTINCT p.id
      FROM unnest(
             CASE WHEN TG_OP <> 'DELETE'
                  THEN ARRAY[NEW.player1_id, NEW.player2_id, NEW.player3_id, NEW.player4_id]
                  ELSE ARRAY[]::uuid[] END
          || CASE WHEN TG_OP <> 'INSERT'
                  THEN ARRAY[OLD.player1_id, OLD.player2_id, OLD.player3_id, OLD.player4_id]
                  ELSE ARRAY[]::uuid[] END) AS p(id)
     WHERE p.id IS NOT NULL
  LOOP
    PERFORM public.recalculate_player_all_records(v_player);
  END LOOP;

  RETURN NULL;
END;
$function$;

-- Recount everyone once.
SELECT count(public.recalculate_player_all_records(id)) AS players_recounted FROM public.players;
