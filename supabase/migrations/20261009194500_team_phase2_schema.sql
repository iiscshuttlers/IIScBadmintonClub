-- Helper function to check if the current user is an admin or master_admin
CREATE OR REPLACE FUNCTION is_admin_or_master() RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM players p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'master_admin')
    );
$$;

-- Migration: Team Tournaments Phase 2 Schema & RLS Policies
-- 1. Fix RLS on `tournament_ties` so managers and admins can create/update/delete ties
DROP POLICY IF EXISTS "Managers and admins can insert ties" ON tournament_ties;
CREATE POLICY "Managers and admins can insert ties" ON tournament_ties
FOR INSERT WITH CHECK (
    is_admin_or_master() OR is_tournament_manager(tournament_id)
);

DROP POLICY IF EXISTS "Managers and admins can update ties" ON tournament_ties;
CREATE POLICY "Managers and admins can update ties" ON tournament_ties
FOR UPDATE USING (
    is_admin_or_master() OR is_tournament_manager(tournament_id)
) WITH CHECK (
    is_admin_or_master() OR is_tournament_manager(tournament_id)
);

DROP POLICY IF EXISTS "Managers and admins can delete ties" ON tournament_ties;
CREATE POLICY "Managers and admins can delete ties" ON tournament_ties
FOR DELETE USING (
    is_admin_or_master() OR is_tournament_manager(tournament_id)
);

-- 2. Add write policies for `tie_lineups`
DROP POLICY IF EXISTS "Managers and staff can insert tie_lineups" ON tie_lineups;
CREATE POLICY "Managers and staff can insert tie_lineups" ON tie_lineups
FOR INSERT WITH CHECK (
    is_admin_or_master() 
    OR is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
    OR (side = 'A' AND is_team_staff((SELECT team_a_id FROM tournament_ties WHERE id = tie_id)))
    OR (side = 'B' AND is_team_staff((SELECT team_b_id FROM tournament_ties WHERE id = tie_id)))
);

DROP POLICY IF EXISTS "Managers and staff can update tie_lineups" ON tie_lineups;
CREATE POLICY "Managers and staff can update tie_lineups" ON tie_lineups
FOR UPDATE USING (
    is_admin_or_master() 
    OR is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
    OR (side = 'A' AND is_team_staff((SELECT team_a_id FROM tournament_ties WHERE id = tie_id)))
    OR (side = 'B' AND is_team_staff((SELECT team_b_id FROM tournament_ties WHERE id = tie_id)))
);

DROP POLICY IF EXISTS "Managers can delete tie_lineups" ON tie_lineups;
CREATE POLICY "Managers can delete tie_lineups" ON tie_lineups
FOR DELETE USING (
    is_admin_or_master() 
    OR is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
);

-- 3. Enhance `tie_lineups` with reveal tracking
ALTER TABLE tie_lineups
ADD COLUMN IF NOT EXISTS is_revealed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
ADD COLUMN IF NOT EXISTS revealed_by uuid REFERENCES players(id);

-- 4. Create `tie_lineup_audits` for emergency substitutions and order swaps
CREATE TABLE IF NOT EXISTS tie_lineup_audits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tie_id uuid NOT NULL REFERENCES tournament_ties(id) ON DELETE CASCADE,
    rubber_order int,
    action_type text NOT NULL CHECK (action_type IN ('PLAYER_SUBSTITUTED', 'ORDER_CHANGED', 'REVEALED')),
    original_player_id uuid REFERENCES players(id),
    replacement_player_id uuid REFERENCES players(id),
    referee_id uuid NOT NULL REFERENCES players(id),
    reason text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lineup_audits_tie ON tie_lineup_audits(tie_id);

ALTER TABLE tie_lineup_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view lineup audits" ON tie_lineup_audits;
CREATE POLICY "Public can view lineup audits" ON tie_lineup_audits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Umpires and admins can insert lineup audits" ON tie_lineup_audits;
CREATE POLICY "Umpires and admins can insert lineup audits" ON tie_lineup_audits
FOR INSERT WITH CHECK (
    is_admin_or_master() OR EXISTS (
        SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('umpire', 'admin', 'master_admin')
    )
);

