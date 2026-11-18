\set ON_ERROR_STOP on

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS iisc_email text;

CREATE TABLE public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false
);

CREATE TABLE public.tournaments (id uuid PRIMARY KEY, created_by uuid);
CREATE TABLE public.tournament_officials (tournament_id uuid, user_id uuid, role text);
CREATE TABLE public.tournament_registrations (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL,
  player_id uuid NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz
);
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_registrations TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
$$;
CREATE OR REPLACE FUNCTION public.is_tournament_official(t_id uuid, p_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_officials
    WHERE tournament_id = t_id AND user_id = auth.uid() AND (p_role IS NULL OR role = p_role)
  )
$$;

DROP POLICY IF EXISTS tournament_registrations_update ON public.tournament_registrations;
CREATE POLICY tournament_registrations_update ON public.tournament_registrations
FOR UPDATE TO authenticated
USING (player_id = auth.uid() OR public.is_admin_or_master() OR public.is_tournament_official(tournament_id))
WITH CHECK (player_id = auth.uid() OR public.is_admin_or_master() OR public.is_tournament_official(tournament_id));

INSERT INTO public.tournaments VALUES ('40000000-0000-0000-0000-000000000001', NULL);

