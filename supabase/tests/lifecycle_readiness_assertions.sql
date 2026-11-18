-- lifecycle_readiness_assertions.sql
-- Verifies Work Package 4:
-- 1. verify_tournament_readiness RPC for announce, publish_draw, start_play
-- 2. Blocker codes, counts, entity_ids, and fix tabs
-- 3. Trigger assert_tournament_ready_for_active blocking direct REST status='active' updates
-- 4. transition_tournament_lifecycle RPC authorization, audit logging, and state changes

\set ON_ERROR_STOP on

BEGIN;

-- 1. Setup mock auth and test users
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.email', 'admin@iisc.ac.in', true);

INSERT INTO public.players (id, full_name, email, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tournament Director', 'admin@iisc.ac.in', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Court Manager', 'official@iisc.ac.in', 'member'),
  ('33333333-3333-3333-3333-333333333333', 'Regular Member', 'member@iisc.ac.in', 'member'),
  ('44444444-4444-4444-4444-444444444444', 'Player One', 'player1@iisc.ac.in', 'member'),
  ('55555555-5555-5555-5555-555555555555', 'Player Two', 'player2@iisc.ac.in', 'member');

-- ========================================================
-- TEST 1: STAGE 1 — ANNOUNCE GATE
-- ========================================================

-- Insert bare tournament missing venue and name
INSERT INTO public.tournaments (
  id,
  name,
  status,
  start_date,
  venue
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '',
  'draft',
  NULL,
  ''
);

DO $$
DECLARE
  v_report JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'announce');
  IF (v_report->>'allowed')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST 1a FAILED: Bare tournament must not pass announce gate';
  END IF;

  IF jsonb_array_length(v_report->'blockers') < 3 THEN
    RAISE EXCEPTION 'TEST 1b FAILED: Expected missing name, start_date and venue blockers';
  END IF;
END $$;

-- Configure tournament details
UPDATE public.tournaments
SET name = 'Championship 2026',
    start_date = CURRENT_DATE,
    venue = 'Main Sports Complex',
    unavailable_court_periods = jsonb_build_array(
      jsonb_build_object(
        'court', 'Court 1',
        'start', '2026-11-20T10:00:00Z',
        'end', '2026-11-20T11:00:00Z',
        'reason', 'Maintenance'
      )
    ),
    estimated_match_minutes = 30
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $$
DECLARE
  v_report JSONB;
  v_receipt JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'announce');
  IF (v_report->>'allowed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 1c FAILED: Configured tournament must pass announce gate';
  END IF;

  -- Execute stage transition
  v_receipt := public.transition_tournament_lifecycle('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'announce');
  IF (v_receipt->>'applied')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 1d FAILED: transition_tournament_lifecycle announce failed';
  END IF;
END $$;

-- Verify admin_log was created for announce transition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_logs
    WHERE action = 'tournament_lifecycle_transition'
      AND details->>'lifecycle_action' = 'announce'
  ) THEN
    RAISE EXCEPTION 'TEST 1e FAILED: Expected audit log for announce transition';
  END IF;
END $$;

-- ========================================================
-- TEST 2: STAGE 2 — PUBLISH DRAW GATE
-- ========================================================

-- publish_draw must be blocked because no entrants and no fixtures exist
DO $$
DECLARE
  v_report JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'publish_draw');
  IF (v_report->>'allowed')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST 2a FAILED: publish_draw must fail with no entrants/fixtures';
  END IF;
END $$;

-- One entrant is still insufficient for a playable draw.
INSERT INTO public.tournament_participants (id, tournament_id, category, display_name, player_id, partner_id)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MS', 'Player 1', '44444444-4444-4444-4444-444444444444', NULL);

DO $$
DECLARE
  v_report JSONB;
  v_entrant_blocker JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'publish_draw');
  SELECT elem INTO v_entrant_blocker
  FROM jsonb_array_elements(v_report->'blockers') elem
  WHERE elem->>'code' = 'EMPTY_ENTRANTS';

  IF v_entrant_blocker IS NULL OR (v_entrant_blocker->>'count')::integer <> 1 THEN
    RAISE EXCEPTION 'TEST 2b FAILED: A one-entrant draw must remain blocked';
  END IF;
END $$;

-- Add a second doubles entrant without a partner.
INSERT INTO public.tournament_participants (id, tournament_id, category, display_name, player_id, partner_id)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MD', 'Player 2', '55555555-5555-5555-5555-555555555555', NULL);

-- Check that UNRESOLVED_PAIRS is reported
DO $$
DECLARE
  v_report JSONB;
  v_has_unresolved BOOLEAN := false;
  v_elem JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'publish_draw');
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_report->'blockers')
  LOOP
    IF v_elem->>'code' = 'UNRESOLVED_PAIRS' THEN
      v_has_unresolved := true;
    END IF;
  END LOOP;

  IF NOT v_has_unresolved THEN
    RAISE EXCEPTION 'TEST 2c FAILED: Expected UNRESOLVED_PAIRS blocker for unpartnered doubles entry';
  END IF;
END $$;

-- Resolve partner assignment
UPDATE public.tournament_participants
SET partner_id = '44444444-4444-4444-4444-444444444444'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Add match with invalid scoring (best_of_sets = 2)
INSERT INTO public.tournament_matches (
  id,
  tournament_id,
  category,
  round_name,
  match_number,
  status,
  player1_id,
  player2_id,
  points_to_win,
  best_of_sets
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'MS',
  'Round 1',
  1,
  'pending',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  21,
  2
);

