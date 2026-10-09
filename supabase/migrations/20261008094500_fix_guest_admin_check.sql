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

  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Guest name is required';
  END IF;

  INSERT INTO public.players (id, full_name, email, is_guest, created_by, is_approved)
  VALUES (gen_random_uuid(), v_name, p_email, true, v_caller, true)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
