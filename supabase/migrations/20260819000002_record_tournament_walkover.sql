-- Walkovers had no proper recording path.
--
-- The admin status dropdown only set status = 'walkover'; it never set
-- winner_side, score, or advanced anyone. Because advance_tournament_winner
-- treats any winner_side outside (1,2) as a BYE, a walkover left with a NULL
-- winner_side would push 'BYE' with NULL players into the next round the next
-- time the Sync Names cascade ran — wiping the waiting opponent's slot.
--
-- admin_edit_tournament_match can't be reused here: it hardcodes
-- status = 'completed', and a walkover must stay distinguishable from a played
-- match so the bracket and exports can render "W/O" rather than a score.
--
-- p_winner_side:
--   1 or 2 -> that side advances (its opponent did not turn up)
--   0      -> double walkover; nobody advances and the next-round slot becomes
--             BYE, so whoever is waiting there goes through unopposed.

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

  -- Same authority as recording a score, plus the court-side umpire who holds
  -- an assignment for this match — they are the ones who discover a no-show.
  IF NOT (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
    OR v_match.umpired_by = auth.uid()
    OR EXISTS (
         SELECT 1 FROM umpire_assignments
         WHERE user_id = auth.uid() AND tournament_match_id = p_match_id
       )
  ) THEN
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

ALTER FUNCTION public.record_tournament_walkover(uuid, smallint, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_tournament_walkover(uuid, smallint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_tournament_walkover(uuid, smallint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tournament_walkover(uuid, smallint, uuid) TO service_role;
