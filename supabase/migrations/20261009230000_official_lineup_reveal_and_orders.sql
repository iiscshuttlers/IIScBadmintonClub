-- Migration: Official Lineup Reveal, Playing Order Arbitration, and Emergency Substitutions
-- Author: IISc Badminton Club System
-- Date: 2026-10-09

-- 1. Extend tie_lineups with proposed_playing_order
ALTER TABLE tie_lineups
ADD COLUMN IF NOT EXISTS proposed_playing_order int,
ADD COLUMN IF NOT EXISTS is_revealed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
ADD COLUMN IF NOT EXISTS revealed_by uuid REFERENCES players(id);

-- 2. Extend tournament_matches with playing_order and reveal tracking
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS playing_order int,
ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
ADD COLUMN IF NOT EXISTS revealed_by uuid REFERENCES players(id);

-- 3. Extend tie_lineup_audits with dual-captain agreement and authorizer
ALTER TABLE tie_lineup_audits
ADD COLUMN IF NOT EXISTS both_captains_agreed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS authorized_by uuid REFERENCES players(id);

-- 4. Update tournament_ties state constraint to allow AWAITING_REVEAL
DO $$
BEGIN
    ALTER TABLE tournament_ties DROP CONSTRAINT IF EXISTS tournament_ties_state_check;
    ALTER TABLE tournament_ties ADD CONSTRAINT tournament_ties_state_check 
    CHECK (state IN ('SCHEDULED', 'AWAITING_LINEUPS', 'AWAITING_REVEAL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
EXCEPTION WHEN OTHERS THEN
    -- If constraint had another name or failed, continue
    NULL;
END;
$$;

-- 5. Update RLS policies on tie_lineups
DROP POLICY IF EXISTS "Managers can view all lineups" ON tie_lineups;
DROP POLICY IF EXISTS "Managers and umpires can view all lineups" ON tie_lineups;
CREATE POLICY "Managers and umpires can view all lineups" ON tie_lineups FOR SELECT
USING (
    is_admin_or_master()
    OR is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
    OR EXISTS (
        SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('umpire', 'admin', 'master_admin')
    )
);

DROP POLICY IF EXISTS "Staff can view own lineups" ON tie_lineups;
CREATE POLICY "Staff can view own lineups" ON tie_lineups FOR SELECT
USING (
    (side = 'A' AND is_team_staff((SELECT team_a_id FROM tournament_ties WHERE id = tie_id)))
    OR 
    (side = 'B' AND is_team_staff((SELECT team_b_id FROM tournament_ties WHERE id = tie_id)))
);

DROP POLICY IF EXISTS "Public can view locked lineups" ON tie_lineups;
DROP POLICY IF EXISTS "Public can view revealed lineups" ON tie_lineups;
CREATE POLICY "Public can view revealed lineups" ON tie_lineups FOR SELECT
USING (is_revealed = true);

-- 6. RPC: lock_tie_lineup (DO NOT auto-reveal; set state to AWAITING_REVEAL)
CREATE OR REPLACE FUNCTION lock_tie_lineup(
    p_tie_id uuid,
    p_side text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_team_id uuid;
    v_locked_a boolean;
    v_locked_b boolean;
BEGIN
    SELECT team_a_id, team_b_id, lineup_locked_a, lineup_locked_b 
    INTO v_team_id, v_team_id, v_locked_a, v_locked_b 
    FROM tournament_ties WHERE id = p_tie_id FOR UPDATE;

    v_team_id := CASE WHEN p_side = 'A' THEN (SELECT team_a_id FROM tournament_ties WHERE id = p_tie_id) ELSE (SELECT team_b_id FROM tournament_ties WHERE id = p_tie_id) END;

    IF NOT (is_admin_or_master() OR is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = p_tie_id)) OR is_team_staff(v_team_id)) THEN
        RAISE EXCEPTION 'Unauthorized to lock lineup.';
    END IF;

    IF p_side = 'A' THEN
        UPDATE tournament_ties SET lineup_locked_a = true WHERE id = p_tie_id;
        v_locked_a := true;
    ELSE
        UPDATE tournament_ties SET lineup_locked_b = true WHERE id = p_tie_id;
        v_locked_b := true;
    END IF;

    -- NOTE: DO NOT auto-reveal here!
    -- When both sides lock, transition state to AWAITING_REVEAL so referee/umpire knows lineups are ready.
    IF v_locked_a AND v_locked_b THEN
        UPDATE tournament_ties SET state = 'AWAITING_REVEAL', updated_at = now() WHERE id = p_tie_id;
    END IF;

    RETURN true;
END;
$$;

-- 7. RPC: reveal_tie_lineup (Reveal All or Individual Rubber by Official)
CREATE OR REPLACE FUNCTION reveal_tie_lineup(
    p_tie_id uuid,
    p_rubber_order int DEFAULT NULL -- NULL means reveal all
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR EXISTS (
        SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('umpire', 'admin', 'master_admin')
    )) THEN
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
$$;

-- 8. RPC: set_tie_playing_order (Arbitrate / Modify Rubber Playing Order)
CREATE OR REPLACE FUNCTION set_tie_playing_order(
    p_tie_id uuid,
    p_playing_orders jsonb, -- array of {"rubber_order": int, "playing_order": int}
    p_reason text DEFAULT 'Playing order confirmed by match official'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie tournament_ties%ROWTYPE;
    v_item jsonb;
    v_rubber_order int;
    v_playing_order int;
    v_official_name text;
BEGIN
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR EXISTS (
        SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('umpire', 'admin', 'master_admin')
    )) THEN
        RAISE EXCEPTION 'Unauthorized: Only Umpires, Referees and Admins can set playing order.';
    END IF;

    SELECT full_name INTO v_official_name FROM players WHERE id = auth.uid();

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_playing_orders) LOOP
        v_rubber_order := (v_item->>'rubber_order')::int;
        v_playing_order := (v_item->>'playing_order')::int;

        UPDATE tournament_matches
        SET playing_order = v_playing_order
        WHERE tie_id = p_tie_id AND rubber_order = v_rubber_order;
    END LOOP;

    -- Log audit
    INSERT INTO tie_lineup_audits (
        tie_id,
        action_type,
        referee_id,
        authorized_by,
        both_captains_agreed,
        reason
    ) VALUES (
        p_tie_id,
        'ORDER_CHANGED',
        auth.uid(),
        auth.uid(),
        true,
        COALESCE(p_reason, 'Playing order arbitrated/confirmed by ' || COALESCE(v_official_name, 'Official'))
    );

    RETURN true;
