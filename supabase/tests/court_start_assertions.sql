\set ON_ERROR_STOP on

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT set_config('request.jwt.claim.email', 'admin@example.test', false);

-- The ready-tournament fixture leaves match 2 reserved on C2 from 11:00-11:30.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.tournament_matches (
      id, tournament_id, match_code, status, team1_label, team2_label,
      points_to_win, best_of_sets, golden_point, court_number, scheduled_at
    ) VALUES (
      '20000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000001',
      'OVERLAP', 'scheduled', 'E', 'F', 21, 3, 30, 'c2', '2026-11-12T11:20:00Z'
    );
    RAISE EXCEPTION 'overlapping court reservation was accepted';
  EXCEPTION
    WHEN SQLSTATE '23P01' THEN
      IF SQLERRM NOT LIKE 'court_conflict:%' THEN
        RAISE;
      END IF;
  END;
END;
$$;

INSERT INTO public.tournament_matches (
  id, tournament_id, match_code, status, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at
) VALUES (
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'ADJACENT', 'scheduled', 'G', 'H', 21, 3, 30, 'C2', '2026-11-12T11:30:00Z'
);

DO $$
DECLARE
  receipt jsonb;
BEGIN
  receipt := public.start_tournament_match_checked(
    '20000000-0000-0000-0000-000000000002'::uuid,
    'C2',
    '2026-11-12T11:00:00Z'::timestamptz
  );
  IF receipt->>'reason' <> 'started' THEN
    RAISE EXCEPTION 'checked start did not start match: %', receipt;
  END IF;

  receipt := public.start_tournament_match_checked(
    '20000000-0000-0000-0000-000000000002'::uuid,
    'C2',
    '2026-11-12T11:00:00Z'::timestamptz
  );
  IF receipt->>'reason' <> 'already_started' THEN
    RAISE EXCEPTION 'checked start was not idempotent: %', receipt;
  END IF;
END;
$$;

INSERT INTO public.tournament_matches (
  id, tournament_id, match_code, status, player1_id, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at, started_at
) VALUES (
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'LIVE-C3', 'in_progress', '30000000-0000-0000-0000-000000000005',
  'I', 'J', 21, 3, 30, 'C3', now(), now()
), (
  '20000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  'WAIT-C3', 'scheduled', '30000000-0000-0000-0000-000000000006',
  'K', 'L', 21, 3, 30, 'C3', now() + interval '1 hour', NULL
);

DO $$
BEGIN
  PERFORM public.start_tournament_match_checked(
    '20000000-0000-0000-0000-000000000006'::uuid,
    'C3',
    NULL::timestamptz
  );
  RAISE EXCEPTION 'occupied court start was accepted';
EXCEPTION
  WHEN SQLSTATE '23P01' THEN
    IF SQLERRM NOT LIKE 'court_in_use:%' THEN
      RAISE;
    END IF;
END;
$$;

INSERT INTO public.tournament_matches (
  id, tournament_id, match_code, status, player1_id, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at, ended_at
) VALUES (
  '20000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000001',
  'JUST-FINISHED', 'completed', '30000000-0000-0000-0000-000000000007',
  'M', 'N', 21, 3, 30, 'C4', now() - interval '40 minutes', now() - interval '5 minutes'
), (
  '20000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000001',
  'NO-REST', 'scheduled', '30000000-0000-0000-0000-000000000007',
  'M', 'O', 21, 3, 30, 'C5', now() + interval '1 hour', NULL
);

DO $$
BEGIN
  PERFORM public.start_tournament_match_checked(
    '20000000-0000-0000-0000-000000000008'::uuid,
    'C5',
    NULL::timestamptz
  );
  RAISE EXCEPTION 'actual rest violation was accepted';
EXCEPTION
  WHEN SQLSTATE '23514' THEN
    IF SQLERRM NOT LIKE 'player_rest_conflict:%' THEN
      RAISE;
    END IF;
END;
$$;

SELECT 'court reservation and checked-start assertions passed' AS result;