-- 5. Enhanced `tournament_team_standings` View with sets and points calculations
CREATE OR REPLACE VIEW tournament_team_standings WITH (security_invoker = on) AS
WITH tie_matches_agg AS (
    SELECT 
        m.tie_id,
        m.winner_side,
        -- Sets won per side
        COALESCE(
            (CASE WHEN m.set1_team1_points > m.set1_team2_points THEN 1 ELSE 0 END) +
            (CASE WHEN m.set2_team1_points > m.set2_team2_points THEN 1 ELSE 0 END) +
            (CASE WHEN m.set3_team1_points > m.set3_team2_points THEN 1 ELSE 0 END), 0
        ) as sets_a,
        COALESCE(
            (CASE WHEN m.set1_team2_points > m.set1_team1_points THEN 1 ELSE 0 END) +
            (CASE WHEN m.set2_team2_points > m.set2_team1_points THEN 1 ELSE 0 END) +
            (CASE WHEN m.set3_team2_points > m.set3_team1_points THEN 1 ELSE 0 END), 0
        ) as sets_b,
        -- Points won per side
        (COALESCE(m.set1_team1_points, 0) + COALESCE(m.set2_team1_points, 0) + COALESCE(m.set3_team1_points, 0)) as points_a,
        (COALESCE(m.set1_team2_points, 0) + COALESCE(m.set2_team2_points, 0) + COALESCE(m.set3_team2_points, 0)) as points_b
    FROM tournament_matches m
    WHERE m.tie_id IS NOT NULL AND m.status = 'completed'
),
tie_stats_per_team AS (
    SELECT
        t.tournament_id,
        t.id as team_id,
        t.name as team_name,
        t.pool,
        tie.id as tie_id,
        tie.state,
        tie.winner_team_id,
        -- Rubbers for & against in this tie
        CASE WHEN tie.team_a_id = t.id THEN tie.score_team_a WHEN tie.team_b_id = t.id THEN tie.score_team_b ELSE 0 END as rubbers_for,
        CASE WHEN tie.team_a_id = t.id THEN tie.score_team_b WHEN tie.team_b_id = t.id THEN tie.score_team_a ELSE 0 END as rubbers_against,
        -- Sets for & against in this tie
        COALESCE(SUM(CASE WHEN tie.team_a_id = t.id THEN tma.sets_a WHEN tie.team_b_id = t.id THEN tma.sets_b ELSE 0 END), 0) as sets_for,
        COALESCE(SUM(CASE WHEN tie.team_a_id = t.id THEN tma.sets_b WHEN tie.team_b_id = t.id THEN tma.sets_a ELSE 0 END), 0) as sets_against,
        -- Points for & against in this tie
        COALESCE(SUM(CASE WHEN tie.team_a_id = t.id THEN tma.points_a WHEN tie.team_b_id = t.id THEN tma.points_b ELSE 0 END), 0) as points_for,
        COALESCE(SUM(CASE WHEN tie.team_a_id = t.id THEN tma.points_b WHEN tie.team_b_id = t.id THEN tma.points_a ELSE 0 END), 0) as points_against
    FROM tournament_teams t
    LEFT JOIN tournament_ties tie 
        ON (tie.team_a_id = t.id OR tie.team_b_id = t.id) 
        AND tie.stage = 'POOL'
    LEFT JOIN tie_matches_agg tma ON tma.tie_id = tie.id
    GROUP BY t.tournament_id, t.id, t.name, t.pool, tie.id, tie.state, tie.winner_team_id, tie.team_a_id, tie.team_b_id, tie.score_team_a, tie.score_team_b
),
team_summary AS (
    SELECT
        ts.tournament_id,
        ts.team_id,
        ts.team_name,
        ts.pool,
        COUNT(ts.tie_id) FILTER (WHERE ts.state = 'COMPLETED') as played,
        COUNT(ts.tie_id) FILTER (WHERE ts.state = 'COMPLETED' AND ts.winner_team_id = ts.team_id) as won,
        COUNT(ts.tie_id) FILTER (WHERE ts.state = 'COMPLETED' AND ts.winner_team_id IS NULL AND ts.rubbers_for = ts.rubbers_against) as drawn,
        COUNT(ts.tie_id) FILTER (WHERE ts.state = 'COMPLETED' AND ts.winner_team_id IS NOT NULL AND ts.winner_team_id != ts.team_id) as lost,
        COALESCE(SUM(ts.rubbers_for) FILTER (WHERE ts.state = 'COMPLETED'), 0) as rubbers_for,
        COALESCE(SUM(ts.rubbers_against) FILTER (WHERE ts.state = 'COMPLETED'), 0) as rubbers_against,
        COALESCE(SUM(ts.sets_for) FILTER (WHERE ts.state = 'COMPLETED'), 0) as sets_for,
        COALESCE(SUM(ts.sets_against) FILTER (WHERE ts.state = 'COMPLETED'), 0) as sets_against,
        COALESCE(SUM(ts.points_for) FILTER (WHERE ts.state = 'COMPLETED'), 0) as points_for,
        COALESCE(SUM(ts.points_against) FILTER (WHERE ts.state = 'COMPLETED'), 0) as points_against
    FROM tie_stats_per_team ts
    GROUP BY ts.tournament_id, ts.team_id, ts.team_name, ts.pool
)
SELECT 
    s.tournament_id,
    s.team_id,
    s.team_name,
    s.pool,
    s.played,
    s.won,
    s.drawn,
    s.lost,
    (s.won * COALESCE(tourn.tie_points_win, 2) + s.drawn * COALESCE(tourn.tie_points_draw, 1)) as tie_points,
    s.rubbers_for,
    s.rubbers_against,
    (s.rubbers_for - s.rubbers_against) as rubbers_diff,
    s.sets_for,
    s.sets_against,
    (s.sets_for - s.sets_against) as sets_diff,
    s.points_for,
    s.points_against,
    (s.points_for - s.points_against) as points_diff
