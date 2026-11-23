-- Team ties: rubbers can be created again.
--
-- tournament_matches.round (and round_name) are NOT NULL with no default, and
-- no trigger fills them. create_tie and add_decider_rubber_to_tie never set
-- `round`, so every call failed with a not-null violation. Prod had no team-tie
-- rubbers at all on 23 Nov 2026, so no event has run into it yet.
--
-- Also fixed while here:
--   * create_tie read only the old bare-array tie_format_config. The bracket
--     generator (TeamBracketTab) saves {"rubbers": [...], ...}, which made
--     create_tie add a tie with no rubbers. Both shapes are read now.
--   * A rubber with no label or order no longer produces a NULL match_code or
--     match_number; one with no category is refused with a clear message.
--   * Role checks use the shared helpers instead of an inline players lookup
--     (which missed admins whose players.id differs from their login):
--       create_tie                - site admins or the tournament's managers;
--       add_decider_rubber_to_tie - admins, umpires, or the tournament's
--                                   officials (creator, referees, umpires).
--   * anon can no longer execute either function (both SECURITY DEFINER).
-- Rollback: supabase/rollbacks/20261123090000_team_tie_rubbers_set_round.rollback.sql

CREATE OR REPLACE FUNCTION public.create_tie(
  p_tournament_id uuid,
  p_tie_code text,
  p_team_a_id uuid,
  p_team_b_id uuid,
  p_stage text,
  p_advances_to_tie uuid,
  p_advances_to_slot text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_tie_id uuid;
    v_format_config jsonb;
    v_rubbers jsonb;
    v_rubber record;
    v_team_a_short text;
    v_team_b_short text;
BEGIN
    IF NOT (is_admin_or_master() OR is_tournament_manager(p_tournament_id)) THEN
        RAISE EXCEPTION 'Only tournament managers can create ties.';
    END IF;

    SELECT tie_format_config INTO v_format_config FROM tournaments WHERE id = p_tournament_id;

    -- Older tournaments store a bare array of rubbers; the bracket generator
    -- stores an object with a "rubbers" array plus decider/points settings.
    v_rubbers := CASE
        WHEN jsonb_typeof(v_format_config) = 'array' THEN v_format_config
        WHEN jsonb_typeof(v_format_config) = 'object'
             AND jsonb_typeof(v_format_config -> 'rubbers') = 'array' THEN v_format_config -> 'rubbers'
    END;

    IF p_team_a_id IS NOT NULL THEN
        SELECT short_name INTO v_team_a_short FROM tournament_teams WHERE id = p_team_a_id;
    END IF;
    IF p_team_b_id IS NOT NULL THEN
        SELECT short_name INTO v_team_b_short FROM tournament_teams WHERE id = p_team_b_id;
    END IF;

    INSERT INTO tournament_ties (
        tournament_id, tie_code, team_a_id, team_b_id, stage,
        advances_to_tie, advances_to_slot, state
    ) VALUES (
        p_tournament_id, p_tie_code, p_team_a_id, p_team_b_id, p_stage,
        p_advances_to_tie, p_advances_to_slot, 'AWAITING_LINEUPS'
    ) RETURNING id INTO v_tie_id;

    IF v_rubbers IS NOT NULL THEN
        FOR v_rubber IN
            SELECT x."order" AS rubber_order, x.label, x.category, x.best_of_sets, x.points_to_win,
                   r.ord::int AS position
            FROM jsonb_array_elements(v_rubbers) WITH ORDINALITY AS r(elem, ord)
            CROSS JOIN LATERAL jsonb_to_record(r.elem)
                AS x("order" int, label text, category text, best_of_sets int, points_to_win int)
            ORDER BY r.ord
        LOOP
            IF v_rubber.category IS NULL OR btrim(v_rubber.category) = '' THEN
                RAISE EXCEPTION 'Tie format rubber % has no category.',
                    COALESCE(v_rubber.label, v_rubber.position::text);
            END IF;

            INSERT INTO tournament_matches (
                tournament_id, category, match_code, match_number, round, round_name,
                team1_label, team2_label, status, tie_id, rubber_order, rubber_label,
                best_of_sets, points_to_win, locked
            ) VALUES (
                p_tournament_id,
                v_rubber.category,
                p_tie_code || '-' || COALESCE(v_rubber.label, v_rubber.position::text),
                COALESCE(v_rubber.rubber_order, v_rubber.position),
                -- A tie made one at a time has no round number of its own.
                1,
                p_tie_code,
                v_team_a_short,
                v_team_b_short,
                'scheduled',
                v_tie_id,
                COALESCE(v_rubber.rubber_order, v_rubber.position),
                v_rubber.label,
                COALESCE(v_rubber.best_of_sets, 3),
                COALESCE(v_rubber.points_to_win, 21),
                FALSE
            );
        END LOOP;
    END IF;

    RETURN v_tie_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_decider_rubber_to_tie(
  p_tie_id uuid,
  p_category text DEFAULT 'MS'::text,
  p_label text DEFAULT 'Decider'::text,
  p_best_of_sets integer DEFAULT 1,
  p_points_to_win integer DEFAULT 21
)
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
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tie not found.';
    END IF;

    -- is_tournament_official covers site admins, the tournament's creator and
    -- its assigned officials; is_admin_or_umpire adds club umpires.
    IF NOT (is_admin_or_umpire() OR is_tournament_official(v_tie.tournament_id)) THEN
        RAISE EXCEPTION 'Unauthorized: Only tournament managers, referees, or umpires can add a decider rubber.';
    END IF;

    SELECT COALESCE(MAX(rubber_order), 0) + 1 INTO v_next_order
    FROM tournament_matches
    WHERE tie_id = p_tie_id;

    SELECT short_name INTO v_team_a_short FROM tournament_teams WHERE id = v_tie.team_a_id;
    SELECT short_name INTO v_team_b_short FROM tournament_teams WHERE id = v_tie.team_b_id;

    INSERT INTO tournament_matches (
        tournament_id,
        category,
        match_code,
        match_number,
        round,
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
        COALESCE(v_tie.round_number, 1),
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
$function$;

REVOKE ALL ON FUNCTION public.create_tie(uuid, text, uuid, uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tie(uuid, text, uuid, uuid, text, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.add_decider_rubber_to_tie(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_decider_rubber_to_tie(uuid, text, text, integer, integer) TO authenticated;
