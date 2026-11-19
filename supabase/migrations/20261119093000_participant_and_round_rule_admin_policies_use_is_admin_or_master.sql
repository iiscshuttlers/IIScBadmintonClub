-- Recognise every admin in the participants and round-rules admin policies.
--
-- Follows 20261118160200, which made the same change on tournaments.
-- tp_admin_all (tournament_participants) and trr_admin_all
-- (tournament_round_rules) matched admins only by players.id = auth.uid().
-- The admin whose players.id differs from their auth uid (matched by e-mail,
-- like the client's AuthContext does) and the master admin's second login
-- therefore had no admin access to these tables:
--   * participants: only tp_host_manage (tournament creator) and
--     tp_public_read (non-draft) applied, so on tournaments they did not
--     create, TournamentParticipantsTab add / edit / delete and
--     ParticipantImportModal changed 0 rows or were refused, and they could
--     not read a draft's participants;
--   * round rules: there is no host policy, so ScoringRulesPanel (in
--     TournamentSettingsTab) could not save rules on any tournament, Clone
--     could not copy them ("Couldn't copy scoring rules"), and draft rules
--     were unreadable.
--
-- Both policies now use (SELECT public.is_admin_or_master()), evaluated once
-- per statement. On 2026-11-18 that matched 3 logins instead of 1: the
-- master admin, the admin matched by e-mail and the master admin's second
-- login. No login loses access. Hosts, officials, umpires, members and anon
-- are unaffected.
--
-- Rollback: supabase/rollbacks/20261119093000_participant_and_round_rule_admin_policies_use_is_admin_or_master.rollback.sql

ALTER POLICY "tp_admin_all" ON public.tournament_participants
  USING ((SELECT public.is_admin_or_master()))
  WITH CHECK ((SELECT public.is_admin_or_master()));

ALTER POLICY "trr_admin_all" ON public.tournament_round_rules
  USING ((SELECT public.is_admin_or_master()))
  WITH CHECK ((SELECT public.is_admin_or_master()));
