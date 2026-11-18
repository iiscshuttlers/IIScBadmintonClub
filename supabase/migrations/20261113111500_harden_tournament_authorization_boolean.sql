-- Make the shared tournament authorization predicate total (never NULL) and
-- give its SECURITY DEFINER body an explicit search path.
CREATE OR REPLACE FUNCTION public.can_umpire_match(p_match_id UUID, p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.players
      WHERE id = p_uid AND role IN ('admin', 'master_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.tournament_matches
      WHERE id = p_match_id AND umpired_by = p_uid
    )
    OR EXISTS (
      SELECT 1 FROM public.umpire_assignments assignment
      WHERE assignment.user_id = p_uid
        AND (
          assignment.tournament_match_id = p_match_id
          OR (
            assignment.start_time IS NOT NULL
            AND assignment.end_time IS NOT NULL
            AND now() BETWEEN assignment.start_time AND assignment.end_time
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.tournament_matches match
      JOIN public.tournament_officials official
        ON official.tournament_id = match.tournament_id
      WHERE match.id = p_match_id
        AND official.user_id = p_uid
        AND official.role IN ('UMPIRE', 'REFEREE')
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_umpire_match(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_umpire_match(UUID, UUID) TO authenticated, service_role;
