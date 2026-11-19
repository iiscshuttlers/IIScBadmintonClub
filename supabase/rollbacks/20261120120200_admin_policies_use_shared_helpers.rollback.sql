-- Rollback for 20261120120200_admin_policies_use_shared_helpers.sql
-- Restores the 21 policies exactly as pg_policies showed them on
-- 2026-11-20 (roles looked up inline by players.id = auth.uid()). The
-- e-mail-matched admin, the master admin's second login and the three
-- e-mail-matched umpire logins lose these rights again.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261120120200 --remote --yes
BEGIN;

ALTER POLICY "Admins and Umpires can insert courts" ON public.club_courts
  WITH CHECK (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text, 'umpire'::text])));

ALTER POLICY "Admins and Umpires can update courts" ON public.club_courts
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text, 'umpire'::text])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text, 'umpire'::text])));

ALTER POLICY "Allow admin deletes from elo_calculation_logs" ON public.elo_calculation_logs
  USING ((EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])))
    OR (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text));

ALTER POLICY "Admins can delete all posts" ON public.find_lost_posts
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "Admins can update all posts" ON public.find_lost_posts
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "Admins can view all queued notifications" ON public.notification_queue
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "player_claim_requests_read" ON public.player_claim_requests
  USING ((requester_id = auth.uid()) OR (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text]))));

ALTER POLICY "Admins can delete any player" ON public.players
  USING (EXISTS (SELECT 1 FROM public.players players_1
    WHERE players_1.id = auth.uid() AND players_1.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "Admins can update any player" ON public.players
  USING (EXISTS (SELECT 1 FROM public.players players_1
    WHERE players_1.id = auth.uid() AND players_1.role = ANY (ARRAY['admin'::text, 'master_admin'::text])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players players_1
    WHERE players_1.id = auth.uid() AND players_1.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "admins_manage_recycle_bin" ON public.recycle_bin
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['master_admin'::text, 'admin'::text])));

ALTER POLICY "Admins can manage site_data strictly" ON public.site_data
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "Admins can update all feedback" ON public.user_feedback
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "Admins can view all feedback" ON public.user_feedback
  USING (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "admins read analytics" ON public.analytics_events
  USING (EXISTS (SELECT 1 FROM public.players p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "Umpires can write live score keys" ON public.site_data
  USING ((key = ANY (ARRAY['live_matches'::text, 'match_alert'::text])) AND (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = 'umpire'::text)))
  WITH CHECK ((key = ANY (ARRAY['live_matches'::text, 'match_alert'::text])) AND (EXISTS (SELECT 1 FROM public.players
    WHERE players.id = auth.uid() AND players.role = 'umpire'::text)));

ALTER POLICY "Umpires and admins can insert lineup audits" ON public.tie_lineup_audits
  WITH CHECK (public.is_admin_or_master() OR (EXISTS (SELECT 1 FROM public.players p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['umpire'::text, 'admin'::text, 'master_admin'::text]))));

ALTER POLICY "Managers and staff can insert tie_lineups" ON public.tie_lineups
  WITH CHECK (public.is_admin_or_master()
    OR public.is_tournament_manager((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR public.is_tournament_official((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR (EXISTS (SELECT 1 FROM public.players p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['umpire'::text, 'admin'::text, 'master_admin'::text])))
    OR ((side = 'A'::text) AND public.is_team_staff((SELECT tournament_ties.team_a_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id)))
    OR ((side = 'B'::text) AND public.is_team_staff((SELECT tournament_ties.team_b_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))));

ALTER POLICY "Managers and staff can update tie_lineups" ON public.tie_lineups
  USING (public.is_admin_or_master()
    OR public.is_tournament_manager((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR public.is_tournament_official((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR (EXISTS (SELECT 1 FROM public.players p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['umpire'::text, 'admin'::text, 'master_admin'::text])))
    OR ((side = 'A'::text) AND public.is_team_staff((SELECT tournament_ties.team_a_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id)))
    OR ((side = 'B'::text) AND public.is_team_staff((SELECT tournament_ties.team_b_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))));

ALTER POLICY "Managers and umpires can view all lineups" ON public.tie_lineups
  USING (public.is_admin_or_master()
    OR public.is_tournament_manager((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR (EXISTS (SELECT 1 FROM public.players p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['umpire'::text, 'admin'::text, 'master_admin'::text]))));

ALTER POLICY "admin update reports" ON public.user_reports
  USING (EXISTS (SELECT 1 FROM public.players p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'master_admin'::text])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "read own reports or admin" ON public.user_reports
  USING ((auth.uid() = reporter_id) OR (EXISTS (SELECT 1 FROM public.players p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'master_admin'::text]))));

COMMIT;
