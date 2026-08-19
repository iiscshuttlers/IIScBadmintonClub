-- Advancing a winner rebuilt the team label from the players table:
--   string_agg(full_name, ' & ') FROM players WHERE id IN (p1, p3)
-- with a fallback to the stored label only when the result was empty.
--
-- A doubles pair whose partner was never linked to a player record (very common
-- for tournament entries typed in by name) produced a NON-empty single name, so
-- the fallback never fired and the partner was silently dropped on advancement.
-- "Nivetha & Sona Rajak" advanced into the next round as just "Nivetha".
--
-- pick_team_label keeps the rebuilt label (so renames still propagate) unless
-- the stored label accounts for more people, which means at least one partner
-- exists by name only.
CREATE OR REPLACE FUNCTION public.pick_team_label(p_rebuilt text, p_stored text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN p_rebuilt IS NULL OR btrim(p_rebuilt) = '' THEN p_stored
    WHEN p_stored  IS NULL OR btrim(p_stored)  = '' THEN p_rebuilt
    WHEN cardinality(string_to_array(p_stored, '&'))
       > cardinality(string_to_array(p_rebuilt, '&')) THEN p_stored
    ELSE p_rebuilt
  END;
$fn$;

CREATE OR REPLACE FUNCTION "public"."advance_tournament_winner"("p_match_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
        v_winner_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player1_id, v_match.player3_id)),
          v_match.team1_label
        );
      ELSIF v_match.winner_side = 2 THEN
        v_winner_p1    := v_match.player2_id;
        v_winner_p3    := v_match.player4_id;
        v_winner_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player2_id, v_match.player4_id)),
          v_match.team2_label
        );
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
      ELSE
        UPDATE tournament_matches
        SET player2_id = COALESCE(v_winner_p1, player2_id),
            player4_id = COALESCE(v_winner_p3, player4_id),
            team2_label = COALESCE(v_winner_label, team2_label)
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
        v_loser_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player2_id, v_match.player4_id)),
          v_match.team2_label
        );
      ELSIF v_match.winner_side = 2 THEN
        v_loser_p1    := v_match.player1_id;
        v_loser_p3    := v_match.player3_id;
        v_loser_label := public.pick_team_label(
          (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player1_id, v_match.player3_id)),
          v_match.team1_label
        );
      ELSE
        v_loser_p1    := NULL;
        v_loser_p3    := NULL;
        v_loser_label := 'BYE';
      END IF;

      IF v_match.advances_to_position_loser = 1 THEN
        UPDATE tournament_matches
        SET player1_id = COALESCE(v_loser_p1, player1_id),
            player3_id = COALESCE(v_loser_p3, player3_id),
            team1_label = COALESCE(v_loser_label, team1_label)
        WHERE id = v_next.id;
      ELSE
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
