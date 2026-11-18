-- Sports-site plan item 6 (option B, approved 14 Nov 2026):
-- keep each tournament match's point-by-point log after the match ends.
--
-- Before this, BwfMatchState.pointLog lived only in site_data.live_matches and
-- was deleted when the match finished. Now every authorised live-score write
-- (upsert_live_match_by_id, which already enforces the single active scorer)
-- also stores a compacted copy of the full log in one row per match. Because
-- each write carries the whole log, a lost or repeated write heals itself on
-- the next point, and undo simply writes a shorter log.
--
-- Compact entry: [game, side (1|2, 0 = let/fault), t1, t2, server (1|2), ts_ms]

CREATE TABLE IF NOT EXISTS public.tournament_match_point_logs (
  match_id    uuid PRIMARY KEY REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  revision    integer NOT NULL DEFAULT 1,
  points      jsonb NOT NULL DEFAULT '[]'::jsonb,
  point_count integer NOT NULL DEFAULT 0,
  final       boolean NOT NULL DEFAULT false,
  superseded_by_correction boolean NOT NULL DEFAULT false,
  recorded_by uuid,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_match_point_logs ENABLE ROW LEVEL SECURITY;

-- Visible exactly when the match itself is visible (tournament_matches RLS
-- applies inside the subquery). No client INSERT/UPDATE/DELETE policies.
DROP POLICY IF EXISTS "point_logs_read_when_match_visible" ON public.tournament_match_point_logs;
CREATE POLICY "point_logs_read_when_match_visible" ON public.tournament_match_point_logs
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.tournament_matches m WHERE m.id = match_id));

REVOKE INSERT, UPDATE, DELETE ON public.tournament_match_point_logs FROM anon, authenticated;
GRANT SELECT ON public.tournament_match_point_logs TO anon, authenticated;

-- ── Compaction ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compact_point_log(p_log jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_array(
        COALESCE((e->>'gameNum')::int, 1),
        CASE e->>'team' WHEN '1' THEN 1 WHEN '2' THEN 2 ELSE 0 END,
        COALESCE((e->>'t1Score')::int, 0),
        COALESCE((e->>'t2Score')::int, 0),
        COALESCE((e->>'serverTeam')::int, 0),
        COALESCE((e->>'ts')::bigint, 0)
      )
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_log) = 'array' THEN p_log ELSE '[]'::jsonb END)
       WITH ORDINALITY AS x(e, ord)
$$;

REVOKE ALL ON FUNCTION public.compact_point_log(jsonb) FROM PUBLIC, anon, authenticated;

-- ── Store on every authorised live write ─────────────────────────────────────
-- Same body as 20261114100000 plus the point-log block, which can never make
-- the live-score write itself fail.
CREATE OR REPLACE FUNCTION public.upsert_live_match_by_id(
  p_match_id text,
  match_state jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_friendly boolean := COALESCE((match_state->>'isFriendly')::boolean, true);
  v_match_id uuid;
  v_match public.tournament_matches%ROWTYPE;
  v_authorized boolean := false;
  v_points jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  IF NOT v_is_friendly THEN
    BEGIN
      v_match_id := p_match_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid tournament match identifier';
    END;

    SELECT * INTO v_match
    FROM public.tournament_matches
    WHERE id = v_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Tournament match not found';
    END IF;

    IF v_match.status NOT IN ('in_progress', 'playing', 'ready', 'warming_up', 'paused') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'match_not_live: start the match before publishing live scores';
    END IF;

    SELECT (
      EXISTS (
        SELECT 1 FROM public.players
        WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
      )
      OR EXISTS (
        SELECT 1 FROM public.tournament_officials
        WHERE tournament_id = v_match.tournament_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.umpire_assignments assignment
        WHERE assignment.user_id = auth.uid()
          AND assignment.tournament_match_id = v_match.id
      )
    ) INTO v_authorized;

    IF NOT v_authorized THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to score this tournament match';
    END IF;

    IF v_match.umpired_by IS NULL THEN
      UPDATE public.tournament_matches
      SET umpired_by = auth.uid()
      WHERE id = v_match.id;
    ELSIF v_match.umpired_by <> auth.uid() THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'scorer_locked: this match already has another active scorer';
    END IF;

    -- Point log (plan item 6). Never allowed to break live scoring.
    IF match_state ? 'pointLog' THEN
      BEGIN
        v_points := public.compact_point_log(match_state->'pointLog');
        INSERT INTO public.tournament_match_point_logs AS l (match_id, points, point_count, recorded_by)
        VALUES (v_match.id, v_points, jsonb_array_length(v_points), auth.uid())
        ON CONFLICT (match_id) DO UPDATE
          SET points      = EXCLUDED.points,
              point_count = EXCLUDED.point_count,
              recorded_by = EXCLUDED.recorded_by,
              revision    = l.revision + 1,
              updated_at  = now()
          WHERE NOT l.final AND l.points IS DISTINCT FROM EXCLUDED.points;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'point log not stored for %: %', v_match.id, SQLERRM;
      END;
    END IF;
  END IF;

  INSERT INTO public.site_data (key, value)
  VALUES ('live_matches', jsonb_build_object(p_match_id, match_state))
  ON CONFLICT (key) DO UPDATE
  SET value = public.site_data.value || jsonb_build_object(p_match_id, match_state);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_live_match_by_id(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_live_match_by_id(text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.upsert_live_match_by_id(text, jsonb)
IS 'Publishes a live-score snapshot; tournament matches accept writes only from their single active scorer, and their point log is kept in tournament_match_point_logs.';

-- ── Freeze on finish; flag later score corrections ───────────────────────────
CREATE OR REPLACE FUNCTION public.sync_point_log_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('completed', 'walkover', 'cancelled')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.tournament_match_point_logs SET final = true WHERE match_id = NEW.id AND NOT final;
  ELSIF OLD.status IN ('completed', 'walkover')
     AND NEW.status = OLD.status
     AND (NEW.score IS DISTINCT FROM OLD.score OR NEW.sets_history IS DISTINCT FROM OLD.sets_history) THEN
    UPDATE public.tournament_match_point_logs SET superseded_by_correction = true WHERE match_id = NEW.id;
  ELSIF OLD.status IN ('completed', 'walkover') AND NEW.status NOT IN ('completed', 'walkover', 'cancelled') THEN
    -- A result reopened for play: allow the scorer to continue the same log.
    UPDATE public.tournament_match_point_logs SET final = false WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_point_log_lifecycle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tournament_matches_point_log_lifecycle ON public.tournament_matches;
CREATE TRIGGER tournament_matches_point_log_lifecycle
AFTER UPDATE OF status, score, sets_history
ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.sync_point_log_lifecycle();
