-- Secure Tournament Bracket RPC (Strict RBAC)

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
  -- Authorization Check: Only Admins or Umpires can trigger bracket advancement
  IF NOT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can advance tournament brackets.';
  END IF;

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
        v_winner_label := COALESCE(v_match.team1_label,
                            (SELECT full_name FROM players WHERE id = v_match.player1_id));
      ELSE
        v_winner_p1    := v_match.player2_id;
        v_winner_p3    := v_match.player4_id;
        v_winner_label := COALESCE(v_match.team2_label,
                            (SELECT full_name FROM players WHERE id = v_match.player2_id));
      END IF;

      IF v_match.advances_to_position = 1 THEN
        UPDATE tournament_matches
        SET player1_id = v_winner_p1, player3_id = v_winner_p3, team1_label = v_winner_label
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = v_winner_p1, player4_id = v_winner_p3, team2_label = v_winner_label
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;

  -- ── Advance loser to 3rd place match (if configured) ──────────────────────
  IF v_match.advances_to_match_loser IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match_loser;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_loser_p1    := v_match.player2_id;
        v_loser_p3    := v_match.player4_id;
        v_loser_label := COALESCE(v_match.team2_label,
                          (SELECT full_name FROM players WHERE id = v_match.player2_id));
      ELSE
        v_loser_p1    := v_match.player1_id;
        v_loser_p3    := v_match.player3_id;
        v_loser_label := COALESCE(v_match.team1_label,
                          (SELECT full_name FROM players WHERE id = v_match.player1_id));
      END IF;

      IF v_match.advances_to_position_loser = 1 THEN
        UPDATE tournament_matches
        SET player1_id = v_loser_p1, player3_id = v_loser_p3, team1_label = v_loser_label
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = v_loser_p1, player4_id = v_loser_p3, team2_label = v_loser_label
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;
END;
$$;

-- Revoke default PUBLIC execution access and explicitly grant to authenticated users
REVOKE EXECUTE ON FUNCTION advance_tournament_winner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_tournament_winner(UUID) TO authenticated;
