\set ON_ERROR_STOP on
-- Minimal schema for the player-contact privacy assertions.
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
GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE TABLE public.players (
  id uuid PRIMARY KEY, full_name text, nickname text, gender text, avatar_url text, role text DEFAULT 'player',
  is_guest boolean DEFAULT false, deleted_at timestamptz, created_at timestamptz DEFAULT now(),
  email text, iisc_email text, contact_number text, sr_number text, elo_rating int DEFAULT 1200);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY players_read ON public.players FOR SELECT USING (true);
CREATE POLICY players_update_own ON public.players FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
GRANT SELECT, UPDATE ON public.players TO anon, authenticated;

CREATE TABLE public.tournaments (id uuid PRIMARY KEY, created_by uuid, status text DEFAULT 'in_progress');
CREATE TABLE public.tournament_officials (tournament_id uuid, user_id uuid, role text);
CREATE TABLE public.tournament_matches (id uuid PRIMARY KEY, tournament_id uuid, player1_id uuid, player2_id uuid, player3_id uuid, player4_id uuid);
CREATE TABLE public.site_data (key text PRIMARY KEY, value jsonb);
CREATE TABLE public.venue_presence_events (id serial PRIMARY KEY, player_id uuid);
ALTER TABLE public.venue_presence_events ENABLE ROW LEVEL SECURITY;
GRANT INSERT, SELECT ON public.venue_presence_events TO authenticated;
GRANT USAGE ON SEQUENCE public.venue_presence_events_id_seq TO authenticated;
-- The legacy caller-rights policy (20260805000001) that reads players.email.
CREATE POLICY "Users can log their own presence events" ON public.venue_presence_events FOR INSERT
  WITH CHECK (auth.uid() = player_id OR (select email from players where id = player_id) = auth.jwt()->>'email');
CREATE POLICY presence_read ON public.venue_presence_events FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.is_tournament_official(t_id uuid, p_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
      OR EXISTS (SELECT 1 FROM tournaments t WHERE t.id = t_id AND t.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM tournament_officials o WHERE o.tournament_id = t_id AND o.user_id = auth.uid()
                 AND (p_role IS NULL OR o.role = p_role));
$$;

INSERT INTO public.players (id, full_name, role, email, iisc_email, contact_number) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Admin',   'admin',  'admin@x.test',  NULL, '900'),
  ('00000000-0000-0000-0000-0000000000b1', 'Asha',    'player', 'asha@x.test',   'asha@iisc.ac.in', '911'),
  ('00000000-0000-0000-0000-0000000000b2', 'Bina',    'player', 'bina@x.test',   NULL, '922'),
  ('00000000-0000-0000-0000-0000000000b3', 'Chitra',  'player', 'chitra@x.test', NULL, '933'),
  ('00000000-0000-0000-0000-0000000000c1', 'Umpire',  'player', 'ump@x.test',    NULL, '944'),
  -- Account whose auth id differs from its player row (legacy email-linked).
  ('00000000-0000-0000-0000-0000000000d1', 'Dev',     'player', 'dev@x.test',    NULL, '955');
INSERT INTO public.tournaments VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.tournament_officials VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'UMPIRE');
-- Asha plays Bina; Chitra is in the event but not against Asha.
INSERT INTO public.tournament_matches VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', NULL, NULL),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d1', NULL, NULL);
