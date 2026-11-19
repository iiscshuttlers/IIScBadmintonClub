-- Moving a tournament to the trash also cancels its tournament-wide notifications.
--
-- Since 20261119140000, handle_deleted_tournament() cancels a trashed
-- tournament's pending match alerts (scheduled_notifications.match_id). Pending
-- notifications tied to the tournament itself (tournament_id set, match_id
-- NULL: announcements, schedule messages, reminders) were still sent by
-- dispatch-scheduled-notifications to players who can no longer open the
-- tournament. They are now cancelled too, with the same error text.
-- Restoring the tournament does not revive cancelled notifications (as for
-- match alerts).
--
-- Rollback: supabase/rollbacks/20261120110200_trash_cancels_tournament_notifications.rollback.sql

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
    -- Notifications not yet sent (match alerts and tournament-wide messages)
    -- would reach players about a tournament they can no longer open.
    UPDATE public.scheduled_notifications
       SET status = 'cancelled', error = 'Tournament moved to trash'
     WHERE status = 'pending'
       AND (tournament_id = NEW.id
            OR match_id IN (SELECT id FROM public.tournament_matches WHERE tournament_id = NEW.id));
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
