CREATE OR REPLACE FUNCTION protect_player_sensitive_columns() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If any sensitive columns have been modified
  IF NEW.role IS DISTINCT FROM OLD.role OR
     NEW.is_guest IS DISTINCT FROM OLD.is_guest OR
     NEW.approved IS DISTINCT FROM OLD.approved OR
     NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
     
     -- Check if current user is an admin or master_admin, or if it's the service role
     IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
       IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
         -- Revert the sensitive changes silently instead of throwing an error,
         -- so standard users can still update their bio/nickname in the same REST call if their client sends the full object.
         NEW.role = OLD.role;
         NEW.is_guest = OLD.is_guest;
         NEW.approved = OLD.approved;
         NEW.deleted_at = OLD.deleted_at;
       END IF;
     END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_player_sensitive_columns ON public.players;
CREATE TRIGGER tr_protect_player_sensitive_columns
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION protect_player_sensitive_columns();
