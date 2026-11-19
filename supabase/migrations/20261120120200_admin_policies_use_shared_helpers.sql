-- Use the shared role helpers in the last 21 policies that still looked up
-- the caller's role inline with players.id = auth.uid().
--
-- 20261118160200 and 20261119093000 moved the tournament tables to
-- is_admin_or_master(), because one admin's players.id differs from their
-- auth uid and the master admin has a second login (both matched by e-mail,
-- as the client's AuthContext does). These 21 policies kept an inline
-- EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role ...), so
-- those logins were shown admin (or umpire) screens but had their writes
-- silently refused: analytics, courts, Elo logs, lost & found, the
-- notification queue, claim requests, player edits and deletes, the recycle
-- bin, site_data (including umpires' live-score keys), feedback, user
-- reports, and team lineups and their audit log. That is the third time the
-- same split surfaced. With this change every role check in a policy goes
-- through is_admin_or_master() or is_admin_or_umpire(), so the identity rule
-- lives in those two functions only. supabase/tests/
-- tournament_visibility_assertions.sql fails if an inline role lookup on
-- players comes back.
--
-- Each policy keeps its command, roles and every non-role condition; only
-- the inline EXISTS on players is replaced, wrapped in (SELECT ...) so it
-- runs once per statement. Where a policy already said
-- "is_admin_or_master() OR <inline admin/umpire lookup>", both become one
-- is_admin_or_umpire(), which is true for exactly the union of the two.
--
-- Effect, counted on production on 2026-11-20: admin checks recognise 3
-- logins instead of 1 (the e-mail-matched admin and the master admin's
-- second login), admin-or-umpire checks 13 instead of 8 (those two plus
-- three umpire logins matched by e-mail). All of them already get these
-- screens in the client. No login loses access. protect_player_sensitive_
-- columns still decides who may change a player's role, guest, approval or
-- deleted flags.
--
-- Rollback: supabase/rollbacks/20261120120200_admin_policies_use_shared_helpers.rollback.sql

ALTER POLICY "admins read analytics" ON public.analytics_events
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "Admins and Umpires can insert courts" ON public.club_courts
  WITH CHECK ((SELECT public.is_admin_or_umpire()));

ALTER POLICY "Admins and Umpires can update courts" ON public.club_courts
  USING ((SELECT public.is_admin_or_umpire()))
  WITH CHECK ((SELECT public.is_admin_or_umpire()));

-- is_admin_or_master() is also true for the service role, which the old
-- expression allowed explicitly.
ALTER POLICY "Allow admin deletes from elo_calculation_logs" ON public.elo_calculation_logs
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "Admins can delete all posts" ON public.find_lost_posts
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "Admins can update all posts" ON public.find_lost_posts
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "Admins can view all queued notifications" ON public.notification_queue
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "player_claim_requests_read" ON public.player_claim_requests
  USING ((requester_id = auth.uid()) OR (SELECT public.is_admin_or_master()));

ALTER POLICY "Admins can delete any player" ON public.players
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "Admins can update any player" ON public.players
  USING ((SELECT public.is_admin_or_master()))
  WITH CHECK ((SELECT public.is_admin_or_master()));

ALTER POLICY "admins_manage_recycle_bin" ON public.recycle_bin
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "Admins can manage site_data strictly" ON public.site_data
  USING ((SELECT public.is_admin_or_master()))
  WITH CHECK ((SELECT public.is_admin_or_master()));

-- Was umpires only; admins already write every key through the policy above.
ALTER POLICY "Umpires can write live score keys" ON public.site_data
  USING ((key = ANY (ARRAY['live_matches'::text, 'match_alert'::text])) AND (SELECT public.is_admin_or_umpire()))
  WITH CHECK ((key = ANY (ARRAY['live_matches'::text, 'match_alert'::text])) AND (SELECT public.is_admin_or_umpire()));

ALTER POLICY "Umpires and admins can insert lineup audits" ON public.tie_lineup_audits
  WITH CHECK ((SELECT public.is_admin_or_umpire()));

ALTER POLICY "Managers and staff can insert tie_lineups" ON public.tie_lineups
  WITH CHECK (
    (SELECT public.is_admin_or_umpire())
    OR public.is_tournament_manager((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR public.is_tournament_official((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR ((side = 'A'::text) AND public.is_team_staff((SELECT tournament_ties.team_a_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id)))
    OR ((side = 'B'::text) AND public.is_team_staff((SELECT tournament_ties.team_b_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))));

ALTER POLICY "Managers and staff can update tie_lineups" ON public.tie_lineups
  USING (
    (SELECT public.is_admin_or_umpire())
    OR public.is_tournament_manager((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR public.is_tournament_official((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))
    OR ((side = 'A'::text) AND public.is_team_staff((SELECT tournament_ties.team_a_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id)))
    OR ((side = 'B'::text) AND public.is_team_staff((SELECT tournament_ties.team_b_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id))));

ALTER POLICY "Managers and umpires can view all lineups" ON public.tie_lineups
  USING (
    (SELECT public.is_admin_or_umpire())
    OR public.is_tournament_manager((SELECT tournament_ties.tournament_id FROM public.tournament_ties WHERE tournament_ties.id = tie_lineups.tie_id)));

ALTER POLICY "Admins can update all feedback" ON public.user_feedback
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "Admins can view all feedback" ON public.user_feedback
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "admin update reports" ON public.user_reports
  USING ((SELECT public.is_admin_or_master()))
  WITH CHECK ((SELECT public.is_admin_or_master()));

ALTER POLICY "read own reports or admin" ON public.user_reports
  USING ((auth.uid() = reporter_id) OR (SELECT public.is_admin_or_master()));
