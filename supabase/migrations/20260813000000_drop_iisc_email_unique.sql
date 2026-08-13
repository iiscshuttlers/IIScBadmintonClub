-- Drop the unique constraint on iisc_email to allow duplicate profiles
DO $$
BEGIN
  -- We assume standard constraint naming or just try to drop the ones we know
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_iisc_email_key;
  
  -- Sometimes it's created as a unique index rather than a constraint, so we drop that too
  DROP INDEX IF EXISTS players_iisc_email_key;
END $$;
