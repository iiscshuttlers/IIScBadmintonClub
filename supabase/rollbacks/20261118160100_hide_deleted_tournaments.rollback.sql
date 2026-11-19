-- Rollback for 20261118160100_hide_deleted_tournaments.sql
-- Restores tournaments_public_read exactly as pg_policies showed it on
-- 2026-11-18 (permissive, SELECT, roles {public}, status <> 'draft'). Deleted
-- tournaments, and their participants and round rules, become readable by
-- anon and every member again.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261118160100
BEGIN;

ALTER POLICY "tournaments_public_read" ON public.tournaments
  USING (status <> 'draft'::text);

COMMIT;
