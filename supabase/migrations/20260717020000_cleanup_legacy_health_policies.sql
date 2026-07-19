DO $$ 
DECLARE 
  pol record;
BEGIN
  -- Cleanup legacy policies on match_health_data
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'match_health_data' 
      AND policyname NOT IN (
        'Players can read own match health data',
        'Players can insert own match health data',
        'Players can update own match health data',
        'Players can delete own match health data',
        'Admins can read all match health data'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.match_health_data', pol.policyname);
  END LOOP;

  -- Cleanup legacy policies on player_sleep_data
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'player_sleep_data' 
      AND policyname NOT IN (
        'Players can read own sleep data',
        'Players can insert own sleep data',
        'Players can update own sleep data',
        'Players can delete own sleep data',
        'Admins can read all sleep data'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.player_sleep_data', pol.policyname);
  END LOOP;
END $$;
