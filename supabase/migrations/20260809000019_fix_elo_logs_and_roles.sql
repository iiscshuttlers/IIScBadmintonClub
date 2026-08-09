-- 1. Drop foreign key constraint on elo_calculation_logs so it can reference tournament_matches OR matches
ALTER TABLE elo_calculation_logs DROP CONSTRAINT IF EXISTS elo_calculation_logs_match_uuid_fkey;

-- 2. Ensure admin users have the master_admin role in the DB to pass the trigger
UPDATE players 
SET role = 'master_admin' 
WHERE email IN (
  'admin@iisc.ac.in',
  'iiscbadmintonclub@gmail.com',
  'janmejayraja@iisc.ac.in',
  'janmejay@iisc.ac.in',
  'raja79sharma@gmail.com'
);
