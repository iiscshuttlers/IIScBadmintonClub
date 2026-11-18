DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'email', current_setting('request.jwt.claim.email', true),
    'sub', current_setting('request.jwt.claim.sub', true)
  )
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  iisc_email text,
  role text NOT NULL
);

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  venue text,
  format_family text,
  tournament_type text,
  counts_for_elo boolean NOT NULL DEFAULT false
);

CREATE TABLE public.tournament_teams (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id)
);

CREATE TABLE public.tournament_ties (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id)
);

CREATE TABLE public.tournament_participants (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
  category text NOT NULL,
  partner_id uuid,
  display_name text
);

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
  match_code text,
  winner_side smallint,
  score text,
  sets_history text[],
  status text NOT NULL DEFAULT 'pending',
  umpired_by uuid,
  player1_id uuid,
  player2_id uuid,
  player3_id uuid,
  player4_id uuid,
  team1_label text,
  team2_label text,
  points_to_win integer,
  best_of_sets integer,
  golden_point integer,
  reminder_sent boolean DEFAULT false,
  court_number text,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  tie_id uuid,
  finalize_count integer NOT NULL DEFAULT 0,
  advances_to_match text,
  advances_to_position smallint,
  advances_to_match_loser text,
  advances_to_position_loser smallint,
  loser_advances_to_match text,
  winner_id uuid,
  scored_by uuid,
  scored_at timestamptz
);

CREATE TABLE public.tournament_officials (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'UMPIRE'
);

CREATE TABLE public.umpire_assignments (
  user_id uuid NOT NULL,
  tournament_match_id uuid,
  start_time timestamptz,
  end_time timestamptz
);

CREATE TABLE public.admin_logs (
  id bigserial PRIMARY KEY,
  admin_email text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.can_umpire_match(p_match_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM players
      WHERE id = p_uid AND role IN ('admin', 'master_admin')
    )
    OR EXISTS (
      SELECT 1 FROM tournament_matches
      WHERE id = p_match_id AND umpired_by = p_uid
    )
    OR EXISTS (
      SELECT 1 FROM umpire_assignments a
      WHERE a.user_id = p_uid
        AND (
          a.tournament_match_id = p_match_id
          OR (a.start_time IS NOT NULL AND a.end_time IS NOT NULL
              AND now() BETWEEN a.start_time AND a.end_time)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.advance_tournament_winner(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  NULL;
END;
$$;

CREATE FUNCTION public.submit_tournament_match(
  p_match_id uuid,
  p_winner_side smallint,
  p_score text,
  p_sets text[],
  p_umpire_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.tournament_matches
  SET winner_side = p_winner_side,
      score = p_score,
      sets_history = p_sets,
      status = 'completed',
      finalize_count = finalize_count + 1
  WHERE id = p_match_id;
END;
$$;
