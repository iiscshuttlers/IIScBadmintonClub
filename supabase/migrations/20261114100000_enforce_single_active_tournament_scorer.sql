-- WP2 follow-up: choose and enforce one active scorer for tournament live scores.
-- Friendly live broadcasts keep their existing authenticated-user behavior.

CREATE OR REPLACE FUNCTION public.enforce_single_active_tournament_scorer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_active boolean := NEW.status IN ('in_progress', 'playing', 'ready', 'warming_up', 'paused');
BEGIN
  IF NOT v_active OR v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.umpired_by IS NULL THEN
    NEW.umpired_by := v_actor;
  ELSIF NEW.umpired_by <> v_actor THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'scorer_locked: this match already has another active scorer';
  END IF;

  IF OLD.status IN ('in_progress', 'playing', 'ready', 'warming_up', 'paused')
    AND OLD.umpired_by IS NOT NULL
    AND NEW.umpired_by IS DISTINCT FROM OLD.umpired_by THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'scorer_transfer_requires_review: an active scorer cannot be replaced by a direct edit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_matches_single_active_scorer ON public.tournament_matches;
CREATE TRIGGER tournament_matches_single_active_scorer
BEFORE UPDATE OF status, umpired_by
ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_active_tournament_scorer();

REVOKE ALL ON FUNCTION public.enforce_single_active_tournament_scorer() FROM PUBLIC, anon, authenticated;

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
IS 'Publishes a live-score snapshot; tournament matches accept writes only from their single active scorer.';
