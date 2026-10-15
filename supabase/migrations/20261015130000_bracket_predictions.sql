-- Bracket predictions ("pick'em"): one row per user per tournament category.
-- picks = { match_code: picked winner's lead player id }.
-- A category locks once any real (non-bye) match in it leaves scheduled/pending:
-- after that, nobody can change picks, and everyone can see everyone's picks
-- (needed for the leaderboard). Before that, you only see your own.

CREATE TABLE IF NOT EXISTS public.bracket_predictions (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category      text NOT NULL,
  user_id       uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  picks         jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, category, user_id)
);

CREATE INDEX IF NOT EXISTS bracket_predictions_tournament_idx ON public.bracket_predictions (tournament_id, category);

CREATE OR REPLACE FUNCTION public.bracket_category_locked(p_tournament uuid, p_category text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_matches
    WHERE tournament_id = p_tournament
      AND category = p_category
      AND tie_id IS NULL
      AND status NOT IN ('scheduled', 'pending')
      AND COALESCE(team1_label, '') !~* '\mbye\M'
      AND COALESCE(team2_label, '') !~* '\mbye\M'
  );
$$;

GRANT EXECUTE ON FUNCTION public.bracket_category_locked(uuid, text) TO authenticated;

ALTER TABLE public.bracket_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own or locked predictions" ON public.bracket_predictions;
CREATE POLICY "read own or locked predictions"
  ON public.bracket_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bracket_category_locked(tournament_id, category));

DROP POLICY IF EXISTS "insert own unlocked prediction" ON public.bracket_predictions;
CREATE POLICY "insert own unlocked prediction"
  ON public.bracket_predictions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.bracket_category_locked(tournament_id, category));

DROP POLICY IF EXISTS "update own unlocked prediction" ON public.bracket_predictions;
CREATE POLICY "update own unlocked prediction"
  ON public.bracket_predictions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND NOT public.bracket_category_locked(tournament_id, category))
  WITH CHECK (user_id = auth.uid() AND NOT public.bracket_category_locked(tournament_id, category));

DROP POLICY IF EXISTS "delete own unlocked prediction" ON public.bracket_predictions;
CREATE POLICY "delete own unlocked prediction"
  ON public.bracket_predictions FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND NOT public.bracket_category_locked(tournament_id, category));
