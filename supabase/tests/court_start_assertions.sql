-- Court reservation and checked-start assertions. Self-contained (own fixtures),
-- no psql meta-commands, so it runs through the Supabase CLI. Always rolled back:
--   node supabase/tests/registration_rehearse.mjs partb supabase/tests/court_start_assertions.sql
-- (or wrap in BEGIN … ROLLBACK and run with `npx supabase db query --remote -f`).
BEGIN;
SET LOCAL lock_timeout = '3s';

SELECT set_config('request.jwt.claim.sub', 'c5000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.email', 'court-admin@court-test.invalid', true);
SELECT set_config('request.jwt.claims', '{"sub":"c5000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

INSERT INTO public.players (id, full_name, role) VALUES
  ('c5000000-0000-0000-0000-000000000001', 'Court admin', 'admin'),
  ('c5000000-0000-0000-0000-000000000005', 'Court P5', 'player'),
  ('c5000000-0000-0000-0000-000000000006', 'Court P6', 'player'),
  ('c5000000-0000-0000-0000-000000000007', 'Court P7', 'player');

INSERT INTO public.tournaments (id, name, year, status, created_by, categories, format_family)
VALUES ('c5100000-0000-0000-0000-000000000001', 'Court test', 2026, 'upcoming',
        'c5000000-0000-0000-0000-000000000001', ARRAY['MS'], 'OPEN_EVENT');

-- Match 2 is reserved on C2 from 11:00 (30-minute slot).
INSERT INTO public.tournament_matches (
  id, tournament_id, category, round, round_name, match_number, match_code, status, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at
) VALUES (
  'c5200000-0000-0000-0000-000000000002', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 1,
  'RESERVED', 'scheduled', 'A', 'B', 21, 3, 30, 'C2', '2026-11-12T11:00:00Z'
);

DO $$
BEGIN
  -- Overlap on the same court, written differently ("c2"), is refused.
  BEGIN
    INSERT INTO public.tournament_matches (
      id, tournament_id, category, round, round_name, match_number, match_code, status, team1_label, team2_label,
      points_to_win, best_of_sets, golden_point, court_number, scheduled_at
    ) VALUES (
      'c5200000-0000-0000-0000-000000000003', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 2,
      'OVERLAP', 'scheduled', 'E', 'F', 21, 3, 30, 'c2', '2026-11-12T11:20:00Z'
    );
    RAISE EXCEPTION 'FAIL: overlapping court reservation was accepted';
  EXCEPTION WHEN SQLSTATE '23P01' THEN
    IF SQLERRM NOT LIKE 'court_conflict:%' THEN RAISE; END IF;
  END;

  -- A bare "2" is the same court as "C2" after court_key normalisation.
  BEGIN
    INSERT INTO public.tournament_matches (
      id, tournament_id, category, round, round_name, match_number, match_code, status, team1_label, team2_label,
      points_to_win, best_of_sets, golden_point, court_number, scheduled_at
    ) VALUES (
      'c5200000-0000-0000-0000-000000000009', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 3,
      'OVERLAP-BARE', 'scheduled', 'E', 'F', 21, 3, 30, '2', '2026-11-12T11:10:00Z'
    );
    RAISE EXCEPTION 'FAIL: overlapping bare court number was accepted';
  EXCEPTION WHEN SQLSTATE '23P01' THEN
    IF SQLERRM NOT LIKE 'court_conflict:%' THEN RAISE; END IF;
  END;
END $$;

-- The next slot on the same court is fine.
INSERT INTO public.tournament_matches (
  id, tournament_id, category, round, round_name, match_number, match_code, status, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at
) VALUES (
  'c5200000-0000-0000-0000-000000000004', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 4,
  'ADJACENT', 'scheduled', 'G', 'H', 21, 3, 30, 'C2', '2026-11-12T11:30:00Z'
);

DO $$
DECLARE receipt jsonb;
BEGIN
  receipt := public.start_tournament_match_checked('c5200000-0000-0000-0000-000000000002'::uuid, 'C2', '2026-11-12T11:00:00Z'::timestamptz);
  IF receipt->>'reason' IS DISTINCT FROM 'started' THEN
    RAISE EXCEPTION 'FAIL: checked start did not start match: %', receipt;
  END IF;
  receipt := public.start_tournament_match_checked('c5200000-0000-0000-0000-000000000002'::uuid, 'C2', '2026-11-12T11:00:00Z'::timestamptz);
  IF receipt->>'reason' IS DISTINCT FROM 'already_started' THEN
    RAISE EXCEPTION 'FAIL: checked start was not idempotent: %', receipt;
  END IF;
END $$;

INSERT INTO public.tournament_matches (
  id, tournament_id, category, round, round_name, match_number, match_code, status, player1_id, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at, started_at
) VALUES
  ('c5200000-0000-0000-0000-000000000005', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 5,
   'LIVE-C3', 'in_progress', 'c5000000-0000-0000-0000-000000000005', 'I', 'J', 21, 3, 30, 'C3', now(), now()),
  ('c5200000-0000-0000-0000-000000000006', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 6,
   'WAIT-C3', 'scheduled', 'c5000000-0000-0000-0000-000000000006', 'K', 'L', 21, 3, 30, 'C3', now() + interval '1 hour', NULL);

DO $$
BEGIN
  PERFORM public.start_tournament_match_checked('c5200000-0000-0000-0000-000000000006'::uuid, 'C3', NULL::timestamptz);
  RAISE EXCEPTION 'FAIL: occupied court start was accepted';
EXCEPTION WHEN SQLSTATE '23P01' THEN
  IF SQLERRM NOT LIKE 'court_in_use:%' THEN RAISE; END IF;
END $$;

INSERT INTO public.tournament_matches (
  id, tournament_id, category, round, round_name, match_number, match_code, status, player1_id, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point, court_number, scheduled_at, ended_at
) VALUES
  ('c5200000-0000-0000-0000-000000000007', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 7,
   'JUST-FINISHED', 'completed', 'c5000000-0000-0000-0000-000000000007', 'M', 'N', 21, 3, 30, 'C4',
   now() - interval '40 minutes', now() - interval '5 minutes'),
  ('c5200000-0000-0000-0000-000000000008', 'c5100000-0000-0000-0000-000000000001', 'MS', 1, 'Round 1', 8,
   'NO-REST', 'scheduled', 'c5000000-0000-0000-0000-000000000007', 'M', 'O', 21, 3, 30, 'C5',
   now() + interval '1 hour', NULL);

DO $$
BEGIN
  PERFORM public.start_tournament_match_checked('c5200000-0000-0000-0000-000000000008'::uuid, 'C5', NULL::timestamptz);
  RAISE EXCEPTION 'FAIL: actual rest violation was accepted';
EXCEPTION WHEN SQLSTATE '23514' THEN
  IF SQLERRM NOT LIKE 'player_rest_conflict:%' THEN RAISE; END IF;
END $$;

SELECT 'court_start_assertions: court reservation and checked-start assertions passed' AS result;
ROLLBACK;
