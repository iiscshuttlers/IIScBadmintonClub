-- Evaluate the per-viewer checks in the tournament read policies once per
-- statement instead of once per row.
--
-- Since player_matches_unified became security_invoker (20261118160000),
-- every match row a signed-in viewer reads also evaluates the
-- tournament_matches policies and, through tm_public_read's EXISTS and the
-- view's join, the tournaments policies. Several of those called a
-- SECURITY DEFINER function per row (never inlined, several lookups each):
--   tournaments_team_player_read   is_tournament_team_player(id)
--   tm_admin_read, tm_admin_write  is_admin_or_umpire()
--   tournaments_official_read,     is_tournament_official(<tournament id>)
--   tm/tp/trr_official_read
-- Measured on production on 2026-11-20 as the member with the most matches
-- (rolled-back transaction, 30 runs): own profile query 2.7 ms and the whole
-- view 18 ms, against 0.5 ms / 0.4 ms for the view without RLS. Most of it
-- was tournaments_team_player_read, which runs for every tournament row any
-- signed-in read touches.
--
-- Each check now compares against a value computed once per statement (the
-- same initplan pattern tm_hide_trashed uses):
--   my_official_tournament_ids()  tournaments the caller created or is
--                                 assigned to (any tournament_officials role)
--   my_team_tournament_ids()      tournaments where the caller has an
--                                 ACTIVE / INVITED roster row or captains a team
--   (SELECT is_admin_or_umpire()) no row dependency, so wrapping is enough
--
-- Who can read what does not change:
--   * is_tournament_team_player(t) = the caller's id is in
--     my_team_tournament_ids(); the policy keeps its status <> 'deleted'.
--   * is_tournament_official(t) was also true for admins. Each table already
--     has an admin policy that covers them on its own: tournaments_admin_write
--     (ALL, is_admin_or_master), tm_admin_read (is_admin_or_umpire),
--     tp_admin_all and trr_admin_all (is_admin_or_master).
-- Other callers of these helpers (registrations, feedback, audit events,
-- team tables) are not on this hot path and are left as they are.
--
-- Rollback: supabase/rollbacks/20261120120000_tournament_read_policies_once_per_statement.rollback.sql

CREATE OR REPLACE FUNCTION public.my_official_tournament_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT x.id), ARRAY[]::uuid[])
    FROM (
      SELECT t.id FROM public.tournaments t WHERE t.created_by = auth.uid()
      UNION ALL
      SELECT o.tournament_id FROM public.tournament_officials o WHERE o.user_id = auth.uid()
    ) x;
$function$;

CREATE OR REPLACE FUNCTION public.my_team_tournament_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT x.id), ARRAY[]::uuid[])
    FROM (
      SELECT m.tournament_id AS id FROM public.tournament_team_members m
       WHERE m.player_id = auth.uid() AND m.status IN ('ACTIVE', 'INVITED')
      UNION ALL
      SELECT t.tournament_id FROM public.tournament_teams t WHERE t.captain_id = auth.uid()
    ) x;
$function$;

REVOKE ALL ON FUNCTION public.my_official_tournament_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_team_tournament_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_official_tournament_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_team_tournament_ids() TO authenticated, service_role;

ALTER POLICY "tournaments_team_player_read" ON public.tournaments
  USING ((status <> 'deleted'::text)
         AND id = ANY (COALESCE((SELECT public.my_team_tournament_ids()), ARRAY[]::uuid[])));

ALTER POLICY "tournaments_official_read" ON public.tournaments
  USING (id = ANY (COALESCE((SELECT public.my_official_tournament_ids()), ARRAY[]::uuid[])));

ALTER POLICY "tm_admin_read" ON public.tournament_matches
  USING ((SELECT public.is_admin_or_umpire()));

ALTER POLICY "tm_admin_write" ON public.tournament_matches
  USING ((SELECT public.is_admin_or_umpire()))
  WITH CHECK ((SELECT public.is_admin_or_umpire()));

ALTER POLICY "tm_official_read" ON public.tournament_matches
  USING (tournament_id = ANY (COALESCE((SELECT public.my_official_tournament_ids()), ARRAY[]::uuid[])));

ALTER POLICY "tp_official_read" ON public.tournament_participants
  USING (tournament_id = ANY (COALESCE((SELECT public.my_official_tournament_ids()), ARRAY[]::uuid[])));

ALTER POLICY "trr_official_read" ON public.tournament_round_rules
  USING (tournament_id = ANY (COALESCE((SELECT public.my_official_tournament_ids()), ARRAY[]::uuid[])));
