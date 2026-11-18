CREATE OR REPLACE FUNCTION advance_tournament_winner(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match        tournament_matches%ROWTYPE;
  v_next         tournament_matches%ROWTYPE;
  v_winner_label TEXT;
  v_winner_p1    UUID;
  v_winner_p3    UUID;
  v_loser_label  TEXT;
  v_loser_p1     UUID;
  v_loser_p3     UUID;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- ── Advance winner ──────────────────────────────────────────────────────────
  IF v_match.advances_to_match IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_winner_p1    := v_match.player1_id;
        v_winner_p3    := v_match.player3_id;
        v_winner_label := v_match.team1_label;
      ELSIF v_match.winner_side = 2 THEN
        v_winner_p1    := v_match.player2_id;
        v_winner_p3    := v_match.player4_id;
        v_winner_label := v_match.team2_label;
      ELSE
        v_winner_p1    := NULL;
        v_winner_p3    := NULL;
        v_winner_label := 'BYE';
      END IF;

      IF v_match.advances_to_position = 1 THEN
        UPDATE tournament_matches
        SET player1_id = COALESCE(v_winner_p1, player1_id),
            player3_id = COALESCE(v_winner_p3, player3_id),
            team1_label = COALESCE(v_winner_label, team1_label)
        WHERE id = v_next.id;
      ELSIF v_match.advances_to_position = 2 THEN
        UPDATE tournament_matches
        SET player2_id = COALESCE(v_winner_p1, player2_id),
            player4_id = COALESCE(v_winner_p3, player4_id),
            team2_label = COALESCE(v_winner_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;

  -- ── Advance loser (if applicable, e.g. for 3rd place match) ───────────────
  IF v_match.loser_advances_to_match IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.loser_advances_to_match;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_loser_p1    := v_match.player2_id;
        v_loser_p3    := v_match.player4_id;
        v_loser_label := v_match.team2_label;
      ELSIF v_match.winner_side = 2 THEN
        v_loser_p1    := v_match.player1_id;
        v_loser_p3    := v_match.player3_id;
        v_loser_label := v_match.team1_label;
      ELSE
        v_loser_p1    := NULL;
        v_loser_p3    := NULL;
        v_loser_label := 'BYE';
      END IF;

      IF v_match.loser_advances_to_position = 1 THEN
        UPDATE tournament_matches
        SET player1_id = COALESCE(v_loser_p1, player1_id),
            player3_id = COALESCE(v_loser_p3, player3_id),
            team1_label = COALESCE(v_loser_label, team1_label)
        WHERE id = v_next.id;
      ELSIF v_match.loser_advances_to_position = 2 THEN
        UPDATE tournament_matches
        SET player2_id = COALESCE(v_loser_p1, player2_id),
            player4_id = COALESCE(v_loser_p3, player4_id),
            team2_label = COALESCE(v_loser_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;
END;
$$;
