\set ON_ERROR_STOP on

-- Add the representative columns and foundational notification tables that
-- result_revision_bootstrap intentionally omits. This harness is for replaying
-- the WP4 and WP9 additive migrations in isolation.

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
$$;

ALTER TABLE public.tournaments
  ADD COLUMN name text,
  ADD COLUMN description text,
  ADD COLUMN categories text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN unavailable_court_periods jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN estimated_match_minutes integer DEFAULT 30,
  ADD COLUMN show_participants boolean DEFAULT false,
  ADD COLUMN show_brackets boolean DEFAULT false,
  ADD COLUMN created_by uuid;

ALTER TABLE public.tournament_matches
  ADD COLUMN category text,
  ADD COLUMN round_name text,
  ADD COLUMN match_number integer,
  ADD COLUMN result_revision bigint NOT NULL DEFAULT 0;

ALTER TABLE public.tournament_participants
  ADD COLUMN player_id uuid REFERENCES public.players(id);

CREATE TABLE public.user_player_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  notify_before_mins integer NOT NULL DEFAULT 15,
  UNIQUE (user_id, player_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  audience text NOT NULL DEFAULT 'custom',
  recipient_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error text,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.admin_edit_tournament_match(
  p_match_id uuid,
  p_winner_side smallint,
  p_score text,
  p_sets text[],
  p_umpire_id uuid
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.tournament_matches
  SET winner_side = p_winner_side,
      score = p_score,
      sets_history = p_sets
  WHERE id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tournament_official(t_id uuid, p_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_master()
      OR EXISTS (
        SELECT 1 FROM public.tournaments t
        WHERE t.id = t_id AND t.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.tournament_officials o
        WHERE o.tournament_id = t_id
          AND o.user_id = auth.uid()
          AND (p_role IS NULL OR o.role = p_role)
      )
$$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT ON public.players, public.tournaments, public.tournament_matches,
  public.tournament_officials, public.user_player_subscriptions,
  public.notifications, public.scheduled_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt(), auth.role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_master(), public.is_tournament_official(uuid, text)
TO authenticated;
