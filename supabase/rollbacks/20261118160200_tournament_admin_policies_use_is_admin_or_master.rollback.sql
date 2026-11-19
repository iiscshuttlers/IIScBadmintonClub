-- Rollback for 20261118160200_tournament_admin_policies_use_is_admin_or_master.sql
-- Restores both policies exactly as pg_policies showed them on 2026-11-18
-- (permissive, roles {public}, admins matched by players.id = auth.uid()
-- only). The admin matched by e-mail loses direct write access to
-- tournaments again.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261118160200 --remote --yes
BEGIN;

ALTER POLICY "tournaments_admin_read" ON public.tournaments
  USING (EXISTS (
    SELECT 1 FROM public.players
     WHERE players.id = auth.uid()
       AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

ALTER POLICY "tournaments_admin_write" ON public.tournaments
  USING (EXISTS (
    SELECT 1 FROM public.players
     WHERE players.id = auth.uid()
       AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.players
     WHERE players.id = auth.uid()
       AND players.role = ANY (ARRAY['admin'::text, 'master_admin'::text])));

COMMIT;
