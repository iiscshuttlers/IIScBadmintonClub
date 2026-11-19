-- Make the public read policies on a tournament's matches, participants and
-- round rules exclude trashed tournaments themselves.
--
-- tm_public_read, tp_public_read and trr_public_read check the parent with
-- EXISTS (... FROM tournaments t WHERE ... t.status <> 'draft'). They hid a
-- trashed tournament's rows only because that EXISTS runs under tournaments
-- RLS, and 20261118160100 hides status = 'deleted' there. Since
-- 20261119140000 a trashed tournament keeps its matches, and the RESTRICTIVE
-- tm_hide_trashed covers signed-in users only. So rolling back
-- 20261118160100 on its own would have shown every trashed tournament's
-- draw and scores to signed-out visitors, and its participants and round
-- rules to everyone.
--
-- Each policy now excludes 'deleted' as well as 'draft', the same filter as
-- tournaments_public_read, so it no longer depends on the tournaments
-- policies for the trash.
--
-- No visible change today. Anyone who can still read a trashed tournament
-- (admins, its creator, its assigned officials) reads its children through
-- tm/tp/trr_official_read, tp_host_manage and the admin policies, not
-- through these; trashed matches stay hidden from them by tm_hide_trashed as
-- before. Old clients are unaffected.
--
-- Rollback: supabase/rollbacks/20261119180000_child_public_reads_exclude_trash.rollback.sql

ALTER POLICY "tm_public_read" ON public.tournament_matches
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
     WHERE t.id = tournament_matches.tournament_id
       AND t.status <> ALL (ARRAY['draft'::text, 'deleted'::text])));

ALTER POLICY "tp_public_read" ON public.tournament_participants
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
     WHERE t.id = tournament_participants.tournament_id
       AND t.status <> ALL (ARRAY['draft'::text, 'deleted'::text])));

ALTER POLICY "trr_public_read" ON public.tournament_round_rules
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
     WHERE t.id = tournament_round_rules.tournament_id
       AND t.status <> ALL (ARRAY['draft'::text, 'deleted'::text])));
