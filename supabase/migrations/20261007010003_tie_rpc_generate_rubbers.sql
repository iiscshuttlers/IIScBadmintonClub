-- 20261007010003_tie_rpc_generate_rubbers.sql
CREATE OR REPLACE FUNCTION create_tie(
    p_tournament_id uuid,
    p_tie_code text,
    p_team_a_id uuid,
    p_team_b_id uuid,
    p_stage text,
    p_advances_to_tie uuid,
    p_advances_to_slot text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie_id uuid;
    v_format_config jsonb;
    v_rubber record;
    v_team_a_short text;
    v_team_b_short text;
BEGIN
    IF NOT is_tournament_manager(p_tournament_id) THEN
        RAISE EXCEPTION 'Only tournament managers can create ties.';
    END IF;

    -- Fetch tournament config
    SELECT tie_format_config INTO v_format_config FROM tournaments WHERE id = p_tournament_id;

    -- Fetch team names
    IF p_team_a_id IS NOT NULL THEN
        SELECT short_name INTO v_team_a_short FROM tournament_teams WHERE id = p_team_a_id;
    END IF;
    IF p_team_b_id IS NOT NULL THEN
        SELECT short_name INTO v_team_b_short FROM tournament_teams WHERE id = p_team_b_id;
    END IF;

    -- Insert Tie
    INSERT INTO tournament_ties (
        tournament_id, tie_code, team_a_id, team_b_id, stage,
        advances_to_tie, advances_to_slot, state
    ) VALUES (
        p_tournament_id, p_tie_code, p_team_a_id, p_team_b_id, p_stage,
        p_advances_to_tie, p_advances_to_slot, 'AWAITING_LINEUPS'
    ) RETURNING id INTO v_tie_id;

    -- Generate Rubbers in tournament_matches
    IF v_format_config IS NOT NULL THEN
        IF jsonb_typeof(v_format_config) = 'object' AND v_format_config ? 'rubbers' THEN
            v_format_config := v_format_config->'rubbers';
        END IF;

        IF jsonb_typeof(v_format_config) = 'array' THEN
            FOR v_rubber IN SELECT * FROM jsonb_to_recordset(v_format_config) AS x("order" int, label text, category text, points int, best_of_sets int, points_to_win int) LOOP
                INSERT INTO tournament_matches (
                tournament_id, category, match_code, match_number, round_name,
                team1_label, team2_label, status, tie_id, rubber_order, rubber_label,
                best_of_sets, points_to_win, locked
            ) VALUES (
                p_tournament_id,
                v_rubber.category,
                p_tie_code || '-' || v_rubber.label,
                v_rubber."order",
                p_tie_code,
                v_team_a_short,
                v_team_b_short,
                'scheduled',
                v_tie_id,
                v_rubber.order,
                v_rubber.label,
                COALESCE(v_rubber.best_of_sets, 3),
                COALESCE(v_rubber.points_to_win, 21),
                FALSE
            );
        END LOOP;
    END IF;

    RETURN v_tie_id;
END;
$$;
