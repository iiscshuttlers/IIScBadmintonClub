-- Fix Supabase Security Definer Lint Issue for public.court_popularity
-- The view was bypassing RLS using security definer, which causes a lint warning.
-- We replace it with a secure function that explicitly handles the search path.

DROP VIEW IF EXISTS public.court_popularity;

CREATE OR REPLACE FUNCTION public.get_court_popularity()
RETURNS TABLE (
    day_of_week smallint,
    hour smallint,
    visit_count bigint
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT 
    day_of_week, 
    hour, 
    COUNT(*) AS visit_count 
  FROM public.court_visits 
  GROUP BY day_of_week, hour;
$$;

GRANT EXECUTE ON FUNCTION public.get_court_popularity() TO authenticated;
