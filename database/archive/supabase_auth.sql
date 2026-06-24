CREATE OR REPLACE FUNCTION auth.restrict_to_iisc_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'iiscbadmintonclub@gmail.com' THEN
    RETURN NEW;
  END IF;

  IF NEW.email NOT LIKE '%@iisc.ac.in' THEN
    RAISE EXCEPTION 'Registration is restricted to @iisc.ac.in email addresses only.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_iisc_email_domain ON auth.users;
CREATE TRIGGER enforce_iisc_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.restrict_to_iisc_domain();
