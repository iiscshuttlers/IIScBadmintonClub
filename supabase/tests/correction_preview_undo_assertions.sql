\set ON_ERROR_STOP on
-- WP7 assertions. Run after result_revision_bootstrap.sql, the WP1–WP3
-- migrations, result_revision_assertions.sql, score_correction_assertions.sql
-- and 20261113150000_add_correction_preview_undo_and_edit_audit.sql.
-- Uses the fixtures those files leave behind: match ...0001 (completed,
-- revision 2 after the WP2 correction) advancing into ...0002 ('SF-1').

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT set_config('request.jwt.claim.email', 'admin@example.test', false);

-- 1. Preview is read-only and reports revision, downstream and blockers.
DO $$
DECLARE v jsonb; v_before bigint;
BEGIN
  SELECT result_revision INTO v_before FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001';
  v := public.preview_tournament_match_correction('20000000-0000-0000-0000-000000000001', 1::smallint);
  IF (v->>'revision')::bigint <> v_before THEN RAISE EXCEPTION 'preview revision mismatch: %', v; END IF;
  IF jsonb_array_length(v->'downstream') <> 1 OR v->'downstream'->0->>'match_code' <> 'SF-1'
     OR v->'downstream'->0->>'path' <> 'winner' THEN
    RAISE EXCEPTION 'preview downstream wrong: %', v;
  END IF;
  IF (v->>'winner_change')::boolean IS NOT TRUE OR v->>'elo_effect' <> 'not_ranked'
     OR jsonb_array_length(v->'blockers') <> 0 THEN
    RAISE EXCEPTION 'preview flags wrong: %', v;
  END IF;
  IF (SELECT result_revision FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001') <> v_before THEN
    RAISE EXCEPTION 'preview changed the match';
  END IF;
END $$;

-- 2. Ranked winner change and started downstream appear as blockers.
UPDATE tournaments SET counts_for_elo = true WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE tournament_matches SET started_at = now() WHERE id = '20000000-0000-0000-0000-000000000002';
DO $$
DECLARE v jsonb;
BEGIN
  v := public.preview_tournament_match_correction('20000000-0000-0000-0000-000000000001', 1::smallint);
  IF NOT (v->'blockers' ? 'ranked_winner_change') OR NOT (v->'blockers' ? 'downstream_started')
     OR v->>'elo_effect' <> 'requires_recalculation' THEN
    RAISE EXCEPTION 'expected blockers missing: %', v;
  END IF;
END $$;
UPDATE tournaments SET counts_for_elo = false WHERE id = '10000000-0000-0000-0000-000000000001';

-- 3. A direct admin edit cannot rewrite a decided result feeding a started match.
DO $$ BEGIN
  BEGIN
    UPDATE tournament_matches SET status = 'scheduled', score = NULL, sets_history = '{}', winner_side = NULL
    WHERE id = '20000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'direct reset accepted while downstream started';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM NOT LIKE 'downstream_match_started:%' THEN RAISE; END IF;
  END;
END $$;
UPDATE tournament_matches SET started_at = NULL WHERE id = '20000000-0000-0000-0000-000000000002';

-- 4. A preview taken before another change cannot commit (stale preview).
DO $$
DECLARE v jsonb; v_rev bigint;
BEGIN
  v := public.preview_tournament_match_correction('20000000-0000-0000-0000-000000000001', NULL);
  v_rev := (v->>'revision')::bigint;
  -- Someone else edits the score directly: revision must move.
  UPDATE tournament_matches SET score = '19-21, 20-22', sets_history = ARRAY['19-21','20-22']
  WHERE id = '20000000-0000-0000-0000-000000000001';
  IF (SELECT result_revision FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001') <> v_rev + 1 THEN
    RAISE EXCEPTION 'direct result edit did not bump the revision';
  END IF;
  BEGIN
    PERFORM public.apply_tournament_match_correction(
      '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint, '19-21, 19-21',
      ARRAY['19-21','19-21']::text[], v_rev, 'Stale preview attempt',
      'a0000000-0000-0000-0000-000000000001'::uuid);
    RAISE EXCEPTION 'stale preview committed';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
  IF NOT EXISTS (SELECT 1 FROM tournament_audit_events
                 WHERE entity_id = '20000000-0000-0000-0000-000000000001'
                   AND action = 'result_direct_edit' AND source = 'direct_edit'
                   AND before->>'score' = '19-21, 19-21' AND after->>'score' = '19-21, 20-22'
                   AND actor_id = '00000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'direct result edit was not audited';
  END IF;
END $$;

-- 5. Correction then undo: both audited, undo restores, original event intact.
DO $$
DECLARE v jsonb; v_res jsonb; v_event bigint; v_m tournament_matches%ROWTYPE;
BEGIN
  v := public.preview_tournament_match_correction('20000000-0000-0000-0000-000000000001', 2::smallint);
  v_res := public.apply_tournament_match_correction(
    '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint, '19-21, 18-21',
    ARRAY['19-21','18-21']::text[], (v->>'revision')::bigint, 'Score sheet shows 18-21',
    'a0000000-0000-0000-0000-000000000002'::uuid);
  IF (v_res->>'applied')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'correction not applied: %', v_res; END IF;

  v := public.preview_tournament_match_correction('20000000-0000-0000-0000-000000000001', NULL);
  v_event := (v->>'undoable_event_id')::bigint;
  IF v_event IS NULL THEN RAISE EXCEPTION 'latest correction not offered for undo: %', v; END IF;

  v_res := public.undo_tournament_match_correction(
    v_event, (v->>'revision')::bigint, 'Entered against the wrong match',
    'a0000000-0000-0000-0000-000000000003'::uuid);
  SELECT * INTO v_m FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001';
  IF v_m.score <> '19-21, 20-22' OR v_m.sets_history <> ARRAY['19-21','20-22'] THEN
    RAISE EXCEPTION 'undo did not restore the previous result: %', v_m.score;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tournament_audit_events
                 WHERE action = 'result_correction_undo' AND undoes_event_id = v_event
                   AND reason = 'Entered against the wrong match') THEN
    RAISE EXCEPTION 'undo was not recorded as its own event';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tournament_audit_events WHERE id = v_event AND action = 'result_correction'
                 AND after->>'score' = '19-21, 18-21') THEN
    RAISE EXCEPTION 'original correction event was altered';
  END IF;

  -- Retrying the same undo is side-effect free.
  v_res := public.undo_tournament_match_correction(
    v_event, (v->>'revision')::bigint, 'Entered against the wrong match',
    'a0000000-0000-0000-0000-000000000003'::uuid);
  IF v_res->>'reason' <> 'already_applied' THEN RAISE EXCEPTION 'undo retry not idempotent: %', v_res; END IF;
  IF (SELECT count(*) FROM tournament_audit_events WHERE undoes_event_id = v_event) <> 1 THEN
    RAISE EXCEPTION 'undo retry wrote a second event';
  END IF;

  -- A second, different undo of the same correction is refused.
  BEGIN
    PERFORM public.undo_tournament_match_correction(
      v_event, v_m.result_revision, 'Double undo', 'a0000000-0000-0000-0000-000000000004'::uuid);
    RAISE EXCEPTION 'double undo accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN
    IF SQLERRM NOT LIKE 'correction_superseded:%' THEN RAISE; END IF;
  END;
END $$;

-- 6. Audit history is append-only, even for the table owner path.
DO $$ BEGIN
  BEGIN
    UPDATE tournament_audit_events SET reason = 'tampered' WHERE id = (SELECT min(id) FROM tournament_audit_events);
    RAISE EXCEPTION 'audit update accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN
    DELETE FROM tournament_audit_events;
    RAISE EXCEPTION 'audit delete accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;

-- 7. Schedule and seed edits are recorded with before/after values.
UPDATE tournament_matches SET court_number = 'C4', scheduled_at = '2026-11-20 10:00+05:30'
WHERE id = '20000000-0000-0000-0000-000000000002';
UPDATE tournament_participants SET seed = 2
WHERE id = (SELECT min(id::text)::uuid FROM tournament_participants);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM tournament_audit_events WHERE action = 'schedule_edit'
                 AND entity_id = '20000000-0000-0000-0000-000000000002' AND after->>'court' = 'C4') THEN
    RAISE EXCEPTION 'schedule edit not audited';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tournament_audit_events WHERE action = 'seed_edit' AND after->>'seed' = '2') THEN
    RAISE EXCEPTION 'seed edit not audited';
  END IF;
