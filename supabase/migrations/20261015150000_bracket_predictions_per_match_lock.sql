-- Bracket predictions: lock each match when it starts, instead of locking the
-- whole category at its first match.
--  * A trigger rejects any insert/update that adds, changes or removes a pick
--    for a match that has already left scheduled/pending.
--  * Rows stay private to their owner; the leaderboard reads through
--    bracket_leaderboard(), which only exposes picks for started matches, so
--    nobody can copy picks for matches still open.

CREATE OR REPLACE FUNCTION public.bracket_started_codes(p_tournament uuid, p_category text)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(match_code), ARRAY[]::text[])
  FROM tournament_matches
  WHERE tournament_id = p_tournament
    AND category = p_category
    AND tie_id IS NULL
    AND match_code IS NOT NULL
    AND status NOT IN ('scheduled', 'pending');
$$;

CREATE OR REPLACE FUNCTION public.bracket_predictions_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN OLD.picks ELSE '{}'::jsonb END;
BEGIN
  FOREACH v_code IN ARRAY public.bracket_started_codes(NEW.tournament_id, NEW.category) LOOP
    IF (NEW.picks -> v_code) IS DISTINCT FROM (v_old -> v_code) THEN
      RAISE EXCEPTION 'Match % has started; its pick is locked', v_code USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bracket_predictions_guard ON public.bracket_predictions;
CREATE TRIGGER trg_bracket_predictions_guard
  BEFORE INSERT OR UPDATE ON public.bracket_predictions
  FOR EACH ROW EXECUTE FUNCTION public.bracket_predictions_guard();

-- Own rows only; per-match locking is enforced by the trigger.
DROP POLICY IF EXISTS "read own or locked predictions" ON public.bracket_predictions;
DROP POLICY IF EXISTS "read own predictions" ON public.bracket_predictions;
CREATE POLICY "read own predictions"
  ON public.bracket_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert own unlocked prediction" ON public.bracket_predictions;
DROP POLICY IF EXISTS "insert own prediction" ON public.bracket_predictions;
CREATE POLICY "insert own prediction"
  ON public.bracket_predictions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update own unlocked prediction" ON public.bracket_predictions;
DROP POLICY IF EXISTS "update own prediction" ON public.bracket_predictions;
CREATE POLICY "update own prediction"
  ON public.bracket_predictions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Deleting a row would drop locked picks, so only allow it before any match starts.
DROP POLICY IF EXISTS "delete own unlocked prediction" ON public.bracket_predictions;
CREATE POLICY "delete own unlocked prediction"
  ON public.bracket_predictions FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND NOT public.bracket_category_locked(tournament_id, category));

-- Everyone's picks, filtered to matches that have started (safe to reveal).
CREATE OR REPLACE FUNCTION public.bracket_leaderboard(p_tournament uuid, p_category text)
RETURNS TABLE (user_id uuid, full_name text, picks jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT bp.user_id,
         p.full_name,
         COALESCE((
           SELECT jsonb_object_agg(k, v)
           FROM jsonb_each(bp.picks) AS e(k, v)
           WHERE k = ANY (public.bracket_started_codes(p_tournament, p_category))
         ), '{}'::jsonb)
  FROM bracket_predictions bp
  LEFT JOIN players p ON p.id = bp.user_id
  WHERE bp.tournament_id = p_tournament AND bp.category = p_category;
$$;

GRANT EXECUTE ON FUNCTION public.bracket_started_codes(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bracket_leaderboard(uuid, text) TO authenticated;
