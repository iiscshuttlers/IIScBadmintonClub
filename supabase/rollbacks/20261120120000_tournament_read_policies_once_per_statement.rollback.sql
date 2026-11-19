-- Rollback for 20261120120000_tournament_read_policies_once_per_statement.sql
-- Restores the seven policies exactly as pg_policies showed them on
-- 2026-11-20 (per-row helper calls) and drops the two new helpers.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261120120000 --remote --yes
BEGIN;

ALTER POLICY "tournaments_team_player_read" ON public.tournaments
  USING ((status <> 'deleted'::text) AND public.is_tournament_team_player(id));

ALTER POLICY "tournaments_official_read" ON public.tournaments
  USING (public.is_tournament_official(id));

ALTER POLICY "tm_admin_read" ON public.tournament_matches
  USING (public.is_admin_or_umpire());

ALTER POLICY "tm_admin_write" ON public.tournament_matches
  USING (public.is_admin_or_umpire())
  WITH CHECK (public.is_admin_or_umpire());

ALTER POLICY "tm_official_read" ON public.tournament_matches
  USING (public.is_tournament_official(tournament_id));

ALTER POLICY "tp_official_read" ON public.tournament_participants
  USING (public.is_tournament_official(tournament_id));

ALTER POLICY "trr_official_read" ON public.tournament_round_rules
  USING (public.is_tournament_official(tournament_id));

DROP FUNCTION IF EXISTS public.my_official_tournament_ids();
DROP FUNCTION IF EXISTS public.my_team_tournament_ids();

COMMIT;
