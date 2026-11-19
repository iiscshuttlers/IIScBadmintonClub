-- Rollback for 20261118140000_hide_draft_tournaments.sql
-- Restores the production policy exactly as pg_policies showed it on
-- 2026-11-18 (permissive, SELECT, roles {public}, USING (true)) and removes
-- the officials policy. This makes draft tournaments readable by everyone
-- again, including anon.
-- Run with: npx --no-install supabase db query --remote -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261118140000 --remote --yes
BEGIN;

DROP POLICY IF EXISTS "Allow public read access to tournaments" ON public.tournaments;
CREATE POLICY "Allow public read access to tournaments" ON public.tournaments
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "tournaments_official_read" ON public.tournaments;

COMMIT;
