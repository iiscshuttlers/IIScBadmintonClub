-- Rollback for 20261119100000_officials_read_draft_draw.sql
-- Drops the three official read policies. Afterwards a draft's matches are
-- readable only by admins and global umpires (tm_admin_read), its entries
-- only by admins and its creator (tp_admin_all, tp_host_manage), and its
-- round rules only by admins (trr_admin_all), as on 2026-11-19.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261119100000 --remote --yes
BEGIN;

DROP POLICY IF EXISTS "tm_official_read" ON public.tournament_matches;
DROP POLICY IF EXISTS "tp_official_read" ON public.tournament_participants;
DROP POLICY IF EXISTS "trr_official_read" ON public.tournament_round_rules;

COMMIT;
