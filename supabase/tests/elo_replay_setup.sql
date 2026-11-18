\set ON_ERROR_STOP on
-- Setup for the Elo replay alignment check (20261115120000_ranked_only_elo_replay.sql). Run order:
--   elo_replay_setup.sql → elo_live_helpers.sql → 20261115120000_ranked_only_elo_replay.sql → elo_replay_check.sql
-- Running the live (pre-fix) replay instead of the migration makes the check
-- fail with "unranked match moved Elo", reproducing the bug.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE public.players (
  id uuid PRIMARY KEY, full_name text, role text DEFAULT 'player',
  singles_matches_played int DEFAULT 0, doubles_matches_played int DEFAULT 0, mixed_matches_played int DEFAULT 0,
  singles_elo int DEFAULT 1200, doubles_elo int DEFAULT 1200, mixed_elo int DEFAULT 1200,
  tournament_singles_elo int DEFAULT 1200, tournament_doubles_elo int DEFAULT 1200, tournament_mixed_elo int DEFAULT 1200,
  elo_rating int DEFAULT 1200, tournament_elo int DEFAULT 1200);
CREATE TABLE public.tournaments (id uuid PRIMARY KEY, status text DEFAULT 'completed', counts_for_elo boolean);
CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY, tournament_id uuid, category text, status text, player1_id uuid, player2_id uuid,
  player3_id uuid, player4_id uuid, winner_id uuid, winner_side smallint, sets_history text[], score text,
  scored_at timestamptz, ended_at timestamptz);
CREATE TABLE public.site_data (key text PRIMARY KEY, value jsonb);
CREATE TABLE public.elo_calculation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_uuid uuid, player_id uuid, previous_elo int, new_elo int,
  elo_change int, expected_score numeric, actual_score numeric, category text, created_at timestamptz DEFAULT now());

INSERT INTO public.players (id, full_name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-000000000001', 'P1', 'player'),
  ('00000000-0000-0000-0000-000000000002', 'P2', 'player'),
  ('00000000-0000-0000-0000-000000000003', 'P3', 'player'),
  ('00000000-0000-0000-0000-000000000004', 'P4', 'player');
INSERT INTO public.tournaments VALUES
  ('10000000-0000-0000-0000-000000000001', 'completed', true),   -- ranked
  ('10000000-0000-0000-0000-000000000002', 'completed', false);  -- unranked
INSERT INTO public.tournament_matches VALUES
  -- ranked singles, P1 beats P2
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'MS', 'completed',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', NULL, NULL,
   '00000000-0000-0000-0000-000000000001', 1, ARRAY['21-10','21-12'], '21-10, 21-12', '2026-10-01 10:00+00', NULL),
  -- unranked singles, P2 beats P1 (must not count)
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'MS', 'completed',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', NULL, NULL,
   '00000000-0000-0000-0000-000000000002', 2, ARRAY['10-21','12-21'], '10-21, 12-21', '2026-10-02 10:00+00', NULL),
  -- ranked doubles (MD) must update doubles, not mixed. (Live scoring also maps
  -- BS/GS/BD/GD codes; the replay buckets by substring — no such categories in
  -- production as of 14 Nov 2026.)
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'MD', 'completed',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001', 1, ARRAY['21-19','21-19'], '21-19, 21-19', '2026-10-03 10:00+00', NULL);

-- Columns/trigger the ranked-only replay migration expects.
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS name text; ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS tie_id uuid;
CREATE OR REPLACE FUNCTION public.noop_trg() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER trg_enforce_ranked_gate BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.noop_trg();
