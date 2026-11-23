-- Part B (tournament-day bug): role checks through the role helpers.
-- is_tournament_manager matched admins by auth.uid() only (an admin whose
-- player row is linked by e-mail failed), and reveal_tie_lineup /
-- reveal_decider_rubber looked roles up in players inline. Same behaviour
-- otherwise; bodies copied from prod on 23 Nov 2026. CREATE OR REPLACE keeps
-- the existing grants.

CREATE OR REPLACE FUNCTION public.is_tournament_manager(t_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.is_admin_or_master()
      OR EXISTS (
           SELECT 1 FROM public.tournaments t
            WHERE t.id = t_id
              AND (t.created_by = auth.uid() OR public.is_my_player_id(t.created_by)));
$function$;

CREATE OR REPLACE FUNCTION public.reveal_decider_rubber(p_tie_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

    IF NOT (is_admin_or_umpire() OR is_tournament_manager(v_tie.tournament_id)) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.reveal_tie_lineup(p_tie_id uuid, p_rubber_order integer DEFAULT NULL::integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_tie tournament_ties%ROWTYPE;
    v_rubber record;
    v_lineup_a record;
    v_lineup_b record;
    v_is_doubles boolean;
    v_official_name text;
BEGIN
    -- Check authority: Umpire, Referee, Tournament Manager, or Admin
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF NOT (is_admin_or_umpire() OR is_tournament_manager(v_tie.tournament_id)) THEN
        RAISE EXCEPTION 'Unauthorized: Only Umpires, Referees and Admins can reveal lineups.';
    END IF;

    SELECT full_name INTO v_official_name FROM players WHERE id = auth.uid();

    -- Mark tie_lineups as revealed
    UPDATE tie_lineups
    SET is_revealed = true,
        revealed_at = now(),
        revealed_by = auth.uid()
    WHERE tie_id = p_tie_id
    AND (p_rubber_order IS NULL OR rubber_order = p_rubber_order);

    -- Populate tournament_matches with revealed player IDs
    FOR v_rubber IN
        SELECT id, rubber_order, category
        FROM tournament_matches
        WHERE tie_id = p_tie_id
        AND (p_rubber_order IS NULL OR rubber_order = p_rubber_order)
    LOOP
        v_is_doubles := v_rubber.category LIKE '%D%' OR v_rubber.category LIKE '%Doubles%';

        -- Fetch side A
        SELECT player1_id, player2_id INTO v_lineup_a
        FROM tie_lineups
        WHERE tie_id = p_tie_id AND side = 'A' AND rubber_order = v_rubber.rubber_order;

        -- Fetch side B
        SELECT player1_id, player2_id INTO v_lineup_b
        FROM tie_lineups
        WHERE tie_id = p_tie_id AND side = 'B' AND rubber_order = v_rubber.rubber_order;

        IF v_is_doubles THEN
            UPDATE tournament_matches
            SET player1_id = v_lineup_a.player1_id,
                player3_id = v_lineup_a.player2_id,
                player2_id = v_lineup_b.player1_id,
                player4_id = v_lineup_b.player2_id,
                revealed_at = now(),
                revealed_by = auth.uid()
            WHERE id = v_rubber.id;
        ELSE
            UPDATE tournament_matches
            SET player1_id = v_lineup_a.player1_id,
                player2_id = v_lineup_b.player1_id,
                revealed_at = now(),
                revealed_by = auth.uid()
            WHERE id = v_rubber.id;
        END IF;

        -- Log audit entry
        INSERT INTO tie_lineup_audits (
            tie_id,
            rubber_order,
            action_type,
            referee_id,
            authorized_by,
            both_captains_agreed,
            reason
        ) VALUES (
            p_tie_id,
            v_rubber.rubber_order,
            'REVEALED',
            auth.uid(),
            auth.uid(),
            true,
            'Revealed by Match Official ' || COALESCE(v_official_name, 'Staff')
        );
    END LOOP;

    -- Ensure tie state transitions to IN_PROGRESS
    UPDATE tournament_ties
    SET state = 'IN_PROGRESS', updated_at = now()
    WHERE id = p_tie_id AND state IN ('SCHEDULED', 'AWAITING_LINEUPS', 'AWAITING_REVEAL');

    RETURN true;
END;
$function$;

-- Only signed-in umpires/organisers call the reveal functions
-- (client/src/services/umpireService.ts); an anonymous caller could never pass
-- the check anyway.
REVOKE EXECUTE ON FUNCTION public.reveal_tie_lineup(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reveal_decider_rubber(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_tie_lineup(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_decider_rubber(uuid) TO authenticated;
