-- Add tournament_elo column to players (separate from club ELO)
ALTER TABLE players ADD COLUMN IF NOT EXISTS tournament_elo INTEGER DEFAULT 1200;

-- Update submit_tournament_match to also update tournament_elo on both players
CREATE OR REPLACE FUNCTION submit_tournament_match(
  p_match_id    UUID,
  p_winner_side SMALLINT,
  p_score       TEXT,
  p_sets        TEXT[],
  p_umpire_id   UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id   UUID;
  v_loser_id    UUID;
  v_match       tournament_matches%ROWTYPE;
  v_winner_elo  INTEGER;
  v_loser_elo   INTEGER;
  v_expected    NUMERIC;
  v_k           INTEGER := 32;
  v_winner_new  INTEGER;
  v_loser_new   INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid()
    AND role IN ('admin','master_admin','umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.locked THEN RAISE EXCEPTION 'Match is locked; only master_admin can edit'; END IF;

  IF p_winner_side = 1 THEN
    v_winner_id := v_match.player1_id;
    v_loser_id  := v_match.player2_id;
  ELSE
    v_winner_id := v_match.player2_id;
    v_loser_id  := v_match.player1_id;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    locked       = TRUE,
    umpired_by   = p_umpire_id,
    scored_by    = auth.uid(),
    scored_at    = NOW()
  WHERE id = p_match_id;

  PERFORM advance_tournament_winner(p_match_id);

  -- Update tournament_elo for both players (skip if either is NULL / external player)
  IF v_winner_id IS NOT NULL AND v_loser_id IS NOT NULL THEN
    SELECT tournament_elo INTO v_winner_elo FROM players WHERE id = v_winner_id;
    SELECT tournament_elo INTO v_loser_elo  FROM players WHERE id = v_loser_id;

    v_winner_elo := COALESCE(v_winner_elo, 1200);
    v_loser_elo  := COALESCE(v_loser_elo,  1200);

    v_expected  := 1.0 / (1.0 + POWER(10.0, (v_loser_elo - v_winner_elo) / 400.0));

    v_winner_new := v_winner_elo + ROUND(v_k * (1 - v_expected));
    v_loser_new  := v_loser_elo  + ROUND(v_k * (0 - (1 - v_expected)));

    -- Floor at 100
    v_winner_new := GREATEST(v_winner_new, 100);
    v_loser_new  := GREATEST(v_loser_new,  100);

    UPDATE players SET tournament_elo = v_winner_new WHERE id = v_winner_id;
    UPDATE players SET tournament_elo = v_loser_new  WHERE id = v_loser_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID) TO authenticated;
