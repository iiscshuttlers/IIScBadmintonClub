-- Tournament visibility (RLS) assertions.
--
-- Self-contained: creates its own players, tournaments and children inside a
-- transaction that always ends in ROLLBACK, so it is safe on any database
-- that has the migrations applied (local, staging or production). Each check
-- runs as the real anon / authenticated role with JWT claims set, and raises
-- an exception on the first mismatch. On success the last statement prints
-- how many checks passed.
--
-- Run: npx --no-install supabase db query --remote --yes -f supabase/tests/tournament_visibility_assertions.sql
--  or: psql "$DATABASE_URL" -f supabase/tests/tournament_visibility_assertions.sql
--
-- Covers: drafts and trash hidden from anon and members; creators, assigned
-- officials and admins (including an admin matched only by e-mail) keep
-- access; trashed matches hidden from everyone; the child public read
-- policies exclude draft and deleted on their own; player_matches_unified
-- follows RLS; host and admin writes; and three static guards (no USING
-- (true) read policy on tournaments, no inline role lookup on players in any
-- policy, child public reads exclude 'deleted').
BEGIN;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL, email text NOT NULL DEFAULT '');
CREATE TEMP TABLE passed (n int);
INSERT INTO pg_temp.passed VALUES (0);

-- Logins. players.id = the auth uid for everyone except admin_by_email, whose
-- players row has a different id and is matched by e-mail only.
INSERT INTO pg_temp.fx (name, id) VALUES
  ('master', gen_random_uuid()), ('admin_row', gen_random_uuid()),
  ('admin_by_email', gen_random_uuid()), ('umpire', gen_random_uuid()),
  ('host', gen_random_uuid()), ('member', gen_random_uuid()),
  ('official', gen_random_uuid()), ('captain', gen_random_uuid()),
  ('team_player', gen_random_uuid()), ('declined', gen_random_uuid());
UPDATE pg_temp.fx SET email = 'rls-admin-by-email@rls-test.invalid' WHERE name = 'admin_by_email';

INSERT INTO public.players (id, full_name, role, email)
SELECT f.id, 'RLS test ' || f.name, r.role, r.email
  FROM pg_temp.fx f
  JOIN (VALUES ('master', 'master_admin', NULL),
               ('admin_row', 'admin', 'rls-admin-by-email@rls-test.invalid'),
               ('umpire', 'umpire', NULL),
               ('host', 'player', NULL),
               ('member', 'player', NULL),
               ('official', 'player', NULL),
               ('captain', 'player', NULL),
               ('team_player', 'player', NULL),
               ('declined', 'player', NULL)) r(name, role, email)
    ON r.name = f.name;

-- Tournaments: one public, one draft, one trashed; each with a match, an
-- entrant and a round rule. The official is a REFEREE on the draft only.
INSERT INTO pg_temp.fx (name, id) VALUES
  ('public', gen_random_uuid()), ('draft', gen_random_uuid()), ('trashed', gen_random_uuid());
INSERT INTO public.tournaments (id, name, year, status, created_by)
SELECT f.id, 'RLS test ' || f.name, 2026, CASE f.name WHEN 'draft' THEN 'draft' ELSE 'completed' END,
       (SELECT id FROM pg_temp.fx WHERE name = 'host')
  FROM pg_temp.fx f WHERE f.name IN ('public', 'draft', 'trashed');
INSERT INTO public.tournament_officials (tournament_id, user_id, role)
VALUES ((SELECT id FROM pg_temp.fx WHERE name = 'draft'), (SELECT id FROM pg_temp.fx WHERE name = 'official'), 'REFEREE');

-- A team on the draft: captain, an ACTIVE player and a DECLINED invitee.
INSERT INTO pg_temp.fx (name, id) VALUES ('draft_team', gen_random_uuid());
INSERT INTO public.tournament_teams (id, tournament_id, name, short_name, captain_id)
VALUES ((SELECT id FROM pg_temp.fx WHERE name = 'draft_team'), (SELECT id FROM pg_temp.fx WHERE name = 'draft'),
        'RLS test team', 'RLST', (SELECT id FROM pg_temp.fx WHERE name = 'captain'));
INSERT INTO public.tournament_team_members (team_id, tournament_id, player_id, role, status)
SELECT (SELECT id FROM pg_temp.fx WHERE name = 'draft_team'), (SELECT id FROM pg_temp.fx WHERE name = 'draft'), f.id, 'PLAYER', s.status
  FROM pg_temp.fx f JOIN (VALUES ('team_player', 'ACTIVE'), ('declined', 'DECLINED')) s(name, status) ON s.name = f.name;

