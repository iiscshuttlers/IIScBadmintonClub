CREATE OR REPLACE FUNCTION public.create_guest_player_with_email(
  p_email TEXT,
  p_full_name TEXT
) RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_row    public.players;
  v_name   TEXT := btrim(p_full_name);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = v_caller AND role IN ('master_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can create guest players';
  END IF;

  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Guest name is required';
  END IF;

  INSERT INTO public.players (id, full_name, email, is_guest, created_by, is_approved)
  VALUES (gen_random_uuid(), v_name, p_email, true, v_caller, true)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_guest_player_with_email(TEXT, TEXT) TO authenticated;

-- Update auto_claim_duplicate_profile to transfer team memberships
CREATE OR REPLACE FUNCTION auto_claim_duplicate_profile()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_email TEXT;
  v_old_id UUID;
  v_new_id UUID;
BEGIN
  v_new_id := auth.uid();
  v_auth_email := (auth.jwt() ->> 'email');
  
  IF v_auth_email IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO v_old_id 
  FROM players 
  WHERE (email = v_auth_email OR iisc_email = v_auth_email) 
    AND id != v_new_id
  ORDER BY is_guest DESC
  LIMIT 1;

  IF v_old_id IS NULL THEN
    RETURN false;
  END IF;

  -- Match references
  UPDATE matches SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE matches SET player2_id = v_new_id WHERE player2_id = v_old_id;
  UPDATE matches SET team1_partner_id = v_new_id WHERE team1_partner_id = v_old_id;
  UPDATE matches SET team2_partner_id = v_new_id WHERE team2_partner_id = v_old_id;
  UPDATE matches SET winner_id = v_new_id WHERE winner_id = v_old_id;
  UPDATE matches SET submitted_by = v_new_id WHERE submitted_by = v_old_id;
  
  -- Tournament specific references
  UPDATE tournament_registrations SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE tournament_registrations SET player2_id = v_new_id WHERE player2_id = v_old_id;
  
  -- Team references (New for Team Events)
  UPDATE tournament_team_members SET player_id = v_new_id WHERE player_id = v_old_id;
  UPDATE tournament_teams SET captain_id = v_new_id WHERE captain_id = v_old_id;

  -- Other
  UPDATE elo_logs SET player_id = v_new_id WHERE player_id = v_old_id;
  UPDATE venue_presence_events SET player_id = v_new_id WHERE player_id = v_old_id;
  UPDATE feedback SET user_id = v_new_id WHERE user_id = v_old_id;

  -- Delete the old row
  DELETE FROM players WHERE id = v_old_id;

  RETURN true;
END;
$$;