FROM team_summary s
JOIN tournaments tourn ON tourn.id = s.tournament_id;

-- 6. RPC: reveal_tie_lineup (Reveal All or Single Rubber by Umpire/Admin)
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
    v_umpire_name text;
BEGIN
    -- Check role: only umpire or tournament manager or admin
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR EXISTS (
        SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('umpire', 'admin', 'master_admin')
    )) THEN
        RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can reveal lineups.';
    END IF;

    SELECT full_name INTO v_umpire_name FROM players WHERE id = auth.uid();

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
                player4_id = v_lineup_b.player2_id
            WHERE id = v_rubber.id;
        ELSE
            UPDATE tournament_matches 
            SET player1_id = v_lineup_a.player1_id,
                player2_id = v_lineup_b.player1_id
            WHERE id = v_rubber.id;
        END IF;

        -- Log audit entry
        INSERT INTO tie_lineup_audits (tie_id, rubber_order, action_type, referee_id, reason)
        VALUES (
            p_tie_id, 
            v_rubber.rubber_order, 
            'REVEALED', 
            auth.uid(), 
            'Revealed by Umpire ' || COALESCE(v_umpire_name, 'Staff')
        );
    END LOOP;

    -- Ensure tie state is IN_PROGRESS
    UPDATE tournament_ties 
    SET state = 'IN_PROGRESS', updated_at = now() 
    WHERE id = p_tie_id AND state IN ('SCHEDULED', 'AWAITING_LINEUPS');

    RETURN true;
END;
$$;

