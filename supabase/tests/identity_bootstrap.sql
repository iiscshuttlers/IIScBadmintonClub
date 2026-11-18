\set ON_ERROR_STOP on
-- Minimal schema for WP8 identity assertions (independent of the WP1 harness).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('email', current_setting('request.jwt.claim.email', true),
                            'sub', current_setting('request.jwt.claim.sub', true)) $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;

CREATE TABLE public.players (id uuid PRIMARY KEY, full_name text, email text, role text DEFAULT 'player',
  is_guest boolean DEFAULT false, deleted_at timestamptz);
CREATE TABLE public.admin_logs (id bigserial PRIMARY KEY, admin_email text NOT NULL, action text NOT NULL,
  details jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.matches (id uuid PRIMARY KEY, player1_id uuid REFERENCES public.players(id),
  player2_id uuid REFERENCES public.players(id), team1_partner_id uuid REFERENCES public.players(id),
  team2_partner_id uuid REFERENCES public.players(id), winner_id uuid REFERENCES public.players(id), status text);
CREATE TABLE public.tournament_matches (id uuid PRIMARY KEY, player1_id uuid, player2_id uuid, player3_id uuid,
  player4_id uuid, winner_id uuid, status text);
CREATE TABLE public.tournament_participants (id uuid PRIMARY KEY, tournament_id uuid, category text,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE, partner_id uuid);
CREATE TABLE public.elo_calculation_logs (id uuid PRIMARY KEY, player_id uuid, new_elo int);
CREATE TABLE public.player_badges (id serial PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE);
GRANT USAGE ON SCHEMA public TO anon, authenticated;

INSERT INTO public.players (id, full_name, role, is_guest) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin', false),
  ('00000000-0000-0000-0000-0000000000b1', 'Asha Rao', 'player', false),
  ('00000000-0000-0000-0000-0000000000b2', 'Bina', 'player', false),
  ('00000000-0000-0000-0000-0000000000c1', 'Asha Rao', 'player', true),
  ('00000000-0000-0000-0000-0000000000c2', 'Clash Guest', 'player', true);

-- Guest c1 history: friendly match, tournament match (no FK), event entry
-- (FK with ON DELETE CASCADE), Elo log and a badge (cascade).
INSERT INTO public.matches VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000b2', NULL, NULL, '00000000-0000-0000-0000-0000000000c1', 'confirmed');
INSERT INTO public.tournament_matches VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000c1', NULL, NULL, '00000000-0000-0000-0000-0000000000c1', 'completed');
INSERT INTO public.tournament_participants VALUES
  ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'MS',
   '00000000-0000-0000-0000-0000000000c1', NULL);
INSERT INTO public.elo_calculation_logs VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 1040);
INSERT INTO public.player_badges (player_id) VALUES ('00000000-0000-0000-0000-0000000000c1');

-- Guest c2 played AGAINST member b1: merging would create a self-match.
INSERT INTO public.matches VALUES
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2',
   '00000000-0000-0000-0000-0000000000b1', NULL, NULL, '00000000-0000-0000-0000-0000000000b1', 'confirmed');
