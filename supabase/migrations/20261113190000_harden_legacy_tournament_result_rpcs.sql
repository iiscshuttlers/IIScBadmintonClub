-- Migration: 20261113190000_harden_legacy_tournament_result_rpcs.sql
-- Purpose: Close old-client result-write paths after all first-party callers
-- moved to revisioned finalization and reasoned correction RPCs.

-- The legacy signature has no expected revision or operation id. Keeping it
-- available to ordinary authenticated clients would bypass the WP1 exactly-once
-- result contract. Service-role access is retained for controlled recovery.
REVOKE ALL ON FUNCTION public.submit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID)
TO service_role;

-- First-party admin score edits now use apply_tournament_match_correction and
-- bracket repair uses advance_tournament_winner. The old edit RPC lacks a
-- reason, expected revision and operation id, so it is no longer client-callable.
REVOKE ALL ON FUNCTION public.admin_edit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID)
TO service_role;

COMMENT ON FUNCTION public.submit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID)
IS 'Legacy service-only recovery path. Clients must call submit_tournament_match_v2.';

COMMENT ON FUNCTION public.admin_edit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID)
IS 'Legacy service-only recovery path. Clients must use apply_tournament_match_correction.';
