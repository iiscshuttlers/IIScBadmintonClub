-- Migration: Flexible Pool Advancement & Conditional Decider Rubbers
-- Author: IISc Badminton Club System
-- Date: 2026-10-09

-- 1. Extend tournament_matches with decider flag
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS is_decider_tiebreaker boolean NOT NULL DEFAULT false;

-- 2. Extend tournament_ties with decider tracking
ALTER TABLE tournament_ties
ADD COLUMN IF NOT EXISTS has_decider_rubber boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS decider_status text DEFAULT 'NOT_APPLICABLE';

DO $$
BEGIN
    ALTER TABLE tournament_ties DROP CONSTRAINT IF EXISTS tournament_ties_decider_status_check;
    ALTER TABLE tournament_ties ADD CONSTRAINT tournament_ties_decider_status_check
    CHECK (decider_status IN ('NOT_APPLICABLE', 'PENDING_TIE', 'AWAITING_LINEUPS', 'AWAITING_REVEAL', 'IN_PROGRESS', 'COMPLETED'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- 3. Extend tie_lineups with decider flag
ALTER TABLE tie_lineups
ADD COLUMN IF NOT EXISTS is_decider boolean NOT NULL DEFAULT false;

-- 4. RPC: add_decider_rubber_to_tie
CREATE OR REPLACE FUNCTION add_decider_rubber_to_tie(
    p_tie_id uuid,
    p_category text DEFAULT 'MS',
    p_label text DEFAULT 'Decider',
    p_best_of_sets int DEFAULT 1,
    p_points_to_win int DEFAULT 21
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie record;
    v_next_order int;
    v_new_match_id uuid;
    v_team_a_short text;
    v_team_b_short text;
BEGIN
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF v_tie IS NULL THEN
        RAISE EXCEPTION 'Tie not found.';
    END IF;

    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR EXISTS (
        SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('umpire', 'admin', 'master_admin')
    )) THEN
        RAISE EXCEPTION 'Unauthorized: Only tournament managers, referees, or umpires can add a decider rubber.';
    END IF;

    -- Calculate next rubber order
    SELECT COALESCE(MAX(rubber_order), 0) + 1 INTO v_next_order 
    FROM tournament_matches 
    WHERE tie_id = p_tie_id;

    SELECT short_name INTO v_team_a_short FROM tournament_teams WHERE id = v_tie.team_a_id;
    SELECT short_name INTO v_team_b_short FROM tournament_teams WHERE id = v_tie.team_b_id;

    -- Create decider match
    INSERT INTO tournament_matches (
        tournament_id,
        category,
        match_code,
        match_number,
        round_name,
        team1_label,
        team2_label,
        status,
        tie_id,
        rubber_order,
        rubber_label,
        best_of_sets,
        points_to_win,
        locked,
        is_decider_tiebreaker
    ) VALUES (
        v_tie.tournament_id,
        COALESCE(p_category, 'MS'),
        v_tie.tie_code || '-DECIDER-' || COALESCE(p_label, 'D1'),
        v_next_order,
        COALESCE(v_tie.round_name, v_tie.tie_code) || ' (Golden Decider)',
        COALESCE(v_team_a_short, 'Team A'),
        COALESCE(v_team_b_short, 'Team B'),
        'scheduled',
        p_tie_id,
        v_next_order,
        COALESCE(p_label, 'Decider ' || COALESCE(p_category, 'MS')),
        COALESCE(p_best_of_sets, 1),
        COALESCE(p_points_to_win, 21),
        false,
        true
    ) RETURNING id INTO v_new_match_id;

    -- Update tie
    UPDATE tournament_ties
    SET has_decider_rubber = true,
        decider_status = 'AWAITING_LINEUPS',
        state = 'IN_PROGRESS',
        updated_at = now()
    WHERE id = p_tie_id;

    RETURN jsonb_build_object(
        'success', true,
        'match_id', v_new_match_id,
        'rubber_order', v_next_order,
        'label', COALESCE(p_label, 'Decider ' || COALESCE(p_category, 'MS')),
        'category', COALESCE(p_category, 'MS')
    );
END;
$$;

-- 5. RPC: submit_decider_lineup
CREATE OR REPLACE FUNCTION submit_decider_lineup(
    p_tie_id uuid,
    p_side text,
    p_player1_id uuid,
    p_player2_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie record;
    v_team_id uuid;
    v_decider_order int;
    v_other_side text;
    v_other_has_lineup boolean := false;
BEGIN
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF v_tie IS NULL THEN
        RAISE EXCEPTION 'Tie not found.';
    END IF;

    v_team_id := CASE WHEN p_side = 'A' THEN v_tie.team_a_id ELSE v_tie.team_b_id END;
    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR is_team_staff(v_team_id)) THEN
        RAISE EXCEPTION 'Unauthorized: Only team captain or managers can submit decider lineup.';
    END IF;

    -- Get rubber_order of the decider match
    SELECT rubber_order INTO v_decider_order
    FROM tournament_matches
    WHERE tie_id = p_tie_id AND is_decider_tiebreaker = true
    ORDER BY rubber_order DESC LIMIT 1;

    IF v_decider_order IS NULL THEN
        RAISE EXCEPTION 'No decider rubber exists for this tie.';
    END IF;

    -- Upsert into tie_lineups
    INSERT INTO tie_lineups (
        tie_id,
        side,
        rubber_order,
        player1_id,
        player2_id,
        submitted_by,
        is_decider,
        is_revealed
    ) VALUES (
        p_tie_id,
        p_side,
        v_decider_order,
        p_player1_id,
        p_player2_id,
        auth.uid(),
        true,
        false
    )
    ON CONFLICT (tie_id, side, rubber_order) DO UPDATE
    SET player1_id = EXCLUDED.player1_id,
        player2_id = EXCLUDED.player2_id,
        submitted_by = EXCLUDED.submitted_by,
        is_decider = true,
        is_revealed = false;

    -- Check if other side already submitted
    v_other_side := CASE WHEN p_side = 'A' THEN 'B' ELSE 'A' END;
    SELECT EXISTS (
        SELECT 1 FROM tie_lineups 
        WHERE tie_id = p_tie_id AND side = v_other_side AND rubber_order = v_decider_order
    ) INTO v_other_has_lineup;

    IF v_other_has_lineup THEN
        UPDATE tournament_ties 
        SET decider_status = 'AWAITING_REVEAL', updated_at = now() 
        WHERE id = p_tie_id;
    ELSE
        UPDATE tournament_ties 
        SET decider_status = 'AWAITING_LINEUPS', updated_at = now() 
        WHERE id = p_tie_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'both_ready', v_other_has_lineup,
        'decider_status', CASE WHEN v_other_has_lineup THEN 'AWAITING_REVEAL' ELSE 'AWAITING_LINEUPS' END
    );
END;
$$;

-- 6. RPC: reveal_decider_rubber
CREATE OR REPLACE FUNCTION reveal_decider_rubber(
    p_tie_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie record;
    v_decider_match record;
    v_lineup_a record;
    v_lineup_b record;
BEGIN
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF v_tie IS NULL THEN
        RAISE EXCEPTION 'Tie not found.';
    END IF;

    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR EXISTS (
        SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('umpire', 'admin', 'master_admin')
    )) THEN
        RAISE EXCEPTION 'Unauthorized: Only tournament managers, referees, or umpires can reveal the decider rubber.';
    END IF;

    -- Find decider match
    SELECT * INTO v_decider_match
    FROM tournament_matches
    WHERE tie_id = p_tie_id AND is_decider_tiebreaker = true
    ORDER BY rubber_order DESC LIMIT 1;

    IF v_decider_match IS NULL THEN
        RAISE EXCEPTION 'No decider rubber found for this tie.';
    END IF;

    -- Find side A and side B lineups
    SELECT * INTO v_lineup_a
    FROM tie_lineups
    WHERE tie_id = p_tie_id AND side = 'A' AND rubber_order = v_decider_match.rubber_order;

    SELECT * INTO v_lineup_b
    FROM tie_lineups
    WHERE tie_id = p_tie_id AND side = 'B' AND rubber_order = v_decider_match.rubber_order;

    IF v_lineup_a IS NULL OR v_lineup_b IS NULL THEN
        RAISE EXCEPTION 'Both captains must submit their decider lineup before reveal.';
    END IF;

    -- Copy players to tournament_matches
    UPDATE tournament_matches
    SET player1_id = v_lineup_a.player1_id,
        player1_partner_id = v_lineup_a.player2_id,
        player2_id = v_lineup_b.player1_id,
        player2_partner_id = v_lineup_b.player2_id,
        revealed_at = now(),
        revealed_by = auth.uid(),
        status = 'scheduled'
    WHERE id = v_decider_match.id;

    -- Mark lineups revealed
    UPDATE tie_lineups
    SET is_revealed = true,
        revealed_at = now(),
        revealed_by = auth.uid()
    WHERE tie_id = p_tie_id AND rubber_order = v_decider_match.rubber_order;

    -- Update tie
    UPDATE tournament_ties
    SET decider_status = 'IN_PROGRESS',
        updated_at = now()
    WHERE id = p_tie_id;

    RETURN jsonb_build_object(
        'success', true,
        'match_id', v_decider_match.id,
        'revealed_at', now(),
        'revealed_by', auth.uid()
    );
END;
$$;

-- 7. Update complete_match to account for decider rubbers & ties
CREATE OR REPLACE FUNCTION complete_match(
  p_match_id    UUID,
  p_winner_id   UUID,
  p_umpire_id   UUID,
  p_game1_s1    INT,
  p_game1_s2    INT,
  p_game2_s1    INT,
  p_game2_s2    INT,
  p_game3_s1    INT DEFAULT NULL,
  p_game3_s2    INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match       tournament_matches%ROWTYPE;
  v_winner_side INT;
  v_winner_id   UUID;
BEGIN
  -- Fetch the match
  SELECT * INTO v_match
  FROM tournament_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'Match % is already completed', p_match_id;
  END IF;

  -- Verify umpire/manager permission
  IF NOT (
    is_admin_or_master()
    OR is_tournament_manager(v_match.tournament_id)
    OR (v_match.umpire_id IS NOT NULL AND v_match.umpire_id = p_umpire_id)
    OR EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = auth.uid()
        AND p.role IN ('umpire', 'admin', 'master_admin')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned umpire, tournament manager, or admin can finalize';
  END IF;

  -- Determine winner side and ID
  IF p_winner_id IS NOT NULL THEN
    v_winner_id := p_winner_id;
    IF p_winner_id = v_match.player1_id THEN
      v_winner_side := 1;
    ELSIF p_winner_id = v_match.player2_id THEN
      v_winner_side := 2;
    ELSE
      v_winner_side := 1;
    END IF;
  ELSE
    DECLARE
      v_sets_side1 INT := 0;
      v_sets_side2 INT := 0;
    BEGIN
      IF p_game1_s1 > p_game1_s2 THEN v_sets_side1 := v_sets_side1 + 1;
      ELSIF p_game1_s2 > p_game1_s1 THEN v_sets_side2 := v_sets_side2 + 1;
      END IF;

      IF p_game2_s1 > p_game2_s2 THEN v_sets_side1 := v_sets_side1 + 1;
      ELSIF p_game2_s2 > p_game2_s1 THEN v_sets_side2 := v_sets_side2 + 1;
      END IF;

      IF p_game3_s1 IS NOT NULL AND p_game3_s2 IS NOT NULL THEN
        IF p_game3_s1 > p_game3_s2 THEN v_sets_side1 := v_sets_side1 + 1;
        ELSIF p_game3_s2 > p_game3_s1 THEN v_sets_side2 := v_sets_side2 + 1;
        END IF;
      END IF;

      IF v_sets_side1 > v_sets_side2 THEN
        v_winner_side := 1;
        v_winner_id   := v_match.player1_id;
      ELSE
        v_winner_side := 2;
        v_winner_id   := v_match.player2_id;
      END IF;
    END;
  END IF;

  -- Persist the match completion
  UPDATE tournament_matches
  SET
    game1_score1 = p_game1_s1,
    game1_score2 = p_game1_s2,
    game2_score1 = p_game2_s1,
    game2_score2 = p_game2_s2,
    game3_score1 = p_game3_s1,
    game3_score2 = p_game3_s2,
    winner_id    = v_winner_id,
    winner_side  = v_winner_side,
    status       = 'completed',
    locked       = TRUE,
    umpired_by   = p_umpire_id,
    scored_by    = auth.uid(),
    scored_at    = NOW()
  WHERE id = p_match_id;

  -- TEAM EVENTS: Update Tie Score if this match belongs to a Tie
  IF v_match.tie_id IS NOT NULL THEN
    DECLARE
      v_score_a INTEGER;
      v_score_b INTEGER;
      v_total_rubbers INTEGER;
      v_pending_deciders INTEGER;
      v_tie tournament_ties%ROWTYPE;
    BEGIN
      -- Calculate current score
      SELECT COUNT(*) INTO v_score_a FROM tournament_matches WHERE tie_id = v_match.tie_id AND status = 'completed' AND winner_side = 1;
      SELECT COUNT(*) INTO v_score_b FROM tournament_matches WHERE tie_id = v_match.tie_id AND status = 'completed' AND winner_side = 2;
      SELECT COUNT(*) INTO v_total_rubbers FROM tournament_matches WHERE tie_id = v_match.tie_id;
      SELECT COUNT(*) INTO v_pending_deciders FROM tournament_matches WHERE tie_id = v_match.tie_id AND is_decider_tiebreaker = true AND status <> 'completed';
      
      UPDATE tournament_ties SET
        score_team_a = v_score_a,
        score_team_b = v_score_b,
        updated_at = NOW()
      WHERE id = v_match.tie_id
      RETURNING * INTO v_tie;

      -- Check if current match was a decider match
      IF v_match.is_decider_tiebreaker THEN
        -- Decider finished!
        IF v_winner_side = 1 THEN
          UPDATE tournament_ties SET state = 'COMPLETED', decider_status = 'COMPLETED', winner_team_id = v_tie.team_a_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        ELSE
          UPDATE tournament_ties SET state = 'COMPLETED', decider_status = 'COMPLETED', winner_team_id = v_tie.team_b_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        END IF;
      ELSE
        -- Standard rubber
        IF v_score_a > (v_total_rubbers / 2) AND v_pending_deciders = 0 THEN
          UPDATE tournament_ties SET state = 'COMPLETED', winner_team_id = v_tie.team_a_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        ELSIF v_score_b > (v_total_rubbers / 2) AND v_pending_deciders = 0 THEN
          UPDATE tournament_ties SET state = 'COMPLETED', winner_team_id = v_tie.team_b_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        ELSIF (v_score_a + v_score_b) = v_total_rubbers THEN
          -- Tied and no decider pending? Check if tie has decider enabled
          IF v_tie.has_decider_rubber OR v_pending_deciders > 0 THEN
            UPDATE tournament_ties SET state = 'IN_PROGRESS', decider_status = 'AWAITING_LINEUPS' WHERE id = v_tie.id RETURNING * INTO v_tie;
          ELSE
            UPDATE tournament_ties SET state = 'COMPLETED' WHERE id = v_tie.id RETURNING * INTO v_tie;
          END IF;
        END IF;
      END IF;

      -- Bracket Advancement Logic
      IF v_tie.winner_team_id IS NOT NULL AND v_tie.advances_to_tie IS NOT NULL THEN
        IF v_tie.advances_to_slot = 'A' THEN
            UPDATE tournament_ties SET team_a_id = v_tie.winner_team_id WHERE id = v_tie.advances_to_tie;
        ELSIF v_tie.advances_to_slot = 'B' THEN
            UPDATE tournament_ties SET team_b_id = v_tie.winner_team_id WHERE id = v_tie.advances_to_tie;
        END IF;
      END IF;
      IF v_tie.winner_team_id IS NOT NULL AND v_tie.loser_advances_to_tie IS NOT NULL THEN
        DECLARE
          v_loser_team_id uuid;
        BEGIN
          IF v_tie.winner_team_id = v_tie.team_a_id THEN v_loser_team_id := v_tie.team_b_id; ELSE v_loser_team_id := v_tie.team_a_id; END IF;
          IF v_tie.loser_advances_to_slot = 'A' THEN
              UPDATE tournament_ties SET team_a_id = v_loser_team_id WHERE id = v_tie.loser_advances_to_tie;
          ELSIF v_tie.loser_advances_to_slot = 'B' THEN
              UPDATE tournament_ties SET team_b_id = v_loser_team_id WHERE id = v_tie.loser_advances_to_tie;
          END IF;
        END;
      END IF;
    END;
  ELSE
    -- Only trigger bracket progression for Open Events
    PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
  END IF;
END;
$$;

-- 8. Enhanced populate_playoff_qualifiers_from_standings (Supports Top 1, 2, 3, 4, Play-ins, and Championship Pool)
CREATE OR REPLACE FUNCTION populate_playoff_qualifiers_from_standings(
    p_tournament_id uuid
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_updated_count int := 0;
    v_tie record;
    v_pool_a_1 uuid; v_pool_a_2 uuid; v_pool_a_3 uuid; v_pool_a_4 uuid;
    v_pool_b_1 uuid; v_pool_b_2 uuid; v_pool_b_3 uuid; v_pool_b_4 uuid;
    v_pool_c_1 uuid; v_pool_c_2 uuid; v_pool_c_3 uuid;
    v_pool_d_1 uuid; v_pool_d_2 uuid; v_pool_d_3 uuid;
BEGIN
    IF NOT (is_admin_or_master() OR is_tournament_manager(p_tournament_id)) THEN
        RAISE EXCEPTION 'Unauthorized: Only tournament managers can advance qualifiers.';
    END IF;

    -- Collect Pool A Qualifiers
    SELECT team_id INTO v_pool_a_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'A' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_a_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'A' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    SELECT team_id INTO v_pool_a_3 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'A' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 2;

    SELECT team_id INTO v_pool_a_4 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'A' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 3;

    -- Collect Pool B Qualifiers
    SELECT team_id INTO v_pool_b_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'B' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_b_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'B' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    SELECT team_id INTO v_pool_b_3 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'B' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 2;

    SELECT team_id INTO v_pool_b_4 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'B' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 3;

    -- Collect Pool C Qualifiers
    SELECT team_id INTO v_pool_c_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'C' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_c_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'C' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    SELECT team_id INTO v_pool_c_3 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'C' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 2;

    -- Collect Pool D Qualifiers
    SELECT team_id INTO v_pool_d_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'D' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_d_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'D' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    SELECT team_id INTO v_pool_d_3 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'D' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 2;

    -- Case 1: Play-ins / 6-Team Olympic Format (Top 3 per pool from 2 pools)
    -- QF_01 / PLAYIN_01: Pool A 2nd vs Pool B 3rd
    UPDATE tournament_ties 
    SET team_a_id = COALESCE(team_a_id, v_pool_a_2), 
        team_b_id = COALESCE(team_b_id, v_pool_b_3),
        updated_at = now()
    WHERE tournament_id = p_tournament_id AND (tie_code = 'PLAYIN_01' OR tie_code = 'QF_01_P');

    -- QF_02 / PLAYIN_02: Pool B 2nd vs Pool A 3rd
    UPDATE tournament_ties 
    SET team_a_id = COALESCE(team_a_id, v_pool_b_2), 
        team_b_id = COALESCE(team_b_id, v_pool_a_3),
        updated_at = now()
    WHERE tournament_id = p_tournament_id AND (tie_code = 'PLAYIN_02' OR tie_code = 'QF_02_P');

    -- Semifinals (Direct or with Byes)
    -- SF_01 (Usually A1 vs B2 or A1 vs Winner of Playin 2)
    UPDATE tournament_ties 
    SET team_a_id = COALESCE(team_a_id, v_pool_a_1), 
        team_b_id = COALESCE(team_b_id, v_pool_b_2),
        updated_at = now()
    WHERE tournament_id = p_tournament_id AND (tie_code = 'SF_01' OR round_name ILIKE '%Semifinal 1%')
      AND (advances_to_slot IS NULL OR team_b_id IS NULL);

    -- SF_02 (Usually B1 vs A2 or B1 vs Winner of Playin 1)
    UPDATE tournament_ties 
    SET team_a_id = COALESCE(team_a_id, v_pool_b_1), 
        team_b_id = COALESCE(team_b_id, v_pool_a_2),
        updated_at = now()
    WHERE tournament_id = p_tournament_id AND (tie_code = 'SF_02' OR round_name ILIKE '%Semifinal 2%')
      AND (advances_to_slot IS NULL OR team_b_id IS NULL);

    -- If 4 pools exist (QF_01..04)
    IF v_pool_c_1 IS NOT NULL THEN
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_a_1), team_b_id = COALESCE(team_b_id, v_pool_b_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_01';
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_c_1), team_b_id = COALESCE(team_b_id, v_pool_d_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_02';
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_b_1), team_b_id = COALESCE(team_b_id, v_pool_a_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_03';
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_d_1), team_b_id = COALESCE(team_b_id, v_pool_c_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_04';
    END IF;

    -- Sync labels to tournament_matches for all knockout ties
    FOR v_tie IN SELECT id, team_a_id, team_b_id FROM tournament_ties WHERE tournament_id = p_tournament_id AND stage = 'KNOCKOUT' LOOP
        IF v_tie.team_a_id IS NOT NULL THEN
            UPDATE tournament_matches 
            SET team1_label = (SELECT short_name FROM tournament_teams WHERE id = v_tie.team_a_id)
            WHERE tie_id = v_tie.id;
        END IF;
        IF v_tie.team_b_id IS NOT NULL THEN
            UPDATE tournament_matches 
            SET team2_label = (SELECT short_name FROM tournament_teams WHERE id = v_tie.team_b_id)
            WHERE tie_id = v_tie.id;
        END IF;
        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN v_updated_count;
END;
$$;
