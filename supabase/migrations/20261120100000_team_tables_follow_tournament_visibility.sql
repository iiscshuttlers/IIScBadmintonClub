-- Team tournaments: teams, ties, rosters, lineups and lineup audits follow
-- the tournament's visibility, like its matches and entries.
--
-- Before this migration these SELECT policies ignored the tournament:
--   tournament_teams         "Public can view teams"            USING (true)
--   tournament_ties          "Public can view ties"             USING (true)
--   tournament_team_members  "Public can view active members"   USING (status = 'ACTIVE')
--   tie_lineups              "Public can view revealed lineups" USING (is_revealed = true)
--   tie_lineup_audits        "Public can view lineup audits"    USING (true)
-- So anyone, signed in or not, could read the teams, ties, rosters, revealed
-- lineups and lineup changes of a draft or a trashed tournament. The
-- tournament itself, its matches and its entries are hidden from them
-- (tournaments_public_read, tm_public_read, tp_public_read, tm_hide_trashed).
-- tournament_team_standings is a security_invoker view over these tables, so
-- it leaked the same rows and is fixed by the same policies.
--
-- Now:
-- * Teams and ties are public when the tournament is neither a draft nor in
--   the trash, as with tm_public_read / tp_public_read.
-- * In a draft they are also readable by:
--     - admins and global umpires (is_admin_or_umpire, as tm_admin_read),
--     - the host and assigned officials (is_tournament_official, as
--       tm_official_read / tp_official_read),
--     - the tournament's own team players: anyone with an ACTIVE or INVITED
--       roster row in it, or who captains one of its teams. They see all of
--       its teams and ties, so a draw shows both sides, and an invited player
--       can open the team that invited them.
-- * Active roster rows, revealed lineups and lineup audits are readable by
--   whoever can read their team or tie (an EXISTS on that table, which applies
--   its policies).
-- * A trashed tournament's teams, ties, roster rows and lineups are hidden from
--   every signed-in user, admins included, like its matches (tm_hide_trashed).
--   Restoring the tournament brings them back. This also keeps "my team" and
--   pending-lineup lookups (by player, across tournaments) out of the trash.
--
-- Unchanged: every INSERT/UPDATE/DELETE policy; the other SELECT policies
-- (own roster row, team staff, managers, umpires; staff see their own
-- unrevealed lineups); lineup_deadline_alerts and tie_lineup_watchers; and the
-- SECURITY DEFINER RPCs (create_team, join_team_by_token,
-- get_team_by_invite_token, lock_tie_lineup, reveal_tie_lineup, ...).
-- Column grants are unchanged too: tournament_teams.invite_token is still
-- readable by whoever can read the team. Hiding it needs the client to stop
-- selecting "*" first.
--
-- On 2026-11-20 all five tables were empty on production, so nobody sees a
-- change today.
--
-- Rollback: supabase/rollbacks/20261120100000_team_tables_follow_tournament_visibility.rollback.sql

-- Is the signed-in user a player of a team in this tournament?
CREATE OR REPLACE FUNCTION public.is_tournament_team_player(p_tournament_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.tournament_team_members m
             WHERE m.tournament_id = p_tournament_id
               AND m.player_id = auth.uid()
               AND m.status IN ('ACTIVE', 'INVITED'))
    OR EXISTS (SELECT 1 FROM public.tournament_teams t
                WHERE t.tournament_id = p_tournament_id
                  AND t.captain_id = auth.uid()));
$function$;

REVOKE ALL ON FUNCTION public.is_tournament_team_player(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tournament_team_player(uuid) TO authenticated, service_role;

-- ---------- tournament_teams ----------
DROP POLICY IF EXISTS "Public can view teams" ON public.tournament_teams;
DROP POLICY IF EXISTS "teams_public_read" ON public.tournament_teams;
CREATE POLICY "teams_public_read" ON public.tournament_teams
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.tournaments t
                  WHERE t.id = tournament_teams.tournament_id
                    AND t.status <> ALL (ARRAY['draft', 'deleted'])));

DROP POLICY IF EXISTS "teams_staff_read" ON public.tournament_teams;
CREATE POLICY "teams_staff_read" ON public.tournament_teams
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_umpire())
         OR public.is_tournament_official(tournament_id)
         OR public.is_tournament_team_player(tournament_id));

DROP POLICY IF EXISTS "teams_hide_trashed" ON public.tournament_teams;
CREATE POLICY "teams_hide_trashed" ON public.tournament_teams
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tournament_id <> ALL (COALESCE((SELECT public.trashed_tournament_ids()), ARRAY[]::uuid[])));

-- ---------- tournament_ties ----------
DROP POLICY IF EXISTS "Public can view ties" ON public.tournament_ties;
DROP POLICY IF EXISTS "ties_public_read" ON public.tournament_ties;
CREATE POLICY "ties_public_read" ON public.tournament_ties
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.tournaments t
                  WHERE t.id = tournament_ties.tournament_id
                    AND t.status <> ALL (ARRAY['draft', 'deleted'])));

DROP POLICY IF EXISTS "ties_staff_read" ON public.tournament_ties;
CREATE POLICY "ties_staff_read" ON public.tournament_ties
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_umpire())
         OR public.is_tournament_official(tournament_id)
         OR public.is_tournament_team_player(tournament_id));

DROP POLICY IF EXISTS "ties_hide_trashed" ON public.tournament_ties;
CREATE POLICY "ties_hide_trashed" ON public.tournament_ties
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tournament_id <> ALL (COALESCE((SELECT public.trashed_tournament_ids()), ARRAY[]::uuid[])));

-- ---------- tournament_team_members ----------
DROP POLICY IF EXISTS "Public can view active members" ON public.tournament_team_members;
DROP POLICY IF EXISTS "ttm_public_read" ON public.tournament_team_members;
CREATE POLICY "ttm_public_read" ON public.tournament_team_members
  FOR SELECT TO public
  USING (status = 'ACTIVE'
         AND EXISTS (SELECT 1 FROM public.tournament_teams tt WHERE tt.id = tournament_team_members.team_id));

DROP POLICY IF EXISTS "ttm_hide_trashed" ON public.tournament_team_members;
CREATE POLICY "ttm_hide_trashed" ON public.tournament_team_members
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tournament_id <> ALL (COALESCE((SELECT public.trashed_tournament_ids()), ARRAY[]::uuid[])));

-- ---------- tie_lineups ----------
DROP POLICY IF EXISTS "Public can view revealed lineups" ON public.tie_lineups;
DROP POLICY IF EXISTS "tl_revealed_read" ON public.tie_lineups;
CREATE POLICY "tl_revealed_read" ON public.tie_lineups
  FOR SELECT TO public
  USING (is_revealed = true
         AND EXISTS (SELECT 1 FROM public.tournament_ties t WHERE t.id = tie_lineups.tie_id));

-- Every signed-in reader (team staff, managers, umpires) can read the tie of a
-- lineup they may see, except in the trash, where the tie is hidden.
DROP POLICY IF EXISTS "tl_hide_trashed" ON public.tie_lineups;
CREATE POLICY "tl_hide_trashed" ON public.tie_lineups
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tournament_ties t WHERE t.id = tie_lineups.tie_id));

-- ---------- tie_lineup_audits ----------
DROP POLICY IF EXISTS "Public can view lineup audits" ON public.tie_lineup_audits;
DROP POLICY IF EXISTS "tla_read" ON public.tie_lineup_audits;
CREATE POLICY "tla_read" ON public.tie_lineup_audits
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.tournament_ties t WHERE t.id = tie_lineup_audits.tie_id));
