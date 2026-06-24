-- ============================================================
-- RLS SECURITY AUDIT
-- Run this in Supabase SQL Editor to verify all tables have
-- RLS enabled and appropriate policies in place.
-- ============================================================

-- 1. List all tables and their RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operation,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Find tables that have NO policies (potential open access)
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;

-- 4. Verify key tables enforce authenticated-only read
-- Expected: players, matches, find_lost_posts, admin_logs should restrict to auth.role() = 'authenticated'
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('players','matches','find_lost_posts','admin_logs','user_push_tokens','challenges','achievements')
  AND cmd = 'SELECT'
ORDER BY tablename;

-- 5. Check for any SELECT policy using USING (true) — open to everyone
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND (qual = 'true' OR qual IS NULL)
ORDER BY tablename;

-- 6. Check INSERT policies — ensure WITH CHECK is not trivially true
SELECT tablename, policyname, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT','ALL')
  AND (with_check = 'true' OR with_check IS NULL)
ORDER BY tablename;

-- 7. Confirm admin_logs only allows admins to read (service_role or explicit email check)
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'admin_logs';

-- ============================================================
-- RECOMMENDED FIXES (apply if audit reveals gaps):
-- ============================================================

-- Enable RLS on any table found without it:
-- ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- Restrict SELECT to authenticated users only:
-- CREATE POLICY "Authenticated read" ON public.<table_name>
--   FOR SELECT USING (auth.role() = 'authenticated');

-- Restrict INSERT to row owner:
-- CREATE POLICY "Owner insert" ON public.<table_name>
--   FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Restrict UPDATE/DELETE to owner:
-- CREATE POLICY "Owner modify" ON public.<table_name>
--   FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- KNOWN POLICIES SUMMARY (as of 2026-06):
-- players         — auth read, owner update, admin all
-- matches         — auth read, RPC insert (submit_friendly_match), admin update/delete
-- find_lost_posts — auth read, author insert/update/delete
-- admin_logs      — admin read, authenticated insert
-- user_push_tokens— owner all
-- tournament_registrations — auth read, owner insert
-- ============================================================
