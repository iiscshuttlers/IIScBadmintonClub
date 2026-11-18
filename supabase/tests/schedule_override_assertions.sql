-- schedule_override_assertions.sql
-- Verifies Work Package 3:
-- 1. Tournament policy columns (min_rest_minutes, estimated_match_minutes, unavailable_court_periods)
-- 2. Tournament match override attribution columns
-- 3. Hard conflict rejections: empty reason, unauthorized caller, unavailable court blackout, active court in use, actual rest below min
-- 4. Successful warning override with audit logging in admin_logs
-- 5. start_tournament_match_checked enforcement of custom tournament rest and blackout periods

\set ON_ERROR_STOP on

BEGIN;

-- 1. Setup mock auth and test users
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.email', 'admin@iisc.ac.in', true);

INSERT INTO public.players (id, full_name, email, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tournament Admin', 'admin@iisc.ac.in', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Tournament Official', 'official@iisc.ac.in', 'member'),
  ('33333333-3333-3333-3333-333333333333', 'Regular Player', 'player@iisc.ac.in', 'member'),
  ('44444444-4444-4444-4444-444444444444', 'Opponent Player', 'opponent@iisc.ac.in', 'member');

-- Create test tournament with custom policies:
-- min_rest_minutes = 25 (higher than default 15)
-- estimated_match_minutes = 35
-- unavailable_court_periods for Court 3 from 10:00 to 12:00
INSERT INTO public.tournaments (
  id,
  status,
  start_date,
  venue,
  min_rest_minutes,
  estimated_match_minutes,
  unavailable_court_periods
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'draft',
  CURRENT_DATE,
  'Gymkhana',
  25,
  35,
  jsonb_build_array(
    jsonb_build_object(
      'court', '3',
      'start', '2026-11-15T10:00:00Z',
      'end', '2026-11-15T12:00:00Z',
      'reason', 'VIP Coaching Camp'
    )
  )
);

-- Add participant
INSERT INTO public.tournament_participants (id, tournament_id, category, display_name)
VALUES ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MS', 'Test Player');

-- Register official
INSERT INTO public.tournament_officials (tournament_id, user_id, role)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'MANAGER');

-- Create test matches
INSERT INTO public.tournament_matches (
  id,
  tournament_id,
  match_code,
  player1_id,
  player2_id,
  status,
  court_number,
  scheduled_at,
  points_to_win,
  best_of_sets
) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'M1', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'scheduled', '1', '2026-11-15T09:00:00Z', 21, 3),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'M2', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'scheduled', '1', '2026-11-15T09:30:00Z', 21, 3),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'M3', '44444444-4444-4444-4444-444444444444', NULL, 'scheduled', '2', '2026-11-15T10:00:00Z', 21, 3);

-- Now activate tournament
UPDATE public.tournaments
SET status = 'active'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- TEST 1: Empty reason rejection
DO $$
DECLARE
  v_err boolean := false;
