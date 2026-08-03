-- Create secure RPC for master_admin to change user roles
CREATE OR REPLACE FUNCTION set_player_role(p_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Authenticate and strictly authorize ONLY master_admin
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'master_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only master_admin can change user roles.';
  END IF;

  -- Validate role input
  IF p_role NOT IN ('user', 'umpire', 'admin', 'master_admin') THEN
    RAISE EXCEPTION 'Invalid role specified. Must be user, umpire, admin, or master_admin.';
  END IF;

  -- Prevent removing the last master_admin (safety check)
  IF p_role != 'master_admin' AND (SELECT role FROM public.players WHERE id = p_id) = 'master_admin' THEN
    IF (SELECT COUNT(*) FROM public.players WHERE role = 'master_admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last master_admin in the system.';
    END IF;
  END IF;

  -- Update the player's role
  UPDATE public.players SET role = p_role WHERE id = p_id;
END;
$$;

-- Revoke execute from public to prevent discovery/abuse
REVOKE EXECUTE ON FUNCTION set_player_role(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_player_role(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION set_player_role(UUID, TEXT) TO authenticated;