END $$;

-- 8. Clients cannot write audit rows or call internals; non-officials cannot preview.
DO $$
DECLARE v_ok boolean;
BEGIN
  v_ok := has_table_privilege('authenticated', 'public.tournament_audit_events', 'INSERT')
       OR has_table_privilege('authenticated', 'public.tournament_audit_events', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.tournament_audit_events', 'DELETE');
  IF v_ok THEN RAISE EXCEPTION 'authenticated can write audit rows'; END IF;
  IF has_function_privilege('authenticated',
       'public._change_tournament_match_result(uuid,smallint,text,text[],bigint,text,uuid,uuid,text,bigint)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public._record_tournament_audit_event(uuid,text,uuid,text,text,jsonb,jsonb,uuid,bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'internal functions are client-executable';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000099', false);
SELECT set_config('request.jwt.claim.email', 'player@example.test', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.preview_tournament_match_correction('20000000-0000-0000-0000-000000000001', NULL);
    RAISE EXCEPTION 'non-official preview accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN
    PERFORM public.undo_tournament_match_correction(1, 0, 'x', 'a0000000-0000-0000-0000-000000000009'::uuid);
    RAISE EXCEPTION 'non-official undo accepted';
  EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE 'P0002' THEN NULL; END;
END $$;

SELECT 'correction preview/undo/audit assertions passed' AS result;
