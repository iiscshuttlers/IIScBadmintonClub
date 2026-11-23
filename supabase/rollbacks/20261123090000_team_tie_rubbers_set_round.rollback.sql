-- Rollback for 20261123090000_team_tie_rubbers_set_round.sql
-- Restores the prod definitions captured on 23 Nov 2026 (before the fix).
-- NOTE: those versions omit tournament_matches.round, so rubbers cannot be
-- created after rolling back. anon EXECUTE is deliberately not re-granted.
-- Apply: npx --no-install supabase db query --remote --yes -f <this file>
--        npx --no-install supabase migration repair --status reverted 20261123090000 --remote --yes

BEGIN;

CREATE OR REPLACE FUNCTION public.create_tie(p_tournament_id uuid, p_tie_code text, p_team_a_id uuid, p_team_b_id uuid, p_stage text, p_advances_to_tie uuid, p_advances_to_slot text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF v_format_config IS NOT NULL AND jsonb_typeof(v_format_config) = 'array' THEN
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
$function$
;

CREATE OR REPLACE FUNCTION public.add_decider_rubber_to_tie(p_tie_id uuid, p_category text DEFAULT 'MS'::text, p_label text DEFAULT 'Decider'::text, p_best_of_sets integer DEFAULT 1, p_points_to_win integer DEFAULT 21)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

GRANT EXECUTE ON FUNCTION public.create_tie(uuid, text, uuid, uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_decider_rubber_to_tie(uuid, text, text, integer, integer) TO authenticated;

COMMIT;
