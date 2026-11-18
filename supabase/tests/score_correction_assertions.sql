\set ON_ERROR_STOP on

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT set_config('request.jwt.claim.email', 'admin@example.test', false);

-- 1. A reason is mandatory.
DO $$ BEGIN
  BEGIN
    PERFORM public.apply_tournament_match_correction(
      '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint,
      '19-21, 19-21', ARRAY['19-21', '19-21']::text[], 1::bigint, '   ',
      '90000000-0000-0000-0000-000000000001'::uuid);
    RAISE EXCEPTION 'empty reason was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $$;

-- 2. A stale expected revision is rejected.
DO $$ BEGIN
  BEGIN
    PERFORM public.apply_tournament_match_correction(
      '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint,
      '19-21, 19-21', ARRAY['19-21', '19-21']::text[], 99::bigint,
      'Correcting score', '90000000-0000-0000-0000-000000000002'::uuid);
    RAISE EXCEPTION 'stale revision was accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
END $$;

-- 3. A started downstream match locks the upstream result.
UPDATE public.tournament_matches
SET advances_to_match = 'SF-1', advances_to_position = 1
WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE public.tournament_matches SET match_code = 'SF-1', status = 'in_progress'
WHERE id = '20000000-0000-0000-0000-000000000002';

DO $$ BEGIN
  BEGIN
    PERFORM public.apply_tournament_match_correction(
      '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint,
      '19-21, 19-21', ARRAY['19-21', '19-21']::text[], 1::bigint,
      'Attempting correction while downstream in progress',
      '90000000-0000-0000-0000-000000000003'::uuid);
    RAISE EXCEPTION 'correction was accepted while downstream active';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM NOT LIKE 'downstream_match_started:%' THEN RAISE; END IF;
  END;
END $$;

-- 4. A valid correction updates the row, bracket and audit log.
UPDATE public.tournament_matches SET status = 'scheduled', score = NULL, started_at = NULL
WHERE id = '20000000-0000-0000-0000-000000000002';

DO $$
DECLARE v_res jsonb; v_match tournament_matches%ROWTYPE; v_log admin_logs%ROWTYPE;
BEGIN
  v_res := public.apply_tournament_match_correction(
    '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint,
    '19-21, 19-21', ARRAY['19-21', '19-21']::text[], 1::bigint,
    'Official correction verified with score sheet',
    '90000000-0000-0000-0000-000000000004'::uuid);
  IF (v_res->>'applied')::boolean <> true OR (v_res->>'revision')::bigint <> 2 THEN
    RAISE EXCEPTION 'unexpected correction receipt: %', v_res;
  END IF;
  SELECT * INTO v_match FROM public.tournament_matches
  WHERE id = '20000000-0000-0000-0000-000000000001';
  IF v_match.result_revision <> 2 OR v_match.winner_side <> 2 OR v_match.score <> '19-21, 19-21' THEN
    RAISE EXCEPTION 'corrected match row is inconsistent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tournament_matches
    WHERE id = '20000000-0000-0000-0000-000000000002'
      AND player1_id = '30000000-0000-0000-0000-000000000002'::uuid) THEN
    RAISE EXCEPTION 'corrected winner was not advanced into the downstream bracket';
  END IF;
  SELECT * INTO v_log FROM public.admin_logs WHERE action = 'tournament_score_correction'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND OR v_log.details->>'reason' <> 'Official correction verified with score sheet'
     OR (v_log.details->>'new_revision')::bigint <> 2
     OR (v_log.details->>'new_winner_side')::int <> 2 THEN
    RAISE EXCEPTION 'correction audit log is missing or inconsistent';
  END IF;
END $$;

-- 5. Retrying the same operation is side-effect free.
DO $$
DECLARE v_res jsonb; v_log_count integer;
BEGIN
  v_res := public.apply_tournament_match_correction(
    '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint,
    '19-21, 19-21', ARRAY['19-21', '19-21']::text[], 1::bigint,
    'Official correction verified with score sheet',
    '90000000-0000-0000-0000-000000000004'::uuid);
  IF (v_res->>'applied')::boolean <> false OR v_res->>'reason' <> 'already_applied' THEN
    RAISE EXCEPTION 'correction retry was not idempotent: %', v_res;
  END IF;
  SELECT count(*) INTO v_log_count FROM public.admin_logs
  WHERE action = 'tournament_score_correction'
    AND details->>'operation_id' = '90000000-0000-0000-0000-000000000004';
  IF v_log_count <> 1 THEN RAISE EXCEPTION 'correction retry wrote % audit rows', v_log_count; END IF;
END $$;

-- 6. A caller cannot attribute a correction to another profile.
DO $$ BEGIN
  BEGIN
    PERFORM public.apply_tournament_match_correction(
      '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint,
      '19-21, 18-21', ARRAY['19-21', '18-21']::text[], 2::bigint,
      'Attempted spoofed attribution', '90000000-0000-0000-0000-000000000005'::uuid,
      '00000000-0000-0000-0000-000000000099'::uuid);
    RAISE EXCEPTION 'spoofed scored_by was accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;

-- An authenticated player without an official role cannot correct a result.
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000099', false);
SELECT set_config('request.jwt.claim.email', 'player@example.test', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.apply_tournament_match_correction(
      '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint,
      '19-21, 18-21', ARRAY['19-21', '18-21']::text[], 2::bigint,
      'Unauthorized correction attempt',
      '90000000-0000-0000-0000-000000000007'::uuid);
    RAISE EXCEPTION 'unauthorized correction was accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM NOT LIKE 'Not authorized%' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT set_config('request.jwt.claim.email', 'admin@example.test', false);

-- 7. Ranked winner changes are blocked until Elo reversal is implemented.
UPDATE public.tournaments SET counts_for_elo = true
WHERE id = '10000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  BEGIN
    PERFORM public.apply_tournament_match_correction(
      '20000000-0000-0000-0000-000000000001'::uuid, 1::smallint,
      '21-19, 21-19', ARRAY['21-19', '21-19']::text[], 2::bigint,
      'Winner correction requiring Elo reversal',
      '90000000-0000-0000-0000-000000000006'::uuid);
    RAISE EXCEPTION 'ranked winner change was accepted without Elo recalculation';
  EXCEPTION WHEN SQLSTATE '0A000' THEN
    IF SQLERRM NOT LIKE 'winner_change_requires_coordinated_correction:%' THEN RAISE; END IF;
  END;
END $$;
UPDATE public.tournaments SET counts_for_elo = false
WHERE id = '10000000-0000-0000-0000-000000000001';

SELECT 'score correction assertions passed' AS result;
