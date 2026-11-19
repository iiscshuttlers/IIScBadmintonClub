-- Rollback for 20261119093000_participant_and_round_rule_admin_policies_use_is_admin_or_master.sql
-- Restores both policies exactly as pg_policies showed them on 2026-11-19
-- (permissive, ALL, roles {public}, admins matched by players.id = auth.uid()
-- only). The admin matched by e-mail and the master admin's second login lose
-- admin access to participants and round rules again.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261119093000 --remote --yes
BEGIN;

ALTER POLICY "tp_admin_all" ON public.tournament_participants
  USING (EXISTS (
    SELECT 1 FROM public.players
     WHERE players.id = auth.uid()
       AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.players
     WHERE players.id = auth.uid()
       AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "trr_admin_all" ON public.tournament_round_rules
  USING (EXISTS (
    SELECT 1 FROM public.players
     WHERE players.id = auth.uid()
       AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.players
     WHERE players.id = auth.uid()
       AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

COMMIT;
