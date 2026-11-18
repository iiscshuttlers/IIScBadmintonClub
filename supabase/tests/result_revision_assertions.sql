\set ON_ERROR_STOP on

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT set_config('request.jwt.claim.email', 'admin@example.test', false);

INSERT INTO public.players (id, email, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@example.test', 'admin');

INSERT INTO public.tournaments (id, status, start_date, venue, format_family, tournament_type)
VALUES (
  '10000000-0000-0000-0000-000000000001', 'draft', '2026-11-12', 'Gymkhana', 'OPEN_EVENT', 'open'
);

INSERT INTO public.tournament_matches (
  id, tournament_id, status, player1_id, player2_id, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'scheduled',
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Player A', 'Player B', 21, 3, 30, 'C1', '2026-11-12T10:00:00Z'
);

DO $$
DECLARE
  receipt jsonb;
BEGIN
  receipt := public.submit_tournament_match_v2(
    '20000000-0000-0000-0000-000000000001'::uuid, 1::smallint, '21-10, 21-12',
    ARRAY['21-10', '21-12']::text[], NULL::uuid, 0::bigint,
    '40000000-0000-0000-0000-000000000001'::uuid
  );
  IF receipt->>'reason' <> 'applied' OR (receipt->>'revision')::integer <> 1 THEN
    RAISE EXCEPTION 'unexpected first receipt: %', receipt;
  END IF;

  receipt := public.submit_tournament_match_v2(
    '20000000-0000-0000-0000-000000000001'::uuid, 1::smallint, '21-10, 21-12',
    ARRAY['21-10', '21-12']::text[], NULL::uuid, 0::bigint,
    '40000000-0000-0000-0000-000000000001'::uuid
  );
  IF receipt->>'reason' <> 'already_applied' THEN
    RAISE EXCEPTION 'retry was not idempotent: %', receipt;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE id = '20000000-0000-0000-0000-000000000001'
      AND result_revision = 1
      AND finalize_count = 1
  ) THEN
    RAISE EXCEPTION 'finalization side effects were not applied exactly once';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.submit_tournament_match_v2(
      '20000000-0000-0000-0000-000000000001'::uuid, 1::smallint, '21-10, 21-12',
      ARRAY['21-10', '21-12']::text[],
      '00000000-0000-0000-0000-000000000099'::uuid, 1::bigint,
      '40000000-0000-0000-0000-000000000009'::uuid
    );
    RAISE EXCEPTION 'spoofed umpire_id was accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    IF SQLERRM NOT LIKE 'umpire_id must identify%' THEN RAISE; END IF;
  END;
END;
$$;

DO $$
BEGIN
  PERFORM public.submit_tournament_match_v2(
    '20000000-0000-0000-0000-000000000001'::uuid, 2::smallint, '10-21, 12-21',
    ARRAY['10-21', '12-21']::text[], NULL::uuid, 1::bigint,
    '40000000-0000-0000-0000-000000000002'::uuid
  );
  RAISE EXCEPTION 'different completed result was accepted';
EXCEPTION
  WHEN SQLSTATE '40001' THEN
    IF SQLERRM NOT LIKE 'result_conflict:%' THEN
      RAISE;
    END IF;
END;
$$;

INSERT INTO public.tournaments (id, status, format_family, tournament_type)
VALUES ('10000000-0000-0000-0000-000000000002', 'draft', 'OPEN_EVENT', 'open');

DO $$
BEGIN
  UPDATE public.tournaments
  SET status = 'active'
  WHERE id = '10000000-0000-0000-0000-000000000002';
  RAISE EXCEPTION 'incomplete tournament was activated';
EXCEPTION
  WHEN SQLSTATE '23514' THEN
    IF SQLERRM NOT LIKE 'tournament_not_ready:%' THEN
      RAISE;
    END IF;
END;
$$;

INSERT INTO public.tournament_participants (id, tournament_id, category, display_name)
VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'MS', 'Player A'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'MS', 'Player B');

INSERT INTO public.tournament_matches (
  id, tournament_id, status, player1_id, player2_id, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at
) VALUES (
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'scheduled',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000004',
  'Player C', 'Player D', 21, 3, 30, 'C2', '2026-11-12T11:00:00Z'
);

UPDATE public.tournaments
SET status = 'active'
WHERE id = '10000000-0000-0000-0000-000000000001';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = '10000000-0000-0000-0000-000000000001' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'ready tournament did not activate';
  END IF;
END;
$$;

SELECT 'result revision and readiness migration assertions passed' AS result;