INSERT INTO pg_temp.fx (name, id)
SELECT f.name || '_match', gen_random_uuid() FROM pg_temp.fx f WHERE f.name IN ('public', 'draft', 'trashed');
INSERT INTO public.tournament_matches (id, tournament_id, category, match_code, round, round_name, match_number, status)
SELECT m.id, t.id, 'MS', 'RLS_TEST_' || t.name, 1, 'R1', 1, 'scheduled'
  FROM pg_temp.fx t JOIN pg_temp.fx m ON m.name = t.name || '_match';
INSERT INTO public.tournament_participants (tournament_id, category, display_name)
SELECT id, 'MS', 'RLS test entrant' FROM pg_temp.fx WHERE name IN ('public', 'draft', 'trashed');
INSERT INTO public.tournament_round_rules (tournament_id, category, round)
SELECT id, 'MS', 1 FROM pg_temp.fx WHERE name IN ('public', 'draft', 'trashed');

UPDATE public.tournaments SET status = 'deleted' WHERE id = (SELECT id FROM pg_temp.fx WHERE name = 'trashed');

-- Run p_sql (one number) as a real API role; ':<fixture>' becomes its id.
CREATE FUNCTION pg_temp.count_as(p_viewer text, p_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE f record; q text := p_sql; v_role text; v_sub uuid; v_email text; n bigint;
BEGIN
  FOR f IN SELECT name, id FROM pg_temp.fx ORDER BY length(name) DESC LOOP
    q := replace(q, ':' || f.name, quote_literal(f.id));
  END LOOP;
  IF p_viewer = 'anon' THEN
    v_role := 'anon';
  ELSE
    v_role := 'authenticated';
    SELECT id, email INTO v_sub, v_email FROM pg_temp.fx WHERE name = p_viewer;
    IF v_sub IS NULL THEN RAISE EXCEPTION 'unknown viewer %', p_viewer; END IF;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_sub::text, ''), true);
  PERFORM set_config('request.jwt.claim.email', coalesce(v_email, ''), true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', v_role, 'sub', v_sub, 'email', coalesce(v_email, ''))::text, true);
  EXECUTE format('SET LOCAL ROLE %I', v_role);
  EXECUTE q INTO n;
  EXECUTE 'RESET ROLE';
  RETURN n;
END $$;

CREATE FUNCTION pg_temp.expect(p_viewer text, p_label text, p_want bigint, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got bigint := pg_temp.count_as(p_viewer, p_sql);
BEGIN
  IF got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'FAIL [%] %: expected %, got %', p_viewer, p_label, p_want, got;
  END IF;
  UPDATE pg_temp.passed SET n = n + 1;
END $$;

CREATE FUNCTION pg_temp.expect_static(p_label text, p_want bigint, p_got bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'FAIL [static] %: expected %, got %', p_label, p_want, p_got;
  END IF;
  UPDATE pg_temp.passed SET n = n + 1;
END $$;

DO $$
DECLARE
  t text := 'SELECT count(*) FROM public.tournaments WHERE id = ';
  m text := 'SELECT count(*) FROM public.tournament_matches WHERE tournament_id = ';
  p text := 'SELECT count(*) FROM public.tournament_participants WHERE tournament_id = ';
  r text := 'SELECT count(*) FROM public.tournament_round_rules WHERE tournament_id = ';
  v text := 'SELECT count(*) FROM public.player_matches_unified WHERE id = ';
  who text;
BEGIN
  -- Tournament rows.
  FOREACH who IN ARRAY ARRAY['anon', 'member'] LOOP
    PERFORM pg_temp.expect(who, 'public tournament', 1, t || ':public');
    PERFORM pg_temp.expect(who, 'draft tournament', 0, t || ':draft');
    PERFORM pg_temp.expect(who, 'trashed tournament', 0, t || ':trashed');
  END LOOP;
  PERFORM pg_temp.expect('umpire', 'unassigned draft', 0, t || ':draft');
  PERFORM pg_temp.expect('captain', 'draft of own team''s tournament', 1, t || ':draft');
  PERFORM pg_temp.expect('team_player', 'draft of own team''s tournament', 1, t || ':draft');
  PERFORM pg_temp.expect('declined', 'draft after declining the invite', 0, t || ':draft');
  PERFORM pg_temp.expect('team_player', 'trashed (no team there)', 0, t || ':trashed');
  PERFORM pg_temp.expect('official', 'assigned draft', 1, t || ':draft');
  PERFORM pg_temp.expect('official', 'trashed (not assigned)', 0, t || ':trashed');
  FOREACH who IN ARRAY ARRAY['host', 'master', 'admin_by_email'] LOOP
    PERFORM pg_temp.expect(who, 'draft tournament', 1, t || ':draft');
    PERFORM pg_temp.expect(who, 'trashed tournament', 1, t || ':trashed');
  END LOOP;

  -- Children of public, draft and trashed tournaments.
  FOREACH who IN ARRAY ARRAY['anon', 'member'] LOOP
    PERFORM pg_temp.expect(who, 'public match', 1, m || ':public');
    PERFORM pg_temp.expect(who, 'public entrant', 1, p || ':public');
    PERFORM pg_temp.expect(who, 'public round rule', 1, r || ':public');
    PERFORM pg_temp.expect(who, 'draft match', 0, m || ':draft');
    PERFORM pg_temp.expect(who, 'draft entrant', 0, p || ':draft');
    PERFORM pg_temp.expect(who, 'draft round rule', 0, r || ':draft');
    PERFORM pg_temp.expect(who, 'trashed match', 0, m || ':trashed');
    PERFORM pg_temp.expect(who, 'trashed entrant', 0, p || ':trashed');
    PERFORM pg_temp.expect(who, 'trashed round rule', 0, r || ':trashed');
  END LOOP;
  FOREACH who IN ARRAY ARRAY['official', 'host'] LOOP
    PERFORM pg_temp.expect(who, 'draft match', 1, m || ':draft');
    PERFORM pg_temp.expect(who, 'draft entrant', 1, p || ':draft');
    PERFORM pg_temp.expect(who, 'draft round rule', 1, r || ':draft');
  END LOOP;
  PERFORM pg_temp.expect('umpire', 'draft match (tm_admin_read)', 1, m || ':draft');
  FOREACH who IN ARRAY ARRAY['host', 'master', 'admin_by_email', 'umpire'] LOOP
    PERFORM pg_temp.expect(who, 'trashed match (tm_hide_trashed)', 0, m || ':trashed');
  END LOOP;
  PERFORM pg_temp.expect('host', 'trashed entrant (own)', 1, p || ':trashed');
  FOREACH who IN ARRAY ARRAY['master', 'admin_by_email'] LOOP
    PERFORM pg_temp.expect(who, 'trashed entrant', 1, p || ':trashed');
    PERFORM pg_temp.expect(who, 'trashed round rule', 1, r || ':trashed');
    PERFORM pg_temp.expect(who, 'draft match', 1, m || ':draft');
  END LOOP;

  -- player_matches_unified follows both tables' RLS.
  PERFORM pg_temp.expect('anon', 'view: public match', 1, v || ':public_match');
  PERFORM pg_temp.expect('anon', 'view: draft match', 0, v || ':draft_match');
  PERFORM pg_temp.expect('anon', 'view: trashed match', 0, v || ':trashed_match');
  PERFORM pg_temp.expect('member', 'view: draft match', 0, v || ':draft_match');
  PERFORM pg_temp.expect('official', 'view: draft match', 1, v || ':draft_match');
  PERFORM pg_temp.expect('umpire', 'view: unassigned draft match', 0, v || ':draft_match');

  -- Writes that read their row back.
  PERFORM pg_temp.expect('host', 'host creates a draft (INSERT ... RETURNING)', 1,
    $q$WITH ins AS (INSERT INTO public.tournaments (name, year, status, created_by)
                    VALUES ('RLS test new draft', 2026, 'draft', :host) RETURNING id)
       SELECT count(*) FROM ins$q$);
  PERFORM pg_temp.expect('admin_by_email', 'e-mail admin edits a tournament they did not create', 1,
    'WITH up AS (UPDATE public.tournaments SET venue = venue WHERE id = :public RETURNING id) SELECT count(*) FROM up');
  PERFORM pg_temp.expect('member', 'member edits someone else''s draft', 0,
    'WITH up AS (UPDATE public.tournaments SET venue = venue WHERE id = :draft RETURNING id) SELECT count(*) FROM up');
  PERFORM pg_temp.expect('admin_by_email', 'e-mail admin edits another player (shared helper)', 1,
    'WITH up AS (UPDATE public.players SET full_name = full_name WHERE id = :member RETURNING id) SELECT count(*) FROM up');
  PERFORM pg_temp.expect('member', 'member edits another player', 0,
    'WITH up AS (UPDATE public.players SET full_name = full_name WHERE id = :official RETURNING id) SELECT count(*) FROM up');
END $$;

-- Static guards on the policy set.
SELECT pg_temp.expect_static('tournaments: no SELECT/ALL policy with USING (true)', 0,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournaments'
      AND cmd IN ('SELECT', 'ALL') AND btrim(coalesce(qual, '')) = 'true'));
-- Role checks must go through is_admin_or_master() / is_admin_or_umpire(),
-- which also recognise admins matched by e-mail. An inline
-- EXISTS (SELECT 1 FROM players ... role ...) misses them.
SELECT pg_temp.expect_static('no policy looks up a role in players inline', 0,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'FROM players'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '\mrole\M'));
SELECT pg_temp.expect_static('tm/tp/trr_public_read exclude deleted themselves', 3,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('tm_public_read', 'tp_public_read', 'trr_public_read')
      AND qual LIKE '%''deleted''%'));

SELECT 'tournament_visibility_assertions: ' || n || ' checks passed' AS result FROM pg_temp.passed;

ROLLBACK;
