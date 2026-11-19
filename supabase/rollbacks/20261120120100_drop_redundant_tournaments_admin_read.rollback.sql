-- Rollback for 20261120120100_drop_redundant_tournaments_admin_read.sql
-- Recreates tournaments_admin_read exactly as pg_policies showed it on
-- 2026-11-20 (permissive, SELECT, roles {public}).
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261120120100 --remote --yes
BEGIN;

DROP POLICY IF EXISTS "tournaments_admin_read" ON public.tournaments;
CREATE POLICY "tournaments_admin_read" ON public.tournaments
  AS PERMISSIVE FOR SELECT TO public
  USING ((SELECT public.is_admin_or_master()));

COMMIT;
