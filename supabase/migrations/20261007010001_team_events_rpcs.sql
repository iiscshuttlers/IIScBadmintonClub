-- Migration: Team Events RPCs (Phase 1)
-- Implements the SECURITY DEFINER functions for team and tie management.

-- 1. create_team
CREATE OR REPLACE FUNCTION create_team(
    p_tournament_id uuid,
    p_name text,
    p_short_name text,
    p_logo_url text,
    p_captain_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_team_id uuid;
    v_is_manager boolean;
BEGIN
    v_is_manager := is_tournament_manager(p_tournament_id);
    
    -- Only managers can create teams (Decision made: team_self_registration is ignored)
    IF NOT v_is_manager THEN
        RAISE EXCEPTION 'Only tournament managers can create teams.';
    END IF;

    INSERT INTO tournament_teams (tournament_id, name, short_name, logo_url, captain_id)
    VALUES (p_tournament_id, p_name, p_short_name, p_logo_url, p_captain_id)
    RETURNING id INTO v_team_id;

    -- Auto-add captain as an ACTIVE member
    INSERT INTO tournament_team_members (team_id, tournament_id, player_id, role, status)
    VALUES (v_team_id, p_tournament_id, p_captain_id, 'PLAYER', 'ACTIVE');

    RETURN v_team_id;
END;
$$;

-- 2. invite_team_member
CREATE OR REPLACE FUNCTION invite_team_member(
    p_team_id uuid,
    p_player_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tournament_id uuid;
    v_member_id uuid;
BEGIN
    IF NOT is_team_staff(p_team_id) AND NOT is_tournament_manager((SELECT tournament_id FROM tournament_teams WHERE id = p_team_id)) THEN
        RAISE EXCEPTION 'Only team staff or managers can invite members.';
    END IF;

    SELECT tournament_id INTO v_tournament_id FROM tournament_teams WHERE id = p_team_id;

    INSERT INTO tournament_team_members (team_id, tournament_id, player_id, status, invited_by)
    VALUES (p_team_id, v_tournament_id, p_player_id, 'INVITED', auth.uid())
    RETURNING id INTO v_member_id;

    -- NOTE: Notification sending logic will be handled by edge functions / database triggers
    RETURN v_member_id;
END;
$$;

-- 3. respond_team_invite
CREATE OR REPLACE FUNCTION respond_team_invite(
    p_member_id uuid,
    p_accept boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_player_id uuid;
BEGIN
    SELECT player_id INTO v_player_id FROM tournament_team_members WHERE id = p_member_id AND status = 'INVITED';
    
    IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'Invite not found or already processed.';
    END IF;

    IF v_player_id != auth.uid() THEN
        RAISE EXCEPTION 'You can only respond to your own invites.';
    END IF;

    IF p_accept THEN
        UPDATE tournament_team_members 
        SET status = 'ACTIVE', responded_at = now()
        WHERE id = p_member_id;
    ELSE
        UPDATE tournament_team_members 
        SET status = 'DECLINED', responded_at = now()
        WHERE id = p_member_id;
    END IF;

    RETURN true;
END;
$$;

-- 4. remove_team_member
CREATE OR REPLACE FUNCTION remove_team_member(p_member_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_team_id uuid;
    v_player_id uuid;
    v_captain_id uuid;
BEGIN
    SELECT team_id, player_id INTO v_team_id, v_player_id FROM tournament_team_members WHERE id = p_member_id;
    SELECT captain_id INTO v_captain_id FROM tournament_teams WHERE id = v_team_id;

    IF v_player_id = v_captain_id THEN
        RAISE EXCEPTION 'Cannot remove the captain. Reassign captain first.';
    END IF;

    IF auth.uid() = v_player_id OR is_team_staff(v_team_id) OR is_tournament_manager((SELECT tournament_id FROM tournament_teams WHERE id = v_team_id)) THEN
        UPDATE tournament_team_members SET status = 'REMOVED' WHERE id = p_member_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to remove this member.';
    END IF;
END;
$$;

-- 5. validate_tie_format
CREATE OR REPLACE FUNCTION validate_tie_format(config jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    r jsonb;
    points_total int := 0;
BEGIN
    IF config IS NULL OR jsonb_array_length(config) = 0 THEN
        RETURN false;
    END IF;
    
    FOR r IN SELECT * FROM jsonb_array_elements(config) LOOP
        IF (r->>'order') IS NULL OR (r->>'category') IS NULL OR (r->>'points') IS NULL THEN
            RETURN false;
        END IF;
        IF (r->>'points')::int <= 0 THEN
            RETURN false;
        END IF;
        points_total := points_total + (r->>'points')::int;
    END LOOP;
    
    RETURN true;
END;
$$;

-- 6. save_tie_lineup
CREATE OR REPLACE FUNCTION save_tie_lineup(
    p_tie_id uuid,
    p_side text,
    p_assignments jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_team_id uuid;
    v_state text;
    v_is_locked boolean;
    a jsonb;
    v_player1_id uuid;
    v_player2_id uuid;
BEGIN
    SELECT state, 
           CASE WHEN p_side = 'A' THEN team_a_id ELSE team_b_id END,
           CASE WHEN p_side = 'A' THEN lineup_locked_a ELSE lineup_locked_b END
    INTO v_state, v_team_id, v_is_locked
    FROM tournament_ties WHERE id = p_tie_id;

    IF v_state != 'AWAITING_LINEUPS' THEN
        RAISE EXCEPTION 'Tie is not accepting lineups at this time.';
    END IF;
    IF v_is_locked THEN
        RAISE EXCEPTION 'Lineup is already locked.';
    END IF;
    IF NOT is_team_staff(v_team_id) THEN
        RAISE EXCEPTION 'Unauthorized to save lineup for this team.';
    END IF;

    -- Upsert loop
    FOR a IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
        v_player1_id := (a->>'player1_id')::uuid;
        v_player2_id := NULLIF(a->>'player2_id', '')::uuid;
        
        -- Basic validation: Ensure players belong to the ACTIVE roster
        IF NOT EXISTS (SELECT 1 FROM tournament_team_members WHERE team_id = v_team_id AND player_id = v_player1_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Player % is not an active team member.', v_player1_id;
        END IF;

        IF v_player2_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tournament_team_members WHERE team_id = v_team_id AND player_id = v_player2_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Player % is not an active team member.', v_player2_id;
        END IF;

        INSERT INTO tie_lineups (tie_id, side, rubber_order, player1_id, player2_id, submitted_by)
        VALUES (p_tie_id, p_side, (a->>'rubber_order')::int, v_player1_id, v_player2_id, auth.uid())
        ON CONFLICT (tie_id, side, rubber_order) 
        DO UPDATE SET player1_id = EXCLUDED.player1_id, player2_id = EXCLUDED.player2_id, submitted_by = EXCLUDED.submitted_by, updated_at = now();
    END LOOP;

    RETURN true;
END;
$$;

-- 7. lock_tie_lineup (And Reveal)
CREATE OR REPLACE FUNCTION lock_tie_lineup(
    p_tie_id uuid,
    p_side text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_team_id uuid;
    v_locked_a boolean;
    v_locked_b boolean;
    v_rubber record;
    v_lineup record;
BEGIN
    SELECT team_a_id, team_b_id, lineup_locked_a, lineup_locked_b 
    INTO v_team_id, v_team_id, v_locked_a, v_locked_b 
    FROM tournament_ties WHERE id = p_tie_id FOR UPDATE;

    v_team_id := CASE WHEN p_side = 'A' THEN (SELECT team_a_id FROM tournament_ties WHERE id = p_tie_id) ELSE (SELECT team_b_id FROM tournament_ties WHERE id = p_tie_id) END;

    IF NOT is_team_staff(v_team_id) THEN
        RAISE EXCEPTION 'Unauthorized to lock lineup.';
    END IF;

    IF p_side = 'A' THEN
        UPDATE tournament_ties SET lineup_locked_a = true WHERE id = p_tie_id;
        v_locked_a := true;
    ELSE
        UPDATE tournament_ties SET lineup_locked_b = true WHERE id = p_tie_id;
        v_locked_b := true;
    END IF;

    -- REVEAL LOGIC: If both sides are now locked, copy data to `tournament_matches`
    IF v_locked_a AND v_locked_b THEN
        UPDATE tournament_ties SET state = 'IN_PROGRESS' WHERE id = p_tie_id;
        
        -- Fetch tie_lineups for Side A and Side B and push them into the pre-created `tournament_matches` rubber rows
        FOR v_rubber IN SELECT id, rubber_order FROM tournament_matches WHERE tie_id = p_tie_id LOOP
            -- Get Side A
            SELECT player1_id, player2_id INTO v_lineup FROM tie_lineups WHERE tie_id = p_tie_id AND side = 'A' AND rubber_order = v_rubber.rubber_order;
            UPDATE tournament_matches SET player1_id = v_lineup.player1_id, player2_id = v_lineup.player2_id WHERE id = v_rubber.id;
            
            -- Get Side B
            SELECT player1_id, player2_id INTO v_lineup FROM tie_lineups WHERE tie_id = p_tie_id AND side = 'B' AND rubber_order = v_rubber.rubber_order;
            UPDATE tournament_matches SET player3_id = v_lineup.player1_id, player4_id = v_lineup.player2_id WHERE id = v_rubber.id;
        END LOOP;
    END IF;

    RETURN true;
END;
$$;
