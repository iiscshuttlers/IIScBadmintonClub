-- Rollback for 20261120120300_broadcast_tournament_status_changes.sql
-- Removes the trigger and its function. Clients keep their subscription but
-- receive nothing, so open lists again refresh only on reload or their own
-- polling (Pulse every 60 s).
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261120120300 --remote --yes
BEGIN;

DROP TRIGGER IF EXISTS trg_broadcast_tournament_status_change ON public.tournaments;
DROP FUNCTION IF EXISTS public.broadcast_tournament_status_change();

COMMIT;
