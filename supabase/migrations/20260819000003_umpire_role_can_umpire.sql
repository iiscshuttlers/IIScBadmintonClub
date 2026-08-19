-- Users with role = 'umpire' could not actually umpire a tournament match, which
-- forced them to be promoted to 'admin' — handing out full admin rights just to
-- score a game.
--
-- There were two independent blockers:
--
-- 1. AUTHORISATION MISMATCH. The umpire panel decides who may start a match by
--    looking at the `umpire_assignments` table, but admin_edit_tournament_match
--    (which SAVES the score) checked `tournament_matches.umpired_by`. An umpire
--    assigned through assignments passed the UI, umpired the whole match, and
--    was then rejected on save with "Unauthorized: only admin or assigned umpire
--    can edit match score". Admins slipped through on the role check instead.
--
-- 2. RLS ON site_data. The umpire engine writes live scores and match alerts
--    with a direct upsert to site_data, but that table is restricted to
--    admin/master_admin, so broadcasting failed for a plain umpire.
--
-- Fixes both, so umpires can be demoted back to the 'umpire' role.

-- ── 1. One shared definition of "may umpire this match" ─────────────────────
CREATE OR REPLACE FUNCTION public.can_umpire_match(p_match_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    -- Admins retain blanket access.
    EXISTS (
      SELECT 1 FROM players
      WHERE id = p_uid AND role IN ('admin', 'master_admin')
    )
    -- Explicitly named on the match.
    OR EXISTS (
      SELECT 1 FROM tournament_matches
      WHERE id = p_match_id AND umpired_by = p_uid
    )
    -- Holds an assignment: either for this specific match, or an active time
    -- block. This mirrors exactly what the umpire panel checks before letting
    -- someone start, which is the mismatch that caused the failure.
    OR EXISTS (
      SELECT 1 FROM umpire_assignments a
      WHERE a.user_id = p_uid
        AND (
          a.tournament_match_id = p_match_id
          OR (a.start_time IS NOT NULL AND a.end_time IS NOT NULL
              AND now() BETWEEN a.start_time AND a.end_time)
        )
    );
$$;

ALTER FUNCTION public.can_umpire_match(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.can_umpire_match(uuid, uuid) TO authenticated, service_role;

-- ── 2. Score saving uses the shared check ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_edit_tournament_match(
  p_match_id    uuid,
  p_winner_side smallint,
  p_score       text,
  p_sets        text[],
  p_scored_by   uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id uuid;
  v_match     tournament_matches%ROWTYPE;
BEGIN
  IF NOT public.can_umpire_match(p_match_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only an admin or the assigned umpire can edit match score';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF    p_winner_side = 1 THEN v_winner_id := v_match.player1_id;
  ELSIF p_winner_side = 2 THEN v_winner_id := v_match.player2_id;
  ELSE                         v_winner_id := NULL;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    scored_by    = p_scored_by,
    scored_at    = NOW()
  WHERE id = p_match_id;

  PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
END;
$$;

-- Keep the walkover path on the same definition.
CREATE OR REPLACE FUNCTION public.record_tournament_walkover(
  p_match_id    uuid,
  p_winner_side smallint,
  p_scored_by   uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match     tournament_matches%ROWTYPE;
  v_winner_id uuid;
BEGIN
  IF p_winner_side IS NULL OR p_winner_side NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'winner_side must be 1, 2, or 0 for a double walkover';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF NOT public.can_umpire_match(p_match_id, auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only an admin or the assigned umpire can record a walkover';
  END IF;

  IF    p_winner_side = 1 THEN v_winner_id := v_match.player1_id;
  ELSIF p_winner_side = 2 THEN v_winner_id := v_match.player2_id;
  ELSE                         v_winner_id := NULL;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = CASE WHEN p_winner_side = 0 THEN 'DOUBLE W/O' ELSE 'W/O' END,
    sets_history = NULL,
    status       = 'walkover',
    scored_by    = COALESCE(p_scored_by, auth.uid()),
    scored_at    = NOW(),
    ended_at     = NOW()
  WHERE id = p_match_id;

  PERFORM advance_tournament_winner(p_match_id);
END;
$$;

-- ── 3. Let umpires broadcast live scores ────────────────────────────────────
-- Deliberately narrow: only the two keys the umpire engine writes, and only for
-- users actually holding the umpire role. Everything else in site_data stays
-- admin-only.
DROP POLICY IF EXISTS "Umpires can write live score keys" ON public.site_data;
CREATE POLICY "Umpires can write live score keys" ON public.site_data
  USING (
    key IN ('live_matches', 'match_alert')
    AND EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'umpire')
  )
  WITH CHECK (
    key IN ('live_matches', 'match_alert')
    AND EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'umpire')
  );