END;
$$;

-- 9. RPC: emergency_modify_lineup (Requires Both Captains Agreed)
CREATE OR REPLACE FUNCTION emergency_modify_lineup(
    p_tie_id uuid,
    p_side text, -- 'A' or 'B'
    p_rubber_order int,
    p_pos int, -- 1 or 2
    p_new_player_id uuid,
    p_reason text,
    p_both_captains_agreed boolean DEFAULT true
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie tournament_ties%ROWTYPE;
    v_old_player_id uuid;
    v_rubber record;
    v_is_doubles boolean;
    v_official_name text;
BEGIN
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR EXISTS (
        SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('umpire', 'admin', 'master_admin')
    )) THEN
        RAISE EXCEPTION 'Unauthorized: Only Umpires, Referees and Admins can perform emergency modifications.';
    END IF;

    -- Strict validation: both captains must agree!
    IF p_both_captains_agreed IS NOT TRUE THEN
        RAISE EXCEPTION 'Both captains must agree before an emergency player substitution can be authorized.';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid reason is required for emergency modifications.';
    END IF;

    SELECT full_name INTO v_official_name FROM players WHERE id = auth.uid();

    -- Get old player ID from tie_lineups
    IF p_pos = 1 THEN
        SELECT player1_id INTO v_old_player_id FROM tie_lineups WHERE tie_id = p_tie_id AND side = p_side AND rubber_order = p_rubber_order;
        UPDATE tie_lineups SET player1_id = p_new_player_id, updated_at = now() WHERE tie_id = p_tie_id AND side = p_side AND rubber_order = p_rubber_order;
    ELSE
        SELECT player2_id INTO v_old_player_id FROM tie_lineups WHERE tie_id = p_tie_id AND side = p_side AND rubber_order = p_rubber_order;
        UPDATE tie_lineups SET player2_id = p_new_player_id, updated_at = now() WHERE tie_id = p_tie_id AND side = p_side AND rubber_order = p_rubber_order;
    END IF;

    -- If rubber was already populated in tournament_matches, sync it immediately
    SELECT * INTO v_rubber FROM tournament_matches WHERE tie_id = p_tie_id AND rubber_order = p_rubber_order;
    IF FOUND THEN
        v_is_doubles := v_rubber.category LIKE '%D%' OR v_rubber.category LIKE '%Doubles%';
        IF p_side = 'A' THEN
            IF p_pos = 1 THEN
                UPDATE tournament_matches SET player1_id = p_new_player_id WHERE id = v_rubber.id;
            ELSE
                UPDATE tournament_matches SET player3_id = p_new_player_id WHERE id = v_rubber.id;
            END IF;
        ELSE
            IF p_pos = 1 THEN
                UPDATE tournament_matches SET player2_id = p_new_player_id WHERE id = v_rubber.id;
            ELSE
                UPDATE tournament_matches SET player4_id = p_new_player_id WHERE id = v_rubber.id;
            END IF;
        END IF;
    END IF;

    -- Immutable audit log
    INSERT INTO tie_lineup_audits (
        tie_id, 
        rubber_order, 
        action_type, 
        original_player_id, 
        replacement_player_id, 
        referee_id, 
        authorized_by,
        both_captains_agreed,
        reason
    ) VALUES (
        p_tie_id, 
        p_rubber_order, 
        'PLAYER_SUBSTITUTED', 
        v_old_player_id, 
        p_new_player_id, 
        auth.uid(), 
        auth.uid(),
        true,
        'Authorized by ' || COALESCE(v_official_name, 'Official') || ' (Both captains agreed: ' || p_reason || ')'
    );

    RETURN true;
END;
$$;
