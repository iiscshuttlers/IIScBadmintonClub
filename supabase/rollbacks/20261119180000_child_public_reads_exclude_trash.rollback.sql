-- Rollback for 20261119180000_child_public_reads_exclude_trash.sql
-- Restores tm_public_read, tp_public_read and trr_public_read exactly as
-- pg_policies showed them on 2026-11-19 (status <> 'draft' only). Trashed
-- tournaments' children then stay hidden from signed-out visitors and
-- members only while 20261118160100 hides deleted tournaments.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261119180000 --remote --yes
BEGIN;

ALTER POLICY "tm_public_read" ON public.tournament_matches
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
     WHERE t.id = tournament_matches.tournament_id
       AND t.status <> 'draft'::text));

ALTER POLICY "tp_public_read" ON public.tournament_participants
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
     WHERE t.id = tournament_participants.tournament_id
       AND t.status <> 'draft'::text));

ALTER POLICY "trr_public_read" ON public.tournament_round_rules
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
     WHERE t.id = tournament_round_rules.tournament_id
       AND t.status <> 'draft'::text));

COMMIT;
