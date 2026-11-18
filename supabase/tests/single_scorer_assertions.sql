\set ON_ERROR_STOP on

-- Run after result_revision_bootstrap.sql, single_scorer_harness_setup.sql,
-- and 20261114100000_enforce_single_active_tournament_scorer.sql.

BEGIN;

INSERT INTO public.players (id, full_name, email, role)
VALUES
  ('30000000-0000-0000-0000-000000000021', 'Scorer One', 'scorer1@example.test', 'umpire'),
  ('30000000-0000-0000-0000-000000000022', 'Scorer Two', 'scorer2@example.test', 'umpire'),
  ('30000000-0000-0000-0000-000000000023', 'Ordinary Player', 'player@example.test', 'player')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.tournaments (id, status, start_date, venue, format_family, tournament_type)
VALUES ('10000000-0000-0000-0000-000000000021', 'published', CURRENT_DATE, 'Test Hall', 'knockout', 'singles')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tournament_matches (
  id, tournament_id, match_code, status, team1_label, team2_label,
  points_to_win, best_of_sets, golden_point
) VALUES (
  '20000000-0000-0000-0000-000000000021',
  '10000000-0000-0000-0000-000000000021',
  'LOCK-1', 'scheduled', 'Side A', 'Side B', 21, 3, 30
)
ON CONFLICT (id) DO UPDATE SET status = 'scheduled', umpired_by = NULL;

INSERT INTO public.tournament_officials (tournament_id, user_id, role)
SELECT '10000000-0000-0000-0000-000000000021', scorer_id, 'UMPIRE'
FROM unnest(ARRAY[
  '30000000-0000-0000-0000-000000000021'::uuid,
  '30000000-0000-0000-0000-000000000022'::uuid
]) AS scorer_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.tournament_officials existing
  WHERE existing.tournament_id = '10000000-0000-0000-0000-000000000021'
    AND existing.user_id = scorer_id
);

-- The first actor starting a live match becomes its scorer.
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000021', false);
UPDATE public.tournament_matches
SET status = 'in_progress'
WHERE id = '20000000-0000-0000-0000-000000000021';

DO $$
DECLARE
  v_scorer uuid;
BEGIN
  SELECT umpired_by INTO v_scorer
  FROM public.tournament_matches
  WHERE id = '20000000-0000-0000-0000-000000000021';

  IF v_scorer <> '30000000-0000-0000-0000-000000000021'::uuid THEN
    RAISE EXCEPTION 'first active scorer was not claimed: %', v_scorer;
  END IF;
END;
$$;

SELECT public.upsert_live_match_by_id(
  '20000000-0000-0000-0000-000000000021',
  '{"isFriendly":false,"status":"in_progress","score":[1,0]}'::jsonb
);

-- A second authorized official cannot publish or take over the active match.
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000022', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.upsert_live_match_by_id(
      '20000000-0000-0000-0000-000000000021',
      '{"isFriendly":false,"status":"in_progress","score":[0,1]}'::jsonb
    );
    RAISE EXCEPTION 'second scorer unexpectedly published';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN
      IF SQLERRM NOT LIKE 'scorer_locked:%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    UPDATE public.tournament_matches
    SET umpired_by = '30000000-0000-0000-0000-000000000022'
    WHERE id = '20000000-0000-0000-0000-000000000021';
    RAISE EXCEPTION 'direct scorer transfer unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN
      IF SQLERRM NOT LIKE 'scorer_locked:%'
        AND SQLERRM NOT LIKE 'scorer_transfer_requires_review:%' THEN
        RAISE;
      END IF;
  END;
END;
$$;

-- An ordinary authenticated player is rejected before scorer ownership matters.
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000023', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.upsert_live_match_by_id(
      '20000000-0000-0000-0000-000000000021',
      '{"isFriendly":false,"status":"in_progress"}'::jsonb
    );
    RAISE EXCEPTION 'unauthorized player unexpectedly published';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM <> 'Not authorized to score this tournament match' THEN
        RAISE;
      END IF;
  END;
END;
$$;

-- Friendly broadcasts preserve their existing authenticated-user behavior.
SELECT public.upsert_live_match_by_id(
  'friendly-scorer-compatibility',
  '{"isFriendly":true,"status":"in_progress","score":[3,2]}'::jsonb
);

SELECT set_config('request.jwt.claim.sub', '', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.upsert_live_match_by_id(
      'friendly-anonymous-denied',
      '{"isFriendly":true,"status":"in_progress"}'::jsonb
    );
    RAISE EXCEPTION 'anonymous friendly publisher unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM <> 'Authentication required' THEN
        RAISE;
      END IF;
  END;
END;
$$;

ROLLBACK;

SELECT 'single scorer assertions passed' AS result;
