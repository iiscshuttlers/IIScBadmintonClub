-- Create an RPC to check if an email exists in auth.users
-- This is explicitly requested by the frontend during sign-up to prevent
-- exhausting Supabase Auth rate limits with invalid attempts.
-- Note: This is a SECURITY DEFINER function so it bypasses RLS and can query auth.users.

CREATE OR REPLACE FUNCTION check_email_exists(lookup_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    email_found BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE email = lookup_email
    ) INTO email_found;

    RETURN email_found;
END;
$$;
