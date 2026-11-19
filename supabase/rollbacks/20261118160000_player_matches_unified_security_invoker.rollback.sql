-- Rollback for 20261118160000_player_matches_unified_security_invoker.sql
-- Returns the view to running with its owner's rights (reloptions were NULL
-- on 2026-11-18). Matches of draft tournaments become readable through it
-- again by anon and every member.
-- Run with: npx --no-install supabase db query --remote --yes -f <this file>
-- Then: npx --no-install supabase migration repair --status reverted 20261118160000
BEGIN;

ALTER VIEW public.player_matches_unified RESET (security_invoker);

COMMIT;
