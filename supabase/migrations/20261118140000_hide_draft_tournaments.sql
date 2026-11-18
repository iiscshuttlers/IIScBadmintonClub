-- Hide draft tournaments from everyone except the people running them.
--
-- Production had four permissive SELECT policies on public.tournaments. One
-- of them, "Allow public read access to tournaments" (USING (true), created
-- outside the migration history), was OR'd with the other three, so every
-- draft was readable by anon and by every signed-in member. The intended rule
-- (docs/decisions/wp5-canonical-routes.md; the settings tab labels Draft as
-- "Only admins can see it") is the remaining set:
--
--   tournaments_public_read     everyone        status <> 'draft'
--   tournaments_admin_read      everyone        players.id = auth.uid() AND role admin/master_admin
--   tournaments_admin_write     everyone (ALL)  same check as tournaments_admin_read
--   tournaments_self_host_read  authenticated   created_by = auth.uid()
--
-- plus one new policy:
--
--   tournaments_official_read   authenticated   is_tournament_official(id)
--
-- is_tournament_official() is true for admins (is_admin_or_master(), which
-- also matches admins by JWT e-mail), the creator, and anyone with an
-- ORGANIZER / UMPIRE / REFEREE row in tournament_officials for that
-- tournament. Officials need it because transition_tournament_lifecycle lets
-- any assigned official move a draft forward, and the hub, referee and umpire
-- panels load the tournament row first. Registrations, feedback and audit
-- events already use the same function for their reads. It also keeps drafts
-- visible to the admin whose players.id differs from their auth uid, whom
-- tournaments_admin_read does not match.
--
-- Not affected:
--   * tm_public_read, tp_public_read and trr_public_read filter
--     status <> 'draft' themselves, so their EXISTS on tournaments returns the
--     same rows as before.
--   * SECURITY DEFINER functions (lifecycle, scoring, invite tokens,
--     is_tournament_manager, ...) and edge functions (service role) bypass RLS.
--   * player_matches_unified runs with its owner's rights (no
--     security_invoker), so it still ignores tournaments RLS.
--   * tournament_team_standings (security_invoker) now hides draft rows from
--     viewers who cannot read the draft, which is intended.
--
-- Global umpires (players.role = 'umpire') who are not assigned to a draft
-- stop seeing it; tm_admin_read still lets them read its matches, and the
-- client's embedded tournaments(...) reads are null-safe.
--
-- Rollback: supabase/rollbacks/20261118140000_hide_draft_tournaments.rollback.sql

DROP POLICY IF EXISTS "tournaments_official_read" ON public.tournaments;
CREATE POLICY "tournaments_official_read" ON public.tournaments
  FOR SELECT TO authenticated
  USING (public.is_tournament_official(id));

DROP POLICY IF EXISTS "Allow public read access to tournaments" ON public.tournaments;
