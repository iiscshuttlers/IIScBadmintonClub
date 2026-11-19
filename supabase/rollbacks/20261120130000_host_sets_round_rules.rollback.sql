-- Rollback for 20261120130000_host_sets_round_rules.sql
--
-- Drops set_tournament_round_rule. New clients then fall back to the direct
-- table writes, which only admins can make, so hosts lose rule editing again.
-- Rules already saved stay as they are.
--
-- Run with:
--   npx --no-install supabase db query --remote --yes -f <this file>
--   npx --no-install supabase migration repair --status reverted 20261120130000 --remote --yes
-- (repair from a checkout that has the migration file.)

BEGIN;

DROP FUNCTION IF EXISTS public.set_tournament_round_rule(uuid, text, integer, text, integer, integer, integer);

COMMIT;
