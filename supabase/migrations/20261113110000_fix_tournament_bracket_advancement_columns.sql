-- Restore the production tournament bracket column names after
-- 20261019000008 referenced non-existent loser_advances_* fields. Keep the
-- partner-safe label behavior introduced in 20260819000001.

CREATE OR REPLACE FUNCTION public.pick_team_label(p_rebuilt TEXT, p_stored TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_rebuilt IS NULL OR btrim(p_rebuilt) = '' THEN p_stored
    WHEN p_stored IS NULL OR btrim(p_stored) = '' THEN p_rebuilt
    WHEN cardinality(string_to_array(p_stored, '&'))
       > cardinality(string_to_array(p_rebuilt, '&')) THEN p_stored
    ELSE p_rebuilt
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.advance_tournament_winner(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match tournament_matches%ROWTYPE;
  v_next tournament_matches%ROWTYPE;
  v_winner_label TEXT;
  v_winner_p1 UUID;
  v_winner_p3 UUID;
  v_loser_label TEXT;
  v_loser_p1 UUID;
  v_loser_p3 UUID;
BEGIN
  SELECT * INTO v_match
  FROM public.tournament_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_match.advances_to_match IS NOT NULL THEN
    SELECT * INTO v_next
    FROM public.tournament_matches
    WHERE tournament_id = v_match.tournament_id
      AND match_code = v_match.advances_to_match;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_winner_p1 := v_match.player1_id;
        v_winner_p3 := v_match.player3_id;
        v_winner_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM public.players WHERE id IN (v_match.player1_id, v_match.player3_id)),
          v_match.team1_label
        );
      ELSIF v_match.winner_side = 2 THEN
        v_winner_p1 := v_match.player2_id;
        v_winner_p3 := v_match.player4_id;
        v_winner_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM public.players WHERE id IN (v_match.player2_id, v_match.player4_id)),
          v_match.team2_label
        );
      ELSE
        RETURN;
      END IF;

      IF v_match.advances_to_position = 1 THEN
        UPDATE public.tournament_matches
        SET player1_id = COALESCE(v_winner_p1, player1_id),
            player3_id = COALESCE(v_winner_p3, player3_id),
            team1_label = COALESCE(v_winner_label, team1_label)
        WHERE id = v_next.id;
      ELSIF v_match.advances_to_position = 2 THEN
        UPDATE public.tournament_matches
        SET player2_id = COALESCE(v_winner_p1, player2_id),
            player4_id = COALESCE(v_winner_p3, player4_id),
            team2_label = COALESCE(v_winner_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;

  IF v_match.advances_to_match_loser IS NOT NULL THEN
    SELECT * INTO v_next
    FROM public.tournament_matches
    WHERE tournament_id = v_match.tournament_id
      AND match_code = v_match.advances_to_match_loser;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_loser_p1 := v_match.player2_id;
        v_loser_p3 := v_match.player4_id;
        v_loser_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM public.players WHERE id IN (v_match.player2_id, v_match.player4_id)),
          v_match.team2_label
        );
      ELSIF v_match.winner_side = 2 THEN
        v_loser_p1 := v_match.player1_id;
        v_loser_p3 := v_match.player3_id;
        v_loser_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM public.players WHERE id IN (v_match.player1_id, v_match.player3_id)),
          v_match.team1_label
        );
      ELSE
        RETURN;
      END IF;

      IF v_match.advances_to_position_loser = 1 THEN
        UPDATE public.tournament_matches
        SET player1_id = COALESCE(v_loser_p1, player1_id),
            player3_id = COALESCE(v_loser_p3, player3_id),
            team1_label = COALESCE(v_loser_label, team1_label)
        WHERE id = v_next.id;
      ELSIF v_match.advances_to_position_loser = 2 THEN
        UPDATE public.tournament_matches
        SET player2_id = COALESCE(v_loser_p1, player2_id),
            player4_id = COALESCE(v_loser_p3, player4_id),
            team2_label = COALESCE(v_loser_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_tournament_winner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_tournament_winner(UUID) TO authenticated;
