-- Rollback for 20261118160100_hide_deleted_tournaments.sql
-- Restores tournaments_public_read exactly as pg_policies showed it on
-- 2026-11-18 (permissive, SELECT, roles {public}, status <> 'draft'). Deleted
-- tournament rows become readable by anon and every member again.
-- Their matches, participants and round rules stay hidden only while
-- 20261119180000 is applied (tm/tp/trr_public_read exclude 'deleted'
-- themselves). If you have rolled that back too, a trashed tournament's
-- participants and round rules become readable by everyone, and its matches
-- (kept since 20261119140000) by signed-out visitors.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261118160100 --remote --yes
BEGIN;

ALTER POLICY "tournaments_public_read" ON public.tournaments
  USING (status <> 'draft'::text);

COMMIT;
