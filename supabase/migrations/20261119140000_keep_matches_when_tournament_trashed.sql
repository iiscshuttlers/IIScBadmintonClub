-- Keep a tournament's matches when it is moved to the trash.
--
-- Since 2026-06-30 (20260630000001) the trigger trg_handle_deleted_tournament
-- deleted every tournament_matches row as soon as a tournament's status became
-- 'deleted'. The delete cascaded to point logs, umpire assignments, court calls,
-- match reminders and match subscriptions. That migration gave no reason; it
-- shipped with recalculate_tournament_elo() ("useful if tournament matches are
-- deleted or a tournament is trashed"), and at the time nothing else stopped a
-- trashed tournament's matches from showing up in lists and stats.
--
-- The Tournament Manager promises the opposite: "Move to trash?" says "You can
-- restore it from Trash" (even for a live tournament), and Trash offers
-- "Restore to draft". Restoring brought back the tournament, its entries and
-- settings, but no draw, results or point logs. "Delete forever" is a plain
-- DELETE on tournaments; the tournament_matches FK is ON DELETE CASCADE, so
-- matches still go then.
--
-- What already ignores trashed tournaments (unchanged here):
--   * recalculate_tournament_elo() replays only t.status <> 'deleted'.
--   * Signed-out users and members: tournaments_public_read hides 'deleted',
--     and tm_public_read / point_logs_read_when_match_visible follow it.
--
-- What would have counted a trashed tournament's matches if they were kept,
-- and is fixed here:
--   1. Admins and global umpires read every match through tm_admin_read
--      (is_admin_or_umpire()). About 30 cross-tournament client reads (player
--      profiles, leaderboards, H2H, form, umpire queues) do not filter on the
--      tournament's status. A new RESTRICTIVE policy hides a trashed
--      tournament's matches from every signed-in user, admins included, and
--      with them its point logs. tm_admin_write is a FOR ALL policy, so
--      admins also cannot edit or delete those matches through the API
--      until the tournament is restored. Anon needs no extra policy: its only
--      path is tm_public_read, which already hides trashed tournaments.
--   2. players.win_loss_record / singles_record / doubles_record /
--      mixed_record (players directory, profile) were recounted by
--      trigger_update_win_loss_records when the matches were deleted.
--      recalculate_player_all_records() and recalculate_category_records()
--      now skip trashed tournaments, and the trash trigger recounts the
--      tournament's players when it goes into or out of the trash.
--   3. Pending match alerts (scheduled_notifications with a match_id) were
--      cascade-deleted. They are now cancelled on trash.
-- Service-role edge functions bypass RLS: send-match-reminders and
-- notify-up-next skip trashed tournaments and public-api skips trashed and
-- draft ones in the same change. Deploy them before applying this.
--
-- Behaviour that changes:
--   * Restore to draft brings the draw, results and point logs back.
--   * delete_guest_player still counts a trashed tournament's matches, so a
--     guest who only played in one can be deleted only after "Delete forever".
--   * Live Elo already earned in a trashed ranked tournament stays on players
--     until an admin runs "Recalculate ELO", as before.
--
-- Old clients: compatible. They never saw a trashed tournament's matches
-- (the rows did not exist), and still do not.
--
-- Rollback: supabase/rollbacks/20261119140000_keep_matches_when_tournament_trashed.rollback.sql

-- 1. Trashed tournament ids, for the RLS policy below. SECURITY DEFINER so
--    global umpires (who cannot read trashed tournaments) still get the list.
--    Called once per statement through (SELECT ...).
CREATE OR REPLACE FUNCTION public.trashed_tournament_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) FROM public.tournaments WHERE status = 'deleted';
$function$;

REVOKE ALL ON FUNCTION public.trashed_tournament_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trashed_tournament_ids() TO authenticated, service_role;

-- 2. Hide a trashed tournament's matches from every signed-in user.
DROP POLICY IF EXISTS "tm_hide_trashed" ON public.tournament_matches;
CREATE POLICY "tm_hide_trashed" ON public.tournament_matches
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tournament_id <> ALL (COALESCE((SELECT public.trashed_tournament_ids()), ARRAY[]::uuid[])));

-- 3. Win/loss records skip trashed tournaments. Bodies as on production on
--    2026-11-19, plus the tournament filter and a fixed search_path.
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
$function$;

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
$function$;

-- 4. Trash and restore keep the matches. Same trigger
--    (trg_handle_deleted_tournament, AFTER UPDATE OF status), new body.
CREATE OR REPLACE FUNCTION public.handle_deleted_tournament()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_player uuid;
BEGIN
  -- Act only when the tournament goes into or comes out of the trash.
  IF (NEW.status = 'deleted') IS NOT DISTINCT FROM (OLD.status = 'deleted') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'deleted' THEN
    -- Match alerts not yet sent would reach players about a tournament they
    -- can no longer open. (They used to be cascade-deleted with the matches.)
    UPDATE public.scheduled_notifications
       SET status = 'cancelled', error = 'Tournament moved to trash'
     WHERE status = 'pending'
       AND match_id IN (SELECT id FROM public.tournament_matches WHERE tournament_id = NEW.id);
  END IF;

  -- Stored win/loss records skip trashed tournaments: recount everyone with a
  -- result in this one, on trash and on restore.
  FOR v_player IN
    SELECT DISTINCT p.id
      FROM public.tournament_matches m
     CROSS JOIN LATERAL unnest(ARRAY[m.player1_id, m.player2_id, m.player3_id, m.player4_id]) AS p(id)
     WHERE m.tournament_id = NEW.id
       AND m.status IN ('completed', 'walkover')
       AND p.id IS NOT NULL
  LOOP
    PERFORM public.recalculate_player_all_records(v_player);
  END LOOP;

  RETURN NEW;
END;
$function$;
