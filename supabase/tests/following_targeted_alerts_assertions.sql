-- following_targeted_alerts_assertions.sql
-- Verifies Work Package 9:
-- 1. user_tournament_subscriptions CRUD & RLS
-- 2. Deduplication across overlapping player and tournament follows (1 alert for 1 event)
-- 3. Muted subscription and quiet hours suppression
-- 4. Retried finalization / idempotency (same version does not duplicate alert)
-- 5. Canonical match route deep-links (/tournaments/:id/matches/:matchId)

\set ON_ERROR_STOP on

BEGIN;

-- 1. Setup mock auth and test users
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.email', 'user1@iisc.ac.in', true);

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user1@iisc.ac.in'),
  ('22222222-2222-2222-2222-222222222222', 'user2@iisc.ac.in'),
  ('33333333-3333-3333-3333-333333333333', 'user3@iisc.ac.in'),
  ('44444444-4444-4444-4444-444444444444', 'star@iisc.ac.in'),
  ('55555555-5555-5555-5555-555555555555', 'beta@iisc.ac.in'),
  ('66666666-6666-6666-6666-666666666666', 'quiet@iisc.ac.in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.players (id, full_name, email, role, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dual Follower User', 'user1@iisc.ac.in', 'member', false, '22:00', '07:00'),
  ('22222222-2222-2222-2222-222222222222', 'Muted Tournament Follower', 'user2@iisc.ac.in', 'member', false, '22:00', '07:00'),
  ('33333333-3333-3333-3333-333333333333', 'Results Disabled Follower', 'user3@iisc.ac.in', 'member', false, '22:00', '07:00'),
  ('44444444-4444-4444-4444-444444444444', 'Player Star Alpha', 'star@iisc.ac.in', 'member', false, '22:00', '07:00'),
  ('55555555-5555-5555-5555-555555555555', 'Player Competitor Beta', 'beta@iisc.ac.in', 'member', false, '22:00', '07:00'),
  ('66666666-6666-6666-6666-666666666666', 'Quiet Night Follower', 'quiet@iisc.ac.in', 'member', true, '00:00', '23:59'); -- active quiet hours all day for test

-- Create test tournament
INSERT INTO public.tournaments (
  id,
  name,
  status,
  start_date,
  venue
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Inter-Department Open',
  'draft',
  CURRENT_DATE,
  'Gymkhana'
);

-- Create test match
INSERT INTO public.tournament_matches (
  id,
  tournament_id,
  category,
  round_name,
  match_number,
  status,
  player1_id,
  player2_id,
  team1_label,
  team2_label,
  court_number,
  scheduled_at,
  result_revision
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'MS',
  'Quarterfinal',
  1,
  'scheduled',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  'Star Alpha',
  'Competitor Beta',
  '1',
  now() + interval '1 hour',
  1
);

-- ========================================================
-- TEST 1: SETUP SUBSCRIPTIONS
-- ========================================================

-- User 1 follows Tournament AND follows Player Star Alpha (Overlapping follow)
INSERT INTO public.user_tournament_subscriptions (user_id, tournament_id, notify_result, is_muted)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, false);

INSERT INTO public.user_player_subscriptions (user_id, player_id, notify_result, is_muted)
VALUES ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', true, false);

-- User 2 follows Tournament, but has is_muted = true
INSERT INTO public.user_tournament_subscriptions (user_id, tournament_id, notify_result, is_muted)
VALUES ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, true);

-- User 3 follows Player Star Alpha, but has notify_result = false
INSERT INTO public.user_player_subscriptions (user_id, player_id, notify_result, is_muted)
VALUES ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', false, false);

-- User 6 follows Player Star Alpha, but is in quiet hours
INSERT INTO public.user_player_subscriptions (user_id, player_id, notify_result, is_muted)
VALUES ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', true, false);

-- ========================================================
-- TEST 2: AUTHORITATIVE ALERT DISPATCH & DEDUPLICATION
-- ========================================================

