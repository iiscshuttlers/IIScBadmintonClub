-- Migration: Merge Guest Player RPC
-- Description: Function to merge a guest profile into a real registered user profile.

CREATE OR REPLACE FUNCTION merge_guest_player(guest_id uuid, real_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Ensure caller is an admin or master_admin
    IF NOT EXISTS (
        SELECT 1 FROM players 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'master_admin')
    ) THEN
        RAISE EXCEPTION 'Only admins can merge profiles.';
    END IF;

    -- 2. Validate that the guest_id actually belongs to a guest profile
    IF NOT EXISTS (
        SELECT 1 FROM players 
        WHERE id = guest_id 
        AND is_guest = true
    ) THEN
        RAISE EXCEPTION 'Source profile is not a valid guest player.';
    END IF;

    -- 3. Validate that real_id exists
    IF NOT EXISTS (
        SELECT 1 FROM players WHERE id = real_id
    ) THEN
        RAISE EXCEPTION 'Target profile does not exist.';
    END IF;

    -- 4. Reassign Matches
    UPDATE matches SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE matches SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE matches SET player3_id = real_id WHERE player3_id = guest_id;
    UPDATE matches SET player4_id = real_id WHERE player4_id = guest_id;
    UPDATE matches SET umpired_by = real_id WHERE umpired_by = guest_id;
    UPDATE matches SET recorded_by = real_id WHERE recorded_by = guest_id;

    -- 5. Reassign Tournament Matches
    UPDATE tournament_matches SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tournament_matches SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE tournament_matches SET player3_id = real_id WHERE player3_id = guest_id;
    UPDATE tournament_matches SET player4_id = real_id WHERE player4_id = guest_id;
    UPDATE tournament_matches SET umpired_by = real_id WHERE umpired_by = guest_id;
    UPDATE tournament_matches SET recorded_by = real_id WHERE recorded_by = guest_id;

    -- 6. Reassign Tournament Participants
    UPDATE tournament_participants SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tournament_participants SET player2_id = real_id WHERE player2_id = guest_id;

    -- 7. Reassign Team Events (Tournaments Phase 2)
    UPDATE tournament_teams SET captain_id = real_id WHERE captain_id = guest_id;
    UPDATE tournament_team_members SET player_id = real_id WHERE player_id = guest_id;
    UPDATE tournament_team_members SET invited_by = real_id WHERE invited_by = guest_id;
    UPDATE tie_lineups SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tie_lineups SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE tie_lineups SET submitted_by = real_id WHERE submitted_by = guest_id;

    -- 8. Reassign ELO logs
    UPDATE elo_calculation_logs SET player_id = real_id WHERE player_id = guest_id;

    -- 9. Delete the Guest Profile
    -- This relies on ON DELETE CASCADE for any remaining tables we might have missed,
    -- or if we didn't miss anything, it just deletes the record.
    DELETE FROM players WHERE id = guest_id;

END;
$$;
