-- Fix RBAC check for admin_approve_players to support admins without a linked players row matching auth.uid()
CREATE OR REPLACE FUNCTION admin_approve_players(p_ids UUID[], p_approved BOOLEAN DEFAULT true) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_authorized BOOLEAN := false;
BEGIN
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE players SET is_approved = p_approved WHERE id = ANY(p_ids);
END;
$$;
