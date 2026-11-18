\set ON_ERROR_STOP on
-- Assertions for 20261115120000_ranked_only_elo_replay.sql (run after elo_replay_setup.sql,
-- the live helper functions and the migration).
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', false);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

DO $$
DECLARE n int; p1 record; p3 record;
BEGIN
  PERFORM public.recalculate_tournament_elo();

  -- Unranked tournament contributes nothing.
  SELECT count(*) INTO n FROM elo_calculation_logs WHERE match_uuid = '20000000-0000-0000-0000-000000000002';
  IF n <> 0 THEN RAISE EXCEPTION 'unranked match moved Elo (% logs)', n; END IF;

  -- Ranked singles moved singles ratings.
  SELECT * INTO p1 FROM players WHERE id = '00000000-0000-0000-0000-000000000001';
  IF p1.singles_matches_played <> 1 OR p1.singles_elo <= 1200 THEN
    RAISE EXCEPTION 'ranked singles not applied: %', p1;
  END IF;

  -- Doubles bucket, not mixed.
  SELECT * INTO p3 FROM players WHERE id = '00000000-0000-0000-0000-000000000003';
  IF p3.doubles_matches_played <> 1 OR p3.mixed_matches_played <> 0 THEN
    RAISE EXCEPTION 'doubles bucketed wrongly: doubles=% mixed=%', p3.doubles_matches_played, p3.mixed_matches_played;
  END IF;

  SELECT count(*) INTO n FROM elo_calculation_logs;
  IF n <> 6 THEN RAISE EXCEPTION 'expected 6 logs (2 singles + 4 doubles), got %', n; END IF;
END $$;

-- Non-admins are refused.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.recalculate_tournament_elo();
    RAISE EXCEPTION 'non-admin ran the replay';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF;
  END;
END $$;

SELECT 'elo replay alignment assertions passed' AS result;
