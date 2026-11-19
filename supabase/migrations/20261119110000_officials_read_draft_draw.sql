-- Let a tournament's host and assigned officials read its draw while it is a draft.
--
-- tournament_matches, tournament_participants and tournament_round_rules are
-- readable by everyone only when the tournament is not a draft
-- (tm_public_read / tp_public_read / trr_public_read). Otherwise:
--   tournament_matches       tm_admin_read: admins + players.role 'umpire'
--   tournament_participants  tp_admin_all: admins (by id); tp_host_manage: creator
--   tournament_round_rules   trr_admin_all: admins (by id)
--
-- A tournament stays 'draft' until start_play: transition_tournament_lifecycle
-- keeps the status on announce and publish_draw. During that whole set-up
-- phase the tournament's creator (tournaments.created_by) and its assigned
-- officials (tournament_officials: ORGANIZER / REFEREE / UMPIRE) can open the
-- tournament (tournaments_official_read) but cannot read its matches, and the
-- officials cannot read its entries or round rules either. Hosts can still
-- create matches in their draft through create_tie and
-- populate_playoff_qualifiers_from_standings (is_tournament_manager), and
-- admins build draws for drafts in the Tournament Manager.
--
-- No SECURITY DEFINER function returns a draft's matches, so every screen
-- reads the tables directly. These showed an empty draw to a non-admin host
-- or assigned official of a draft:
--   /tournaments/:id       match list and the Organiser, Referee and Umpire
--                          panels (Pulse LiveTab: OrganizerDashboard,
--                          RefereeDashboard + SendReminderSheet,
--                          UmpireTab / UmpireTournamentTab, TeamTiesSection)
--   /tournament-setup/:id  launch checklist (draw, courts, officials counts)
--   /tv/draw/:id           draw reveal
-- (The Tournament Manager at /tournament-admin is admin-only.)
--
-- Each new policy is permissive, SELECT only, for signed-in users, and uses
-- is_tournament_official(tournament_id): admins (also matched by e-mail), the
-- tournament's creator, and anyone in tournament_officials for it. It is the
-- check tournaments_official_read uses, so whoever can open a draft can now
-- also read its draw. Anon, ordinary members, and officials of other
-- tournaments gain nothing. Writes are unchanged. Column grants are
-- unchanged (participant e-mail stays hidden).
--
-- Knock-on effects:
--   * The e-mail-matched admin can read draft entries and round rules through
--     these policies. 20261119093000 gives them that (and write access)
--     through tp_admin_all / trr_admin_all; the two migrations are
--     independent and this one does not touch those policies.
--   * Hosts still cannot write round rules (no host policy on
--     tournament_round_rules); this migration only adds reads.
--   * Realtime changes to a draft's matches, entries and round rules now
--     reach its host and officials.
--   * Trashed tournaments: entries and round rules unchanged. Their host and
--     officials could already read them (tp_public_read / trr_public_read
--     pass because they can see the tournament row and its status is not
--     'draft'). Matches: as of 2026-11-19 handle_deleted_tournament deletes
--     them on trash. If trashed matches are kept instead (pending
--     20261119140000), its RESTRICTIVE tm_hide_trashed policy applies on top
--     of tm_official_read, so this migration does not expose them.
--   * Cost, rehearsed on prod 2026-11-19 (avg of 50, signed-in member):
--     all matches 6.3 -> 7.5 ms, all entries 6.7 -> 10.5 ms, all round rules
--     2.8 -> 4.6 ms; one tournament's matches unchanged (3.4 / 3.3 ms). The
--     check runs per row, so this grows with table size.
--
-- Rollback: supabase/rollbacks/20261119110000_officials_read_draft_draw.rollback.sql

DROP POLICY IF EXISTS "tm_official_read" ON public.tournament_matches;
CREATE POLICY "tm_official_read" ON public.tournament_matches
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_tournament_official(tournament_id));

DROP POLICY IF EXISTS "tp_official_read" ON public.tournament_participants;
CREATE POLICY "tp_official_read" ON public.tournament_participants
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_tournament_official(tournament_id));

DROP POLICY IF EXISTS "trr_official_read" ON public.tournament_round_rules;
CREATE POLICY "trr_official_read" ON public.tournament_round_rules
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_tournament_official(tournament_id));