-- Check that INVALID_SCORING is reported
DO $$
DECLARE
  v_report JSONB;
  v_has_invalid_scoring BOOLEAN := false;
  v_elem JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'publish_draw');
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_report->'blockers')
  LOOP
    IF v_elem->>'code' = 'INVALID_SCORING' THEN
      v_has_invalid_scoring := true;
    END IF;
  END LOOP;

  IF NOT v_has_invalid_scoring THEN
    RAISE EXCEPTION 'TEST 2d FAILED: Expected INVALID_SCORING blocker for best_of_sets=2';
  END IF;
END $$;

-- Fix scoring rules
UPDATE public.tournament_matches
SET best_of_sets = 3
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- Now publish_draw must be allowed
DO $$
DECLARE
  v_report JSONB;
  v_receipt JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'publish_draw');
  IF (v_report->>'allowed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 2e FAILED: publish_draw should be allowed now';
  END IF;

  v_receipt := public.transition_tournament_lifecycle('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'publish_draw');
  IF (v_receipt->>'applied')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 2f FAILED: transition_tournament_lifecycle publish_draw failed';
  END IF;
END $$;

-- Verify show_brackets and show_participants are set to true
DO $$
DECLARE
  v_brackets BOOLEAN;
  v_participants BOOLEAN;
BEGIN
  SELECT show_brackets, show_participants INTO v_brackets, v_participants
  FROM public.tournaments
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  IF NOT v_brackets OR NOT v_participants THEN
    RAISE EXCEPTION 'TEST 2g FAILED: show_brackets and show_participants must be true after publish_draw';
  END IF;
END $$;

-- ========================================================
-- TEST 3: STAGE 3 — START PLAY GATE & TRIGGER PROTECTION
-- ========================================================

-- start_play must fail because match has no court_number and scheduled_at
DO $$
DECLARE
  v_report JSONB;
  v_has_unscheduled BOOLEAN := false;
  v_elem JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'start_play');
  IF (v_report->>'allowed')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST 3a FAILED: start_play must be blocked when match is unscheduled';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_report->'blockers')
  LOOP
    IF v_elem->>'code' = 'UNSCHEDULED_PLAYABLE_MATCHES' THEN
      v_has_unscheduled := true;
    END IF;
  END LOOP;

  IF NOT v_has_unscheduled THEN
    RAISE EXCEPTION 'TEST 3b FAILED: Expected UNSCHEDULED_PLAYABLE_MATCHES blocker';
  END IF;
END $$;

-- Schedule match during court blackout (Court 1, 10:15 - blackout is 10:00 to 11:00)
UPDATE public.tournament_matches
SET court_number = 'Court 1',
    scheduled_at = '2026-11-20T10:15:00Z'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- verify HARD_SCHEDULE_CONFLICT blocker
DO $$
DECLARE
  v_report JSONB;
  v_has_blackout BOOLEAN := false;
  v_elem JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'start_play');
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_report->'blockers')
  LOOP
    IF v_elem->>'code' = 'HARD_SCHEDULE_CONFLICT' THEN
      v_has_blackout := true;
    END IF;
  END LOOP;

  IF NOT v_has_blackout THEN
    RAISE EXCEPTION 'TEST 3c FAILED: Expected HARD_SCHEDULE_CONFLICT blocker for match in blackout window';
  END IF;
END $$;

-- TEST 3d: Direct REST update trigger must reject UPDATE tournaments SET status = 'active'
DO $$
DECLARE
  v_caught BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.tournaments
    SET status = 'active'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'TEST 3d FAILED: Direct REST update to status=active must be blocked by trigger with SQLSTATE 23514';
  END IF;
END $$;

-- Move match outside blackout period (Court 1, 11:30)
UPDATE public.tournament_matches
SET scheduled_at = '2026-11-20T11:30:00Z'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- Now start_play must be allowed!
DO $$
DECLARE
  v_report JSONB;
  v_receipt JSONB;
BEGIN
  v_report := public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'start_play');
  IF (v_report->>'allowed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 3e FAILED: start_play should be allowed when scheduled outside blackout';
  END IF;

  v_receipt := public.transition_tournament_lifecycle('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'start_play');
  IF (v_receipt->>'applied')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 3f FAILED: transition_tournament_lifecycle start_play failed';
  END IF;
END $$;

-- Verify tournament status is active
DO $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.tournaments
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'TEST 3g FAILED: Expected tournament status=active, found %', v_status;
  END IF;
END $$;

-- ========================================================
-- TEST 4: AUTHORIZATION ENFORCEMENT
-- ========================================================

-- Regular member cannot transition tournament lifecycle
SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
SELECT set_config('request.jwt.claim.email', 'member@iisc.ac.in', true);

DO $$
DECLARE
  v_transition_caught BOOLEAN := false;
  v_readiness_caught BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.transition_tournament_lifecycle('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'publish_draw');
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_transition_caught := true;
  END;

  BEGIN
    PERFORM public.verify_tournament_readiness('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'start_play');
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_readiness_caught := true;
  END;

  IF NOT v_transition_caught OR NOT v_readiness_caught THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Regular member must be rejected by lifecycle transition and readiness inspection';
  END IF;
END $$;

ROLLBACK;

\echo 'ALL LIFECYCLE READINESS ASSERTIONS PASSED SUCCESSFULLY!'

