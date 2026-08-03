-- 1. Drop Legacy Zombie Policies from db_schema.sql
-- These were left wide-open in the initial schema and never dropped, overriding strict policies.

-- Tournaments

-- Tournament Matches

-- Admin History

-- 2. Secure site_data
-- Drop the wide-open legacy policy

-- Add a new strict policy
DROP POLICY IF EXISTS "Admins can manage site_data strictly" ON site_data;
CREATE POLICY "Admins can manage site_data strictly" ON site_data
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  );

-- 3. Secure Umpire Assignments
-- Drop the compromised policy

-- Create a strict Admin-only policy
DROP POLICY IF EXISTS "Admins can manage umpire assignments strictly" ON umpire_assignments;
CREATE POLICY "Admins can manage umpire assignments strictly" ON umpire_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  );

-- 4. Secure Storage Bucket Deletion
-- Drop the wide-open Auth Delete policy that allowed any user to delete any file in 'find-lost'
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

-- Create strict Admin-only deletion policy
DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'find-lost' AND 
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  );