-- 7. RPC: emergency_modify_lineup (Player substitution & order changes with audit trail)
CREATE OR REPLACE FUNCTION emergency_modify_lineup(
    p_tie_id uuid,
    p_side text, -- 'A' or 'B'
    p_rubber_order int,
    p_pos int, -- 1 or 2
    p_new_player_id uuid,
    p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie tournament_ties%ROWTYPE;
    v_old_player_id uuid;
    v_rubber record;
    v_is_doubles boolean;
BEGIN
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    IF NOT (is_admin_or_master() OR is_tournament_manager(v_tie.tournament_id) OR EXISTS (
        SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('umpire', 'admin', 'master_admin')
    )) THEN
        RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can perform emergency modifications.';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid reason is required for emergency modifications.';
    END IF;

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
        reason
    ) VALUES (
        p_tie_id, 
        p_rubber_order, 
        'PLAYER_SUBSTITUTED', 
        v_old_player_id, 
        p_new_player_id, 
        auth.uid(), 
        p_reason
    );

    RETURN true;
END;
$$;

-- 8. RPC: populate_playoff_qualifiers_from_standings
-- Automatically populates knockout playoff ties (e.g. SF 1: A1 vs B2) from current pool standings
CREATE OR REPLACE FUNCTION populate_playoff_qualifiers_from_standings(
    p_tournament_id uuid
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_updated_count int := 0;
    v_tie record;
    v_pool_a_1 uuid;
    v_pool_a_2 uuid;
    v_pool_b_1 uuid;
    v_pool_b_2 uuid;
    v_pool_c_1 uuid;
    v_pool_c_2 uuid;
    v_pool_d_1 uuid;
    v_pool_d_2 uuid;
    v_qualifiers record;
BEGIN
    IF NOT (is_admin_or_master() OR is_tournament_manager(p_tournament_id)) THEN
        RAISE EXCEPTION 'Unauthorized: Only tournament managers can advance qualifiers.';
    END IF;

    -- Collect Pool A Top 2
    SELECT team_id INTO v_pool_a_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'A' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_a_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'A' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    -- Collect Pool B Top 2
    SELECT team_id INTO v_pool_b_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'B' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_b_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'B' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    -- Collect Pool C Top 2
    SELECT team_id INTO v_pool_c_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'C' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_c_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'C' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    -- Collect Pool D Top 2
    SELECT team_id INTO v_pool_d_1 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'D' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 0;
    
    SELECT team_id INTO v_pool_d_2 FROM tournament_team_standings 
    WHERE tournament_id = p_tournament_id AND pool = 'D' 
    ORDER BY tie_points DESC, rubbers_diff DESC, sets_diff DESC, points_diff DESC LIMIT 1 OFFSET 1;

    -- Update Semifinals / Quarterfinals in knockout stage
    -- SF_01 (Usually A1 vs B2)
    UPDATE tournament_ties 
    SET team_a_id = COALESCE(team_a_id, v_pool_a_1), 
        team_b_id = COALESCE(team_b_id, v_pool_b_2),
        updated_at = now()
    WHERE tournament_id = p_tournament_id AND (tie_code = 'SF_01' OR round_name ILIKE '%Semifinal 1%');

    -- SF_02 (Usually B1 vs A2)
    UPDATE tournament_ties 
    SET team_a_id = COALESCE(team_a_id, v_pool_b_1), 
        team_b_id = COALESCE(team_b_id, v_pool_a_2),
        updated_at = now()
    WHERE tournament_id = p_tournament_id AND (tie_code = 'SF_02' OR round_name ILIKE '%Semifinal 2%');

    -- Quarterfinals QF_01..04 if 4 pools exist
    IF v_pool_c_1 IS NOT NULL THEN
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_a_1), team_b_id = COALESCE(team_b_id, v_pool_b_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_01';
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_c_1), team_b_id = COALESCE(team_b_id, v_pool_d_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_02';
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_b_1), team_b_id = COALESCE(team_b_id, v_pool_a_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_03';
        UPDATE tournament_ties SET team_a_id = COALESCE(team_a_id, v_pool_d_1), team_b_id = COALESCE(team_b_id, v_pool_c_2) WHERE tournament_id = p_tournament_id AND tie_code = 'QF_04';
    END IF;

    -- Also sync team labels to rubber matches
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


