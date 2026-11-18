\set ON_ERROR_STOP on
-- WP8 identity assertions. Run after identity_bootstrap.sql and
-- 20261113160000_add_player_identity_claims_and_merge.sql.

-- 1. A member (not admin) cannot merge or preview, even with a matching name.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.merge_player_identity('00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b1', 'Same name', 'e0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'member merged by name';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN
    PERFORM public.preview_player_merge('00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b1');
    RAISE EXCEPTION 'member previewed merge';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;

-- 2. A claim request needs evidence and never changes ownership by itself.
DO $$
DECLARE v jsonb;
BEGIN
  BEGIN
    PERFORM public.request_player_claim('00000000-0000-0000-0000-0000000000c1', 'me');
    RAISE EXCEPTION 'evidence-free claim accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  v := public.request_player_claim('00000000-0000-0000-0000-0000000000c1',
    'I played Bina on 3 Oct; the score sheet has my signature.');
  IF (v->>'created')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'claim not created: %', v; END IF;
  v := public.request_player_claim('00000000-0000-0000-0000-0000000000c1', 'Duplicate request text here');
  IF (v->>'created')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'duplicate pending claim created'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-0000-0000-0000-0000000000c1' AND is_guest) THEN
    RAISE EXCEPTION 'requesting a claim changed the guest';
  END IF;
  IF (SELECT player1_id FROM public.matches WHERE id = '10000000-0000-0000-0000-000000000001')
     <> '00000000-0000-0000-0000-0000000000c1' THEN
    RAISE EXCEPTION 'requesting a claim moved history';
  END IF;
  BEGIN
    PERFORM public.decide_player_claim(1, true, 'self-approve', 'e0000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'requester approved own claim';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN
    PERFORM public.request_player_claim('00000000-0000-0000-0000-0000000000b2', 'This is totally me, honestly');
    RAISE EXCEPTION 'claimed a member record';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
END $$;

-- Anonymous callers cannot request claims.
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.request_player_claim('00000000-0000-0000-0000-0000000000c1', 'anonymous attempt here');
    RAISE EXCEPTION 'anonymous claim accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;

-- 3. Admin preview lists every reference and flags self-match conflicts.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
DO $$
DECLARE v jsonb;
BEGIN
  v := public.preview_player_merge('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1');
  IF jsonb_array_length(v->'blockers') <> 0 THEN RAISE EXCEPTION 'unexpected blockers: %', v; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'references') e
                 WHERE e->>'table' = 'tournament_matches' AND e->>'column' = 'player2_id')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'references') e WHERE e->>'table' = 'player_badges')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'references') e WHERE e->>'table' = 'elo_calculation_logs') THEN
    RAISE EXCEPTION 'preview missed references: %', v->'references';
  END IF;
  v := public.preview_player_merge('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1');
  IF NOT (v->'blockers' ? 'history_conflict') THEN RAISE EXCEPTION 'self-match conflict not detected: %', v; END IF;
  BEGIN
    PERFORM public.merge_player_identity('00000000-0000-0000-0000-0000000000c2',
      '00000000-0000-0000-0000-0000000000b1', 'Should be blocked', 'e0000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'conflicting merge applied';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL; END;
  BEGIN
    PERFORM public.merge_player_identity('00000000-0000-0000-0000-0000000000c1',
      '00000000-0000-0000-0000-0000000000b1', '  ', 'e0000000-0000-0000-0000-000000000004');
    RAISE EXCEPTION 'reasonless merge applied';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $$;

-- 4. Approving the claim merges and preserves all history (including cascade-FK rows).
DO $$
DECLARE v jsonb;
BEGIN
  v := public.decide_player_claim(1, true, 'Bina confirmed in person', 'e0000000-0000-0000-0000-000000000005');
  IF v->>'status' <> 'approved' THEN RAISE EXCEPTION 'approval failed: %', v; END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-0000-0000-0000-0000000000c1') THEN
    RAISE EXCEPTION 'guest not removed';
  END IF;
  IF (SELECT player1_id FROM matches WHERE id = '10000000-0000-0000-0000-000000000001') <> '00000000-0000-0000-0000-0000000000b1'
     OR (SELECT winner_id FROM matches WHERE id = '10000000-0000-0000-0000-000000000001') <> '00000000-0000-0000-0000-0000000000b1'
     OR (SELECT player2_id FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001') <> '00000000-0000-0000-0000-0000000000b1'
     OR (SELECT winner_id FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001') <> '00000000-0000-0000-0000-0000000000b1' THEN
    RAISE EXCEPTION 'match history not preserved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tournament_participants WHERE player_id = '00000000-0000-0000-0000-0000000000b1')
     OR NOT EXISTS (SELECT 1 FROM player_badges WHERE player_id = '00000000-0000-0000-0000-0000000000b1')
     OR NOT EXISTS (SELECT 1 FROM elo_calculation_logs WHERE player_id = '00000000-0000-0000-0000-0000000000b1') THEN
    RAISE EXCEPTION 'entries/badges/elo lost (cascade delete?)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM player_aliases WHERE old_player_id = '00000000-0000-0000-0000-0000000000c1'
                 AND player_id = '00000000-0000-0000-0000-0000000000b1') THEN
    RAISE EXCEPTION 'alias for saved links missing';
  END IF;
  IF (SELECT status FROM player_claim_requests WHERE id = 1) <> 'approved' THEN
    RAISE EXCEPTION 'claim not marked approved';
  END IF;
  v := public.decide_player_claim(1, true, 'Bina confirmed in person', 'e0000000-0000-0000-0000-000000000005');
  IF v->>'reason' <> 'already_decided' THEN RAISE EXCEPTION 'approval retry not idempotent: %', v; END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_logs WHERE action = 'player_identity_merge') THEN
    RAISE EXCEPTION 'merge not logged';
  END IF;
END $$;

-- 5. Alias history cannot be rewritten; the public sees only the mapping.
DO $$ BEGIN
  BEGIN
    DELETE FROM player_aliases;
    RAISE EXCEPTION 'alias delete accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  IF has_column_privilege('anon', 'public.player_aliases', 'reason', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read merge reasons';
  END IF;
  IF NOT has_column_privilege('anon', 'public.player_aliases', 'player_id', 'SELECT') THEN
    RAISE EXCEPTION 'anon cannot resolve aliases';
  END IF;
  IF has_function_privilege('authenticated', 'public._player_reference_columns()', 'EXECUTE') THEN
    RAISE EXCEPTION 'internal helper exposed';
  END IF;
END $$;

SELECT 'identity claim/merge assertions passed' AS result;
