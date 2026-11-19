-- Tell open clients when a public tournament changes status, so lists drop a
-- trashed tournament (and pick up a newly started one) without a reload.
--
-- RealtimeProvider listened for postgres_changes on public.tournaments, but
-- the table is not in the supabase_realtime publication, so that listener
-- never fired for anyone. Adding the table would not help either: once a
-- tournament is trashed (or still a draft) it fails RLS for members and
-- signed-out visitors, so Realtime would not deliver its change to them.
-- Their hub, Pulse and home lists kept showing a trashed tournament until a
-- reload, and opening it gave "not found".
--
-- An AFTER UPDATE OF status trigger now sends a public Realtime broadcast
-- (topic 'tournament-visibility', event 'status_changed') whenever the old or
-- the new status is publicly visible (not draft / deleted): start of play,
-- completion, archiving, trashing a public tournament. The payload is the
-- tournament id only. Changes between two hidden states (draft <-> trash)
-- send nothing, so the broadcast never reveals a tournament that was never
-- public. Clients invalidate their tournament queries and refetch under
-- their own RLS.
--
-- The send is wrapped so that a Realtime failure only logs a warning and
-- never blocks the status change.
--
-- Rollback: supabase/rollbacks/20261120120300_broadcast_tournament_status_changes.rollback.sql

CREATE OR REPLACE FUNCTION public.broadcast_tournament_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND (OLD.status <> ALL (ARRAY['draft'::text, 'deleted'::text])
          OR NEW.status <> ALL (ARRAY['draft'::text, 'deleted'::text])) THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('id', NEW.id),
        'status_changed',
        'tournament-visibility',
        false
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'broadcast_tournament_status_change(%): %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.broadcast_tournament_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_broadcast_tournament_status_change ON public.tournaments;
CREATE TRIGGER trg_broadcast_tournament_status_change
  AFTER UPDATE OF status ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_tournament_status_change();
