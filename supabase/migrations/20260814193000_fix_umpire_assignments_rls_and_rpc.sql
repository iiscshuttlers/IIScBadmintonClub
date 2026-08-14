-- Relax foreign key constraints that might fail on non-auth player UUIDs
ALTER TABLE umpire_assignments ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE umpire_assignments DROP CONSTRAINT IF EXISTS umpire_assignments_created_by_fkey;
ALTER TABLE umpire_assignments DROP CONSTRAINT IF EXISTS umpire_assignments_user_id_fkey;

DROP POLICY IF EXISTS "Admins can manage umpire assignments strictly" ON umpire_assignments;
DROP POLICY IF EXISTS "Admins can manage umpire assignments" ON umpire_assignments;
DROP POLICY IF EXISTS "Anyone can view umpire assignments" ON umpire_assignments;

-- Allow anyone to view umpire assignments
CREATE POLICY "Anyone can view umpire assignments" ON umpire_assignments
  FOR SELECT USING (true);

-- Allow admins to insert/update/delete umpire assignments
CREATE POLICY "Admins can manage umpire assignments strictly" ON umpire_assignments
  FOR ALL USING (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM public.players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin')
    )
  )
  WITH CHECK (
    (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM public.players 
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin')
    )
  );

-- RPC for assigning multiple umpires reliably
CREATE OR REPLACE FUNCTION admin_assign_umpires(
  p_user_ids UUID[],
  p_tournament_match_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_count INTEGER := 0;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Check if calling user is admin
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_admin := true;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can assign umpires';
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids
  LOOP
    INSERT INTO umpire_assignments (user_id, tournament_match_id, start_time, end_time, created_by)
    VALUES (v_uid, p_tournament_match_id, p_start_time, p_end_time, auth.uid());
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- RPC for deleting an assignment reliably
CREATE OR REPLACE FUNCTION admin_delete_umpire_assignment(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := false;
BEGIN
  -- Check if calling user is admin
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_admin := true;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete umpire assignments';
  END IF;

  DELETE FROM umpire_assignments WHERE id = p_id;
END;
$$;
