-- Restore missing function that is still called by admin_edit_tournament_match
-- Maps to the newer advance_tournament_winner function

CREATE OR REPLACE FUNCTION process_tournament_bracket_progression(p_match_id UUID, p_winner_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- We just delegate to the newer function which only requires the match_id
  PERFORM advance_tournament_winner(p_match_id);
END;
$$;