DO $$
DECLARE
  v_res JSONB;
  v_user1_notif_count INTEGER;
  v_user2_notif_count INTEGER;
  v_user3_notif_count INTEGER;
  v_user6_notif_count INTEGER;
  v_notif_link TEXT;
BEGIN
  -- Dispatch match result alert (version 1)
  v_res := public.dispatch_authoritative_match_alert(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'result',
    '🏸 Match Result: Star Alpha vs Competitor Beta',
    'Final score: 21-19, 21-17',
    1
  );

  -- 1. User 1 must receive EXACTLY ONE notification despite overlapping follows
  SELECT COUNT(*), max(link) INTO v_user1_notif_count, v_notif_link
  FROM public.notifications
  WHERE user_id = '11111111-1111-1111-1111-111111111111';

  IF v_user1_notif_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2a FAILED: Expected exactly 1 notification for dual follower, got %', v_user1_notif_count;
  END IF;

  -- Verify canonical deep link
  IF v_notif_link <> '/tournaments/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/matches/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' THEN
    RAISE EXCEPTION 'TEST 2b FAILED: Expected canonical match link, got %', v_notif_link;
  END IF;

  -- 2. User 2 (muted) must receive ZERO notifications
  SELECT COUNT(*) INTO v_user2_notif_count
  FROM public.notifications
  WHERE user_id = '22222222-2222-2222-2222-222222222222';

  IF v_user2_notif_count <> 0 THEN
    RAISE EXCEPTION 'TEST 2c FAILED: Muted subscriber received % notification(s)', v_user2_notif_count;
  END IF;

  -- 3. User 3 (notify_result=false) must receive ZERO notifications
  SELECT COUNT(*) INTO v_user3_notif_count
  FROM public.notifications
  WHERE user_id = '33333333-3333-3333-3333-333333333333';

  IF v_user3_notif_count <> 0 THEN
    RAISE EXCEPTION 'TEST 2d FAILED: Subscriber with notify_result=false received % notification(s)', v_user3_notif_count;
  END IF;

  -- 4. Quiet hours suppress push but preserve the in-app activity record.
  SELECT COUNT(*) INTO v_user6_notif_count
  FROM public.notifications
  WHERE user_id = '66666666-6666-6666-6666-666666666666';

  IF v_user6_notif_count <> 1 THEN
    RAISE EXCEPTION 'TEST 2e FAILED: Quiet hours must preserve one in-app notification, got %', v_user6_notif_count;
  END IF;

  IF to_regclass('public.scheduled_notifications') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.scheduled_notifications
       WHERE recipient_ids @> ARRAY['66666666-6666-6666-6666-666666666666'::UUID]
     ) THEN
    RAISE EXCEPTION 'TEST 2f FAILED: Quiet-hours user was queued for push';
  END IF;
END $$;

-- ========================================================
-- TEST 3: RETRIED OPERATION IDEMPOTENCY
-- ========================================================

-- Retrying the exact same version 1 alert must NOT send any additional notification
DO $$
DECLARE
  v_res JSONB;
  v_count INTEGER;
BEGIN
  v_res := public.dispatch_authoritative_match_alert(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'result',
    '🏸 Match Result: Star Alpha vs Competitor Beta',
    'Final score: 21-19, 21-17',
    1
  );

  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = '11111111-1111-1111-1111-111111111111';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Retried alert duplicated notification! Count is %', v_count;
  END IF;
END $$;

-- ========================================================
-- TEST 4: NEW REVISION VERSION PRODUCES UPDATED ALERT
-- ========================================================

-- A subsequent score correction / revision bump (version 2) should deliver an updated alert
DO $$
DECLARE
  v_res JSONB;
  v_count INTEGER;
BEGIN
  v_res := public.dispatch_authoritative_match_alert(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'result',
    '🏸 Corrected Result: Star Alpha vs Competitor Beta',
    'Corrected score: 21-19, 22-20',
    2
  );

  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = '11111111-1111-1111-1111-111111111111';

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: New revision 2 alert did not deliver! Count is %', v_count;
  END IF;
END $$;

-- ========================================================
-- TEST 5: SCHEDULE REVISIONS AND QUEUE CONTRACT
-- ========================================================

