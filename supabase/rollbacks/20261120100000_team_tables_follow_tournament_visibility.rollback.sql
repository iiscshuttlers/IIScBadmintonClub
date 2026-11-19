-- Rollback for 20261120100000_team_tables_follow_tournament_visibility.sql
-- Restores the five SELECT policies exactly as they were (pg_policies on
-- 2026-11-20), drops the new policies and the helper. Writes and data are
-- untouched by both the migration and this rollback.

DROP POLICY IF EXISTS "teams_public_read" ON public.tournament_teams;
DROP POLICY IF EXISTS "teams_staff_read" ON public.tournament_teams;
DROP POLICY IF EXISTS "teams_hide_trashed" ON public.tournament_teams;
DROP POLICY IF EXISTS "Public can view teams" ON public.tournament_teams;
CREATE POLICY "Public can view teams" ON public.tournament_teams
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "ties_public_read" ON public.tournament_ties;
DROP POLICY IF EXISTS "ties_staff_read" ON public.tournament_ties;
DROP POLICY IF EXISTS "ties_hide_trashed" ON public.tournament_ties;
DROP POLICY IF EXISTS "Public can view ties" ON public.tournament_ties;
CREATE POLICY "Public can view ties" ON public.tournament_ties
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "ttm_public_read" ON public.tournament_team_members;
DROP POLICY IF EXISTS "ttm_hide_trashed" ON public.tournament_team_members;
DROP POLICY IF EXISTS "Public can view active members" ON public.tournament_team_members;
CREATE POLICY "Public can view active members" ON public.tournament_team_members
  FOR SELECT TO public USING (status = 'ACTIVE'::text);

DROP POLICY IF EXISTS "tl_revealed_read" ON public.tie_lineups;
DROP POLICY IF EXISTS "tl_hide_trashed" ON public.tie_lineups;
DROP POLICY IF EXISTS "Public can view revealed lineups" ON public.tie_lineups;
CREATE POLICY "Public can view revealed lineups" ON public.tie_lineups
  FOR SELECT TO public USING (is_revealed = true);

DROP POLICY IF EXISTS "tla_read" ON public.tie_lineup_audits;
DROP POLICY IF EXISTS "Public can view lineup audits" ON public.tie_lineup_audits;
CREATE POLICY "Public can view lineup audits" ON public.tie_lineup_audits
  FOR SELECT TO public USING (true);

DROP FUNCTION IF EXISTS public.is_tournament_team_player(uuid);