BEGIN
  BEGIN
    PERFORM public.override_tournament_schedule(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
      '1',
      '2026-11-15T09:15:00Z',
      '   ' -- empty whitespace
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_err := true;
  END;

  IF NOT v_err THEN
    RAISE EXCEPTION 'TEST 1 FAILED: override_tournament_schedule should reject empty reason';
  END IF;
END;
$$;

-- TEST 2: Unauthorized caller rejection
DO $$
DECLARE
  v_err boolean := false;
BEGIN
  -- Switch to regular player
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  PERFORM set_config('request.jwt.claim.email', 'player@iisc.ac.in', true);

  BEGIN
    PERFORM public.override_tournament_schedule(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
      '1',
      '2026-11-15T09:15:00Z',
      'Unauthorized attempt'
    );
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_err := true;
  END;

  -- Switch back to admin
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  PERFORM set_config('request.jwt.claim.email', 'admin@iisc.ac.in', true);

  IF NOT v_err THEN
    RAISE EXCEPTION 'TEST 2 FAILED: override_tournament_schedule should reject unauthorized caller';
  END IF;
END;
$$;

-- TEST 3: Hard conflict rejection on unavailable court period (Court 3 10:00 - 12:00)
DO $$
DECLARE
  v_err boolean := false;
BEGIN
  BEGIN
    PERFORM public.override_tournament_schedule(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
      '3',
      '2026-11-15T10:30:00Z',
      'Try override into coaching camp'
    );
  EXCEPTION WHEN SQLSTATE '23P01' THEN
    v_err := true;
  END;

  IF NOT v_err THEN
    RAISE EXCEPTION 'TEST 3 FAILED: override_tournament_schedule must reject override into unavailable court period';
  END IF;
END;
$$;

-- TEST 4: Hard conflict rejection on court in use NOW by active match
DO $$
DECLARE
  v_err boolean := false;
BEGIN
  -- Set M1 as actively in_progress on Court 1
  UPDATE public.tournament_matches
  SET status = 'in_progress', started_at = now()
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';

  BEGIN
    PERFORM public.override_tournament_schedule(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
      '1',
      now(),
      'Try schedule now on currently occupied court'
    );
  EXCEPTION WHEN SQLSTATE '23P01' THEN
    v_err := true;
  END;

  IF NOT v_err THEN
    RAISE EXCEPTION 'TEST 4 FAILED: override_tournament_schedule must reject scheduling on actively occupied court now';
  END IF;
END;
$$;

-- TEST 5: Hard conflict rejection on player actual rest gap below tournament policy (25 min)
DO $$
DECLARE
  v_err boolean := false;
BEGIN
  -- Mark M1 completed 10 minutes ago
  UPDATE public.tournament_matches
  SET status = 'completed',
      started_at = now() - interval '40 minutes',
      ended_at = now() - interval '10 minutes'
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';

  -- Try scheduling M2 for player1 now (only 10 mins rest, policy is 25 mins)
  BEGIN
    PERFORM public.override_tournament_schedule(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
      '2',
      now(),
      'Try overriding actual rest below min'
    );
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_err := true;
  END;

  IF NOT v_err THEN
    RAISE EXCEPTION 'TEST 5 FAILED: override_tournament_schedule must reject actual rest below tournament min_rest_minutes';
  END IF;
END;
$$;

-- TEST 6: Warning override succeeds with audit log insertion
DO $$
DECLARE
  v_res jsonb;
  v_log_count integer;
  v_reason text;
BEGIN
  -- Schedule M3 on Court 1 at future time (2026-11-15T15:00:00Z) with valid reason
  v_res := public.override_tournament_schedule(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    '1',
    '2026-11-15T15:00:00Z',
    'Overridden by TD: Short sets format to resolve scheduling delay',
    'court_warning',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'
  );

  IF (v_res->>'applied')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 6 FAILED: expected applied true';
  END IF;

  -- Verify match was updated
  SELECT schedule_override_reason INTO v_reason
  FROM public.tournament_matches
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';

  IF v_reason <> 'Overridden by TD: Short sets format to resolve scheduling delay' THEN
    RAISE EXCEPTION 'TEST 6 FAILED: schedule_override_reason mismatch: %', v_reason;
  END IF;

  -- Verify audit log row created
  SELECT count(*) INTO v_log_count
  FROM public.admin_logs
  WHERE action = 'tournament_schedule_override'
    AND details->>'match_id' = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';

  IF v_log_count = 0 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: expected admin_log row for tournament_schedule_override';
  END IF;
END;
$$;

-- TEST 7: start_tournament_match_checked respects tournament min_rest_minutes and blackout
DO $$
DECLARE
  v_err boolean := false;
BEGIN
  -- 7a: Blackout period rejection on start
  -- Set tournament unavailable periods to include a blackout covering NOW on Court 3
  UPDATE public.tournaments
  SET unavailable_court_periods = jsonb_build_array(
    jsonb_build_object(
      'court', '3',
      'start', (now() - interval '1 hour')::text,
      'end', (now() + interval '1 hour')::text,
      'reason', 'Emergency Maintenance'
    )
  )
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- Set M3 to Court 3 with fresh players
  UPDATE public.tournament_matches
  SET court_number = '3',
      scheduled_at = now(),
      player1_id = '22222222-2222-2222-2222-222222222222',
      player2_id = NULL
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';

  BEGIN
    PERFORM public.start_tournament_match_checked(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03'::uuid,
      '3'::text
    );
  EXCEPTION WHEN SQLSTATE '23P01' THEN
    -- court_unavailable
    v_err := true;
  END;

  IF NOT v_err THEN
    RAISE EXCEPTION 'TEST 7a FAILED: start_tournament_match_checked must reject starting on unavailable court period';
  END IF;

  -- 7b: Rest conflict rejection on start using tournament min_rest_minutes (25m)
  -- Player completed M1 15 mins ago (which passes default 15m, but must fail 25m tournament policy!)
  UPDATE public.tournament_matches
  SET status = 'completed',
      ended_at = now() - interval '15 minutes'
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';

  v_err := false;
  BEGIN
    PERFORM public.start_tournament_match_checked(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'::uuid,
      '1'::text
    );
  EXCEPTION WHEN SQLSTATE '23514' THEN
    -- player_rest_conflict
    v_err := true;
  END;

  IF NOT v_err THEN
    RAISE EXCEPTION 'TEST 7b FAILED: start_tournament_match_checked must enforce tournament min_rest_minutes (25m)';
  END IF;
END;
$$;

ROLLBACK;
