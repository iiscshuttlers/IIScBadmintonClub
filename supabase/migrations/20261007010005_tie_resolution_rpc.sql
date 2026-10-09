-- 20261007010005_tie_resolution_rpc.sql
CREATE OR REPLACE FUNCTION set_tie_result(
    p_tie_id uuid,
    p_winner_team_id uuid,
    p_note text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tie record;
BEGIN
    SELECT * INTO v_tie FROM tournament_ties WHERE id = p_tie_id;
    
    IF NOT is_tournament_manager(v_tie.tournament_id) THEN
        RAISE EXCEPTION 'Only tournament managers can manually set a tie result.';
    END IF;

    -- Update tie
    UPDATE tournament_ties 
    SET 
        winner_team_id = p_winner_team_id,
        state = 'COMPLETED',
        -- Use a note column if we had one, but we don't. We'll just force the state.
        updated_at = now()
    WHERE id = p_tie_id;

    RETURN true;
END;
$$;
