-- A team tournament's players can read its matches (the tie rubbers) while it is a draft.
--
-- A tournament stays 'draft' until start_play, and ties get their rubbers and
-- lineups before that. Since 20261120110000 a draft's team players (an ACTIVE
-- or INVITED roster row, or captain of one of its teams) can open the
-- tournament, its teams and its ties, but not its matches: tm_public_read
-- hides drafts, and tm_admin_read / tm_official_read don't cover them. So
-- the team hub's rubbers (getMatchesByTieId, getTieMatchesWithPlayers) and
-- the lineup builder came back empty for them until play started.
--
-- tm_team_player_read lets them read the matches of tournaments they play in.
-- tm_hide_trashed (RESTRICTIVE) still hides a trashed tournament's matches.
-- The tournaments they play in come from my_team_tournament_ids(), evaluated
-- once per statement, so reading every match costs one lookup instead of a
-- function call per row. Writes are unchanged.
--
-- Rollback: supabase/rollbacks/20261120110600_team_players_read_draft_matches.rollback.sql

CREATE OR REPLACE FUNCTION public.my_team_tournament_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT x.tournament_id), ARRAY[]::uuid[])
    FROM (
      SELECT m.tournament_id FROM public.tournament_team_members m
       WHERE m.player_id = auth.uid() AND m.status IN ('ACTIVE', 'INVITED')
      UNION ALL
      SELECT t.tournament_id FROM public.tournament_teams t
       WHERE t.captain_id = auth.uid()
    ) x
   WHERE auth.uid() IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.my_team_tournament_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_team_tournament_ids() TO authenticated, service_role;

DROP POLICY IF EXISTS "tm_team_player_read" ON public.tournament_matches;
CREATE POLICY "tm_team_player_read" ON public.tournament_matches
  FOR SELECT TO authenticated
  USING (tournament_id = ANY (COALESCE((SELECT public.my_team_tournament_ids()), ARRAY[]::uuid[])));
