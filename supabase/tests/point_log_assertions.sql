\set ON_ERROR_STOP on
-- Plan item 6: tournament point logs are kept, compacted, frozen on finish,
-- flagged on later corrections, and never break the live-score write.
-- Run after the migrations in the isolated harness (same setup as
-- result_revision_assertions.sql).

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

INSERT INTO public.players (id, email, role)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'scorer@example.test', 'admin');

INSERT INTO public.tournaments (id, status, start_date, venue, format_family, tournament_type)
VALUES ('10000000-0000-0000-0000-0000000000a1', 'live', '2026-11-15', 'Gymkhana', 'OPEN_EVENT', 'open');

INSERT INTO public.tournament_matches (id, tournament_id, status, team1_label, team2_label, points_to_win, best_of_sets, golden_point)
VALUES ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 'in_progress', 'A', 'B', 21, 3, 30);

DO $$
DECLARE
  l public.tournament_match_point_logs%ROWTYPE;
  mid constant text := '20000000-0000-0000-0000-0000000000a1';
  state jsonb := jsonb_build_object(
    'isFriendly', false,
    'pointLog', jsonb_build_array(
      jsonb_build_object('gameNum', 1, 'team', 1, 't1Score', 1, 't2Score', 0, 'serverTeam', 1, 'ts', 1000, 'prev', jsonb_build_object('x', 1)),
      jsonb_build_object('gameNum', 1, 'team', 'let', 't1Score', 1, 't2Score', 0, 'serverTeam', 1, 'ts', 2000),
      jsonb_build_object('gameNum', 1, 'team', 2, 't1Score', 1, 't2Score', 1, 'serverTeam', 2, 'ts', 3000)
    )
  );
BEGIN
  PERFORM public.upsert_live_match_by_id(mid, state);
  SELECT * INTO l FROM public.tournament_match_point_logs WHERE match_id = mid::uuid;
  ASSERT FOUND, 'log row created';
  ASSERT l.point_count = 3, 'three entries stored';
  ASSERT l.points = '[[1,1,1,0,1,1000],[1,0,1,0,1,2000],[1,2,1,1,2,3000]]'::jsonb, 'compacted, prev snapshot dropped, let = 0';
  ASSERT l.revision = 1, 'first revision';

  -- Same log again: no new revision.
  PERFORM public.upsert_live_match_by_id(mid, state);
  SELECT * INTO l FROM public.tournament_match_point_logs WHERE match_id = mid::uuid;
  ASSERT l.revision = 1, 'identical write is a no-op';

  -- Undo: a shorter log replaces the old one.
  PERFORM public.upsert_live_match_by_id(mid, jsonb_set(state, '{pointLog}', (state->'pointLog') - 2));
  SELECT * INTO l FROM public.tournament_match_point_logs WHERE match_id = mid::uuid;
  ASSERT l.point_count = 2 AND l.revision = 2, 'undo replaces the snapshot';

  -- A malformed log never blocks the live write.
  PERFORM public.upsert_live_match_by_id(mid, jsonb_set(state, '{pointLog}', '"oops"'::jsonb));
  SELECT * INTO l FROM public.tournament_match_point_logs WHERE match_id = mid::uuid;
  ASSERT l.point_count = 0, 'non-array log stored as empty, write succeeded';

  PERFORM public.upsert_live_match_by_id(mid, state);

  -- Finishing freezes the log.
  UPDATE public.tournament_matches SET status = 'completed', winner_side = 1, score = '21-15, 21-10' WHERE id = mid::uuid;
  SELECT * INTO l FROM public.tournament_match_point_logs WHERE match_id = mid::uuid;
  ASSERT l.final, 'final after completion';
  ASSERT l.point_count = 3, 'log kept after the match ends';

  -- A later score correction flags the log.
  UPDATE public.tournament_matches SET score = '21-15, 21-12' WHERE id = mid::uuid;
  SELECT * INTO l FROM public.tournament_match_point_logs WHERE match_id = mid::uuid;
  ASSERT l.superseded_by_correction, 'corrections are flagged';
END $$;

-- Clients cannot write logs directly.
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.tournament_match_point_logs (match_id) VALUES ('20000000-0000-0000-0000-0000000000a1');
    RAISE EXCEPTION 'direct insert should be refused';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT 'point_log_assertions passed' AS result;
