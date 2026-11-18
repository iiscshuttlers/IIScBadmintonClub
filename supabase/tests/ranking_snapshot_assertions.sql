\set ON_ERROR_STOP on
-- Plan item 10: club rank rule (mirrors client rankingUtils.calculateRanksMap),
-- idempotent snapshots, and movement labels. Run after the migrations.

INSERT INTO public.players (id, role, elo_rating, win_loss_record, singles_elo, deleted_at) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'player', 1300, '5W - 1L', 1250, NULL),
  ('00000000-0000-0000-0000-0000000000b2', 'player', 1300, '5W - 1L', NULL, NULL),
  ('00000000-0000-0000-0000-0000000000b3', 'player', 1300, '1W - 1L', NULL, NULL),
  ('00000000-0000-0000-0000-0000000000b4', 'player', 1250, '0W - 0L', NULL, NULL),
  ('00000000-0000-0000-0000-0000000000b5', 'player', 1200, '9W - 0L', NULL, NULL),
  ('00000000-0000-0000-0000-0000000000b6', 'player', 1400, '3-1', NULL, now());

DO $$
DECLARE
  r record;
  n integer;
BEGIN
  -- Same as the client rule: 1, 1, 3, 4; 1200 baseline and deleted players excluded.
  FOR r IN SELECT * FROM public.current_club_ranks() WHERE list = 'overall' LOOP
    CASE r.player_id::text
      WHEN '00000000-0000-0000-0000-0000000000b1' THEN ASSERT r.rank = 1, 'b1 rank 1';
      WHEN '00000000-0000-0000-0000-0000000000b2' THEN ASSERT r.rank = 1, 'b2 shares rank 1';
      WHEN '00000000-0000-0000-0000-0000000000b3' THEN ASSERT r.rank = 3, 'b3 rank 3 (skip)';
      WHEN '00000000-0000-0000-0000-0000000000b4' THEN ASSERT r.rank = 4, 'b4 rank 4';
      ELSE NULL;
    END CASE;
  END LOOP;
  ASSERT (SELECT count(*) FROM public.current_club_ranks() WHERE list = 'overall'
          AND player_id IN ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000b6')) = 0,
    'baseline 1200 and deleted players are unranked';
  ASSERT public.record_win_pct('3-1') = 0.75 AND public.record_win_pct('0W - 0L') = -1 AND public.record_win_pct(NULL) = -1,
    'win % parsing matches the client';

  -- Snapshots are idempotent per date.
  DELETE FROM public.ranking_snapshots;
  n := public.take_ranking_snapshot('2026-11-01');
  ASSERT n > 0, 'snapshot written';
  ASSERT public.take_ranking_snapshot('2026-11-01') = 0, 'same date is a no-op';

  -- Before any 6-day-old snapshot exists → status none.
  DELETE FROM public.ranking_snapshots;
  PERFORM public.take_ranking_snapshot((now() AT TIME ZONE 'Asia/Kolkata')::date);
  ASSERT (SELECT bool_and(status = 'none') FROM public.ranking_movement('overall')), 'no arrows before a week';

  -- A week-old snapshot where b3 was 1st and b1 absent → b3 down 2, b1 new, b2 moved.
  DELETE FROM public.ranking_snapshots;
  INSERT INTO public.ranking_snapshots (snapshot_date, list, player_id, rank, rating) VALUES
    ((now() AT TIME ZONE 'Asia/Kolkata')::date - 7, 'overall', '00000000-0000-0000-0000-0000000000b3', 1, 1300),
    ((now() AT TIME ZONE 'Asia/Kolkata')::date - 7, 'overall', '00000000-0000-0000-0000-0000000000b2', 2, 1290),
    ((now() AT TIME ZONE 'Asia/Kolkata')::date - 30, 'overall', '00000000-0000-0000-0000-0000000000b4', 2, 1240);
  FOR r IN SELECT * FROM public.ranking_movement('overall') LOOP
    CASE r.player_id::text
      WHEN '00000000-0000-0000-0000-0000000000b3' THEN ASSERT r.status = 'moved' AND r.delta = -2 AND r.peak_rank = 1, 'b3 down 2, peak 1';
      WHEN '00000000-0000-0000-0000-0000000000b2' THEN ASSERT r.status = 'moved' AND r.delta = 1, 'b2 up 1';
      WHEN '00000000-0000-0000-0000-0000000000b1' THEN ASSERT r.status = 'new', 'b1 new';
      WHEN '00000000-0000-0000-0000-0000000000b4' THEN ASSERT r.status = 're', 'b4 re-entry';
      ELSE NULL;
    END CASE;
  END LOOP;
END $$;

-- Clients can read but not write snapshots.
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM 1 FROM public.ranking_snapshots LIMIT 1;
  BEGIN
    INSERT INTO public.ranking_snapshots (snapshot_date, list, player_id, rank, rating)
    VALUES ('2026-01-01', 'overall', '00000000-0000-0000-0000-0000000000b1', 1, 1);
    RAISE EXCEPTION 'direct insert should be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT 'ranking_snapshot_assertions passed' AS result;
