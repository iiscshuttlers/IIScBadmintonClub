-- Team-tie rubber creation checks (create_tie, add_decider_rubber_to_tie).
-- Safe on prod: everything runs in one transaction that always rolls back.
-- Run: npx --no-install supabase db query --remote --yes --output-format json -f supabase/tests/team_tie_rubbers_assertions.sql
-- Prints one row per check; any failure aborts with the failing check's message.
-- Regression for 20261123090000_team_tie_rubbers_set_round (rubbers lacked the
-- NOT NULL `round`, and the object-shaped tie_format_config made no rubbers).

BEGIN;

CREATE TEMP TABLE _checks (check_name text, result text);

DO $checks$
DECLARE
  v_creator uuid := (SELECT created_by FROM tournaments WHERE created_by IS NOT NULL ORDER BY created_at DESC LIMIT 1);
  v_cap_a uuid := (SELECT id FROM players ORDER BY created_at LIMIT 1);
  v_cap_b uuid;
  v_t uuid; v_a uuid; v_b uuid; v_tie uuid; v_tie2 uuid; v_res jsonb;
  v_n int; v_refused boolean;
BEGIN
  SELECT id INTO v_cap_b FROM players WHERE id <> v_cap_a ORDER BY created_at LIMIT 1;

  INSERT INTO tournaments (name, year, status, created_by, format_family, tie_format_config)
  VALUES ('ZZ check team event', 2026, 'draft', v_creator, 'TEAM',
          '{"rubbers":[{"order":1,"label":"MS1","category":"MS"},{"order":2,"label":"XD1","category":"XD","best_of_sets":1}],"tie_points_win":2}'::jsonb)
  RETURNING id INTO v_t;
  INSERT INTO tournament_teams (tournament_id, name, short_name, captain_id) VALUES (v_t, 'Alpha', 'ALP', v_cap_a) RETURNING id INTO v_a;
  INSERT INTO tournament_teams (tournament_id, name, short_name, captain_id) VALUES (v_t, 'Bravo', 'BRV', v_cap_b) RETURNING id INTO v_b;

  -- 1. The creator makes a tie from the object-shaped format.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_creator, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_tie := create_tie(v_t, 'T1', v_a, v_b, 'POOL', NULL, NULL);
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_n FROM tournament_matches
   WHERE tie_id = v_tie AND round = 1 AND round_name = 'T1' AND team1_label = 'ALP' AND team2_label = 'BRV';
  IF v_n <> 2 THEN RAISE EXCEPTION 'object format: expected 2 rubbers, got %', v_n; END IF;
  INSERT INTO _checks VALUES ('create_tie, object format', 'ok: 2 rubbers, round 1');

  -- 2. A decider rubber is added after them.
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_res := add_decider_rubber_to_tie(v_tie, 'XD', 'Decider', 1, 21);
  EXECUTE 'RESET ROLE';
  IF (v_res->>'rubber_order')::int <> 3 THEN RAISE EXCEPTION 'decider: expected rubber_order 3, got %', v_res; END IF;
  SELECT count(*) INTO v_n FROM tournament_matches WHERE tie_id = v_tie AND is_decider_tiebreaker AND round = 1;
  IF v_n <> 1 THEN RAISE EXCEPTION 'decider: expected 1 decider rubber, got %', v_n; END IF;
  INSERT INTO _checks VALUES ('add_decider_rubber_to_tie', 'ok: rubber 3');

  -- 3. The older bare-array format still works; a missing "order" uses the position.
  UPDATE tournaments SET tie_format_config = '[{"order":1,"label":"WS1","category":"WS"},{"label":"MD1","category":"MD"}]'::jsonb WHERE id = v_t;
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_tie2 := create_tie(v_t, 'T2', v_a, v_b, 'POOL', NULL, NULL);
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_n FROM tournament_matches WHERE tie_id = v_tie2 AND round = 1 AND match_number IN (1, 2);
  IF v_n <> 2 THEN RAISE EXCEPTION 'array format: expected 2 rubbers, got %', v_n; END IF;
  INSERT INTO _checks VALUES ('create_tie, array format', 'ok: 2 rubbers');

  -- 4. A stranger is refused by both functions.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_refused := false;
  BEGIN
    PERFORM create_tie(v_t, 'T3', v_a, v_b, 'POOL', NULL, NULL);
  EXCEPTION WHEN OTHERS THEN v_refused := true;
  END;
  IF NOT v_refused THEN RAISE EXCEPTION 'create_tie: a stranger was not refused'; END IF;
  v_refused := false;
  BEGIN
    PERFORM add_decider_rubber_to_tie(v_tie, 'MS', 'X', 1, 21);
  EXCEPTION WHEN OTHERS THEN v_refused := true;
  END;
  IF NOT v_refused THEN RAISE EXCEPTION 'add_decider_rubber_to_tie: a stranger was not refused'; END IF;
  EXECUTE 'RESET ROLE';
  INSERT INTO _checks VALUES ('strangers refused', 'ok');

  -- 5. Signed-out callers cannot execute either function.
  IF has_function_privilege('anon', 'public.create_tie(uuid, text, uuid, uuid, text, uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.add_decider_rubber_to_tie(uuid, text, text, integer, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute a tie function';
  END IF;
  INSERT INTO _checks VALUES ('anon has no EXECUTE', 'ok');
END
$checks$;

SELECT check_name, result FROM _checks;
ROLLBACK;