UPDATE public.tournament_matches
SET court_number = '2'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

UPDATE public.tournament_matches
SET scheduled_at = scheduled_at + interval '15 minutes'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

DO $$
DECLARE
  v_revision BIGINT;
  v_schedule_alerts INTEGER;
  v_pending_schedule INTEGER;
  v_cancelled_schedule INTEGER;
BEGIN
  SELECT schedule_revision INTO v_revision
  FROM public.tournament_matches
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  SELECT COUNT(*) INTO v_schedule_alerts
  FROM public.delivered_targeted_alerts
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
    AND match_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND event_type = 'schedule_change'
    AND channel = 'in_app';

  IF v_revision <> 2 OR v_schedule_alerts <> 2 THEN
    RAISE EXCEPTION 'TEST 5a FAILED: Expected two independently versioned schedule alerts, revision %, alerts %', v_revision, v_schedule_alerts;
  END IF;

  IF to_regclass('public.scheduled_notifications') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_pending_schedule
    FROM public.scheduled_notifications
    WHERE recipient_ids @> ARRAY['11111111-1111-1111-1111-111111111111'::UUID]
      AND channels = ARRAY['push']::TEXT[]
      AND audience = 'custom'
      AND link = '/tournaments/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/matches/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      AND match_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      AND event_type = 'schedule_change'
      AND event_version = 2
      AND expires_at > now()
      AND status = 'pending';

    SELECT COUNT(*) INTO v_cancelled_schedule
    FROM public.scheduled_notifications
    WHERE recipient_ids @> ARRAY['11111111-1111-1111-1111-111111111111'::UUID]
      AND match_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      AND event_type = 'schedule_change'
      AND event_version = 1
      AND status = 'cancelled';

    IF v_pending_schedule <> 1 OR v_cancelled_schedule <> 1 THEN
      RAISE EXCEPTION 'TEST 5b FAILED: Expected one live revision 2 queue row and one cancelled revision 1 row, pending %, cancelled %', v_pending_schedule, v_cancelled_schedule;
    END IF;
  END IF;

  BEGIN
    PERFORM public.dispatch_authoritative_match_alert(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'arbitrary_event',
      'Forged title',
      'Forged body',
      1
    );
    RAISE EXCEPTION 'TEST 5c FAILED: Unsupported event type was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END $$;

-- ========================================================
-- TEST 6: RLS AND FUNCTION PRIVILEGES
-- ========================================================

-- Switching auth to user 2
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

SET ROLE authenticated;

DO $$
DECLARE
  v_visible_count INTEGER;
  v_update_rejected BOOLEAN := false;
  v_dispatch_rejected BOOLEAN := false;
BEGIN
  SELECT COUNT(*) INTO v_visible_count
  FROM public.user_tournament_subscriptions;

  -- User 2 should only see their own 1 subscription
  IF v_visible_count <> 1 THEN
    RAISE EXCEPTION 'TEST 6a FAILED: RLS leaked other subscriptions to user 2. Visible: %', v_visible_count;
  END IF;

  BEGIN
    UPDATE public.user_tournament_subscriptions
    SET user_id = '33333333-3333-3333-3333-333333333333'
    WHERE user_id = '22222222-2222-2222-2222-222222222222';
  EXCEPTION WHEN insufficient_privilege THEN
    v_update_rejected := true;
  END;

  IF NOT v_update_rejected THEN
    RAISE EXCEPTION 'TEST 6b FAILED: Subscription owner could be changed through UPDATE';
  END IF;

  BEGIN
    PERFORM public.dispatch_authoritative_match_alert(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'result',
      'Forged title',
      'Forged body',
      999
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_dispatch_rejected := true;
  END;

  IF NOT v_dispatch_rejected THEN
    RAISE EXCEPTION 'TEST 6c FAILED: Authenticated user could call authoritative dispatch directly';
  END IF;
END $$;

RESET ROLE;

ROLLBACK;

\echo 'ALL FOLLOWING AND TARGETED ALERTS ASSERTIONS PASSED SUCCESSFULLY!'
