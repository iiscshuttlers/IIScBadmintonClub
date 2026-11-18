\set ON_ERROR_STOP on
-- Minimal schema the WP7 migration expects beyond result_revision_bootstrap.sql.
ALTER TABLE public.tournament_participants ADD COLUMN IF NOT EXISTS seed integer;
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS schedule_override_reason text,
  ADD COLUMN IF NOT EXISTS schedule_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_overridden_by uuid;
CREATE OR REPLACE FUNCTION public.is_tournament_official(t_id uuid, p_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
      OR EXISTS (SELECT 1 FROM tournament_officials o WHERE o.tournament_id = t_id AND o.user_id = auth.uid());
$$;
