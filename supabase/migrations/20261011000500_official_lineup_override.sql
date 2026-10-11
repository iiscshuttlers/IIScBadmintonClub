-- ─────────────────────────────────────────────────────────────────────────────
-- Official lineup override
--
-- Let match officials (admins, the tournament manager, and assigned
-- organizers / referees / umpires, plus global-role umpires) submit and lock a
-- team's tie lineup ON BEHALF of a captain who is unavailable.
--
-- Previously only admins / tournament managers / that team's staff could write
-- tie_lineups or call lock_tie_lineup. This extends the two write policies and
-- the lock RPC with `is_tournament_official(tournament_id)` and the global
-- umpire role, matching the authorization already used by reveal_tie_lineup /
-- set_tie_playing_order. All overrides are audit-stamped via submitted_by
-- (upsert) and the existing tie_lineup_audits trail (lock/reveal).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. tie_lineups INSERT — allow officials for either side.
DROP POLICY IF EXISTS "Managers and staff can insert tie_lineups" ON tie_lineups;
CREATE POLICY "Managers and staff can insert tie_lineups" ON tie_lineups
FOR INSERT WITH CHECK (
    is_admin_or_master()
    OR is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
    OR is_tournament_official((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
    OR EXISTS (SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('umpire', 'admin', 'master_admin'))
    OR (side = 'A' AND is_team_staff((SELECT team_a_id FROM tournament_ties WHERE id = tie_id)))
    OR (side = 'B' AND is_team_staff((SELECT team_b_id FROM tournament_ties WHERE id = tie_id)))
);

-- 2. tie_lineups UPDATE — same.
DROP POLICY IF EXISTS "Managers and staff can update tie_lineups" ON tie_lineups;
CREATE POLICY "Managers and staff can update tie_lineups" ON tie_lineups
FOR UPDATE USING (
    is_admin_or_master()
    OR is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
    OR is_tournament_official((SELECT tournament_id FROM tournament_ties WHERE id = tie_id))
    OR EXISTS (SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('umpire', 'admin', 'master_admin'))
    OR (side = 'A' AND is_team_staff((SELECT team_a_id FROM tournament_ties WHERE id = tie_id)))
    OR (side = 'B' AND is_team_staff((SELECT team_b_id FROM tournament_ties WHERE id = tie_id)))
);

-- 3. lock_tie_lineup — allow officials to lock on a team's behalf.
CREATE OR REPLACE FUNCTION lock_tie_lineup(
    p_tie_id uuid,
    p_side text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_team_id uuid;
    v_locked_a boolean;
    v_locked_b boolean;
    v_tournament_id uuid;
BEGIN
    SELECT team_a_id, tournament_id, lineup_locked_a, lineup_locked_b
    INTO v_team_id, v_tournament_id, v_locked_a, v_locked_b
    FROM tournament_ties WHERE id = p_tie_id FOR UPDATE;

    v_team_id := CASE WHEN p_side = 'A'
        THEN (SELECT team_a_id FROM tournament_ties WHERE id = p_tie_id)
        ELSE (SELECT team_b_id FROM tournament_ties WHERE id = p_tie_id) END;

    IF NOT (
        is_admin_or_master()
        OR is_tournament_manager(v_tournament_id)
        OR is_tournament_official(v_tournament_id)
        OR EXISTS (SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('umpire', 'admin', 'master_admin'))
        OR is_team_staff(v_team_id)
    ) THEN
        RAISE EXCEPTION 'Unauthorized to lock lineup.';
    END IF;

    IF p_side = 'A' THEN
        UPDATE tournament_ties SET lineup_locked_a = true WHERE id = p_tie_id;
        v_locked_a := true;
    ELSE
        UPDATE tournament_ties SET lineup_locked_b = true WHERE id = p_tie_id;
        v_locked_b := true;
    END IF;

    -- When both sides lock, transition to AWAITING_REVEAL so the official knows
    -- lineups are ready to reveal. (Reveal stays a separate explicit action.)
    IF v_locked_a AND v_locked_b THEN
        UPDATE tournament_ties SET state = 'AWAITING_REVEAL', updated_at = now() WHERE id = p_tie_id;
    END IF;

    RETURN true;
END;
$$;
