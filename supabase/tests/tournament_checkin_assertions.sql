-- Tournament check-in (RLS, derived columns, readiness, grants) assertions.
--
-- Self-contained: creates its own players, tournaments and matches inside a
-- transaction that always ends in ROLLBACK, so it is safe on any database
-- with migration 20261120160000 applied. Each check runs as the real anon /
-- authenticated / service_role role with JWT claims set and raises on the
-- first mismatch. The last statement prints how many checks passed.
--
-- Run: npx --no-install supabase db query --remote --yes -f supabase/tests/tournament_checkin_assertions.sql
--
-- Covers: a player changes only their own row (also when their login id
-- differs from their player id), only for a tournament they're entered in
-- and that is under way; officials (UMPIRE/REFEREE/ORGANIZER, host, admin)
-- change anyone's row; signed-in reads follow tournament visibility (drafts
-- for officials only, trash for nobody); anon has no table access and only
-- the presence function; clients can't extend expires_at; readiness ignores
-- expired rows, breaks and players live elsewhere; the minute job ends
-- breaks, removes expired rows and records ready transitions once.
BEGIN;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL, email text NOT NULL DEFAULT '');
CREATE TEMP TABLE passed (n int);
INSERT INTO pg_temp.passed VALUES (0);

-- Logins. players.id = auth uid except alt_login, whose players row
-- (alt_player) has a different id and is matched by e-mail.
INSERT INTO pg_temp.fx (name, id) VALUES
  ('p1', gen_random_uuid()), ('p2', gen_random_uuid()), ('p3', gen_random_uuid()),
  ('p4', gen_random_uuid()), ('outsider', gen_random_uuid()), ('alt_login', gen_random_uuid()),
  ('alt_player', gen_random_uuid()), ('umpire_off', gen_random_uuid()), ('referee_off', gen_random_uuid()),
  ('organizer_off', gen_random_uuid()), ('host', gen_random_uuid()), ('master', gen_random_uuid());
UPDATE pg_temp.fx SET email = 'checkin-alt@rls-test.invalid' WHERE name IN ('alt_login', 'alt_player');

INSERT INTO public.players (id, full_name, role, email)
SELECT f.id, 'Check-in test ' || f.name, CASE f.name WHEN 'master' THEN 'master_admin' ELSE 'player' END,
       CASE f.name WHEN 'alt_player' THEN 'checkin-alt@rls-test.invalid' ELSE NULL END
  FROM pg_temp.fx f WHERE f.name <> 'alt_login';

INSERT INTO pg_temp.fx (name, id) VALUES
  ('live', gen_random_uuid()), ('draft', gen_random_uuid()), ('done', gen_random_uuid()), ('trashed', gen_random_uuid());
INSERT INTO public.tournaments (id, name, year, status, created_by, min_rest_minutes)
SELECT f.id, 'Check-in test ' || f.name, 2026,
       CASE f.name WHEN 'draft' THEN 'draft' WHEN 'done' THEN 'completed' ELSE 'upcoming' END,
       (SELECT id FROM pg_temp.fx WHERE name = 'host'), 15
  FROM pg_temp.fx f WHERE f.name IN ('live', 'draft', 'done', 'trashed');

INSERT INTO public.tournament_officials (tournament_id, user_id, role)
SELECT (SELECT id FROM pg_temp.fx WHERE name = 'live'), f.id, r.role
  FROM pg_temp.fx f JOIN (VALUES ('umpire_off', 'UMPIRE'), ('referee_off', 'REFEREE'), ('organizer_off', 'ORGANIZER')) r(name, role)
    ON r.name = f.name;
INSERT INTO public.tournament_officials (tournament_id, user_id, role)
VALUES ((SELECT id FROM pg_temp.fx WHERE name = 'draft'), (SELECT id FROM pg_temp.fx WHERE name = 'umpire_off'), 'UMPIRE');

-- Matches. live: m1 p1 vs p2 (scheduled), m_dbl (p1,alt_player) vs (p3,p4),
-- m_live p3 vs p4 (in progress, makes them busy). Each other tournament has
-- one match with p1 in it so p1 is "entered" there too.
INSERT INTO pg_temp.fx (name, id) VALUES
  ('m1', gen_random_uuid()), ('m_dbl', gen_random_uuid()), ('m_live', gen_random_uuid()),
  ('m_draft', gen_random_uuid()), ('m_done', gen_random_uuid()), ('m_trashed', gen_random_uuid());
INSERT INTO public.tournament_matches (id, tournament_id, category, match_code, round, round_name, match_number, status,
                                       player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, scheduled_at)
SELECT m.id, t.id, v.cat, v.code, 1, 'R1', v.num, v.status, a.id, b.id, c.id, d.id, 'Side A', 'Side B', now() + interval '1 hour'
  FROM (VALUES
          ('m1', 'live', 'MS', 'CI_MS_R1_01', 1, 'scheduled', 'p1', 'p2', NULL, NULL),
          ('m_dbl', 'live', 'XD', 'CI_XD_R1_01', 2, 'scheduled', 'p1', 'p3', 'alt_player', 'p4'),
          ('m_live', 'live', 'MS', 'CI_MS_R1_02', 3, 'in_progress', 'p3', 'p4', NULL, NULL),
          ('m_draft', 'draft', 'MS', 'CI_D_01', 1, 'scheduled', 'p1', 'p2', NULL, NULL),
          ('m_done', 'done', 'MS', 'CI_C_01', 1, 'scheduled', 'p1', 'p2', NULL, NULL),
          ('m_trashed', 'trashed', 'MS', 'CI_T_01', 1, 'scheduled', 'p1', 'p2', NULL, NULL)
       ) v(mname, tname, cat, code, num, status, a1, b1, c1, d1)
  JOIN pg_temp.fx m ON m.name = v.mname
  JOIN pg_temp.fx t ON t.name = v.tname
  JOIN pg_temp.fx a ON a.name = v.a1
  JOIN pg_temp.fx b ON b.name = v.b1
  LEFT JOIN pg_temp.fx c ON c.name = v.c1
  LEFT JOIN pg_temp.fx d ON d.name = v.d1;

-- Rows that exist before the role checks: p1 in the draft and the trashed
-- tournament (written as the table owner, as the minute job would).
INSERT INTO public.tournament_checkins (tournament_id, player_id)
SELECT t.id, (SELECT id FROM pg_temp.fx WHERE name = 'p1') FROM pg_temp.fx t WHERE t.name IN ('draft', 'trashed');
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
  ELSIF p_viewer = 'service' THEN
    v_role := 'service_role';
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
  BEGIN
    EXECUTE q INTO n;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    RAISE;
  END;
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

-- The statement must fail (RLS or an explicit refusal); its writes are undone.
CREATE FUNCTION pg_temp.expect_refused(p_viewer text, p_label text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    PERFORM pg_temp.count_as(p_viewer, p_sql);
  EXCEPTION WHEN OTHERS THEN
    ok := true;
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FAIL [%] %: expected a refusal, but it succeeded', p_viewer, p_label;
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
  ci text := 'SELECT count(*) FROM (SELECT public.tournament_checkin(%s, %s, %L, %s)) x';
  rows_in text := 'SELECT count(*) FROM public.tournament_checkins WHERE tournament_id = ';
  presence text := 'SELECT count(*) FROM public.tournament_match_presence(:live) WHERE match_id = :m1 AND ready';
  who text;
BEGIN
  -- Self check-in: own row only, entered tournaments only, open tournaments only.
  PERFORM pg_temp.expect('p1', 'player checks in', 1, format(ci, ':live', ':p1', 'check_in', 'NULL'));
  PERFORM pg_temp.expect_refused('p1', 'player checks in their opponent', format(ci, ':live', ':p2', 'check_in', 'NULL'));
  PERFORM pg_temp.expect_refused('outsider', 'player not entered checks in', format(ci, ':live', ':outsider', 'check_in', 'NULL'));
  PERFORM pg_temp.expect_refused('p1', 'check-in to a finished tournament', format(ci, ':done', ':p1', 'check_in', 'NULL'));
  PERFORM pg_temp.expect_refused('anon', 'signed-out check-in', format(ci, ':live', ':p1', 'check_in', 'NULL'));
  PERFORM pg_temp.expect('alt_login', 'login with a different player id checks in by e-mail', 1,
    format(ci, ':live', ':alt_player', 'check_in', 'NULL'));
  PERFORM pg_temp.expect_refused('p1', 'direct insert for someone else',
    'WITH i AS (INSERT INTO public.tournament_checkins (tournament_id, player_id) VALUES (:live, :p3) RETURNING 1) SELECT count(*) FROM i');
  PERFORM pg_temp.expect('p2', 'player cannot update someone else''s row', 0,
    'WITH u AS (UPDATE public.tournament_checkins SET state = ''break'' WHERE player_id = :p1 RETURNING 1) SELECT count(*) FROM u');

  -- Derived columns can't be forged.
  PERFORM pg_temp.expect('p1', 'client cannot push expires_at out', 1,
    'WITH u AS (UPDATE public.tournament_checkins SET expires_at = now() + interval ''10 days'', checked_in_at = now() - interval ''1 day''
                WHERE tournament_id = :live AND player_id = :p1 RETURNING expires_at, checked_in_at)
     SELECT count(*) FROM u WHERE expires_at <= now() + interval ''4 hours 1 minute'' AND checked_in_at > now() - interval ''1 minute''');
  PERFORM pg_temp.expect('p1', 'expiry capped at midnight IST', 1,
    'SELECT count(*) FROM public.tournament_checkins WHERE tournament_id = :live AND player_id = :p1
       AND expires_at <= (date_trunc(''day'', now() AT TIME ZONE ''Asia/Kolkata'') + interval ''1 day'') AT TIME ZONE ''Asia/Kolkata''');
  PERFORM pg_temp.expect('p1', 'checked_in_by is the caller', 1,
    'SELECT count(*) FROM public.tournament_checkins WHERE tournament_id = :live AND player_id = :p1 AND checked_in_by = :p1');

  -- Officials act on behalf of players.
  PERFORM pg_temp.expect('umpire_off', 'umpire checks a player in', 1, format(ci, ':live', ':p2', 'check_in', 'NULL'));
  PERFORM pg_temp.expect('umpire_off', 'checked_in_by records the official', 1,
    'SELECT count(*) FROM public.tournament_checkins WHERE tournament_id = :live AND player_id = :p2 AND checked_in_by = :umpire_off');
  PERFORM pg_temp.expect('referee_off', 'referee puts a player on a break', 1, format(ci, ':live', ':p2', 'break', '15'));
  PERFORM pg_temp.expect('organizer_off', 'organiser brings them back', 1, format(ci, ':live', ':p2', 'back', 'NULL'));
  PERFORM pg_temp.expect('host', 'host checks a player in', 1, format(ci, ':live', ':p3', 'check_in', 'NULL'));
  PERFORM pg_temp.expect('master', 'admin checks a player in', 1, format(ci, ':live', ':p4', 'check_in', 'NULL'));
  PERFORM pg_temp.expect_refused('umpire_off', 'official cannot check in someone not entered',
    format(ci, ':live', ':outsider', 'check_in', 'NULL'));
  PERFORM pg_temp.expect_refused('umpire_off', 'draft official can''t write while the draft is closed',
    'WITH u AS (UPDATE public.tournament_checkins SET state = ''break'' WHERE tournament_id = :draft RETURNING 1) SELECT count(*) FROM u');

  -- Reads follow tournament visibility.
  PERFORM pg_temp.expect('outsider', 'member reads a live tournament''s rows', 5, rows_in || ':live');
  PERFORM pg_temp.expect('outsider', 'member reads no draft rows', 0, rows_in || ':draft');
  PERFORM pg_temp.expect('umpire_off', 'draft official reads its rows', 1, rows_in || ':draft');
  FOREACH who IN ARRAY ARRAY['p1', 'host', 'master'] LOOP
    PERFORM pg_temp.expect(who, 'trashed rows hidden', 0, rows_in || ':trashed');
  END LOOP;
  PERFORM pg_temp.expect_refused('anon', 'anon has no table access', rows_in || ':live');

  -- Presence / readiness. p1 and p2 are here: both sides here.
  PERFORM pg_temp.expect('anon', 'spectator sees both sides here', 1, presence);
  PERFORM pg_temp.expect('anon', 'spectator sees nothing for a draft', 0,
    'SELECT count(*) FROM public.tournament_match_presence(:draft)');
  PERFORM pg_temp.expect('p2', 'player goes on a 15 min break', 1, format(ci, ':live', ':p2', 'break', '15'));
  PERFORM pg_temp.expect('anon', 'on a break: waiting for players', 0, presence);
  PERFORM pg_temp.expect('p2', 'player is back', 1, format(ci, ':live', ':p2', 'back', 'NULL'));
  PERFORM pg_temp.expect('anon', 'back: both sides here again', 1, presence);
  -- Doubles: p3 and p4 are live on m_live, so m_dbl waits even though all four checked in.
  PERFORM pg_temp.expect('anon', 'player live elsewhere blocks the match', 0,
    'SELECT count(*) FROM public.tournament_match_presence(:live) WHERE match_id = :m_dbl AND ready');
  PERFORM pg_temp.expect('p1', 'player can check out', 1,
    'SELECT count(*) FROM (SELECT public.tournament_checkin(:live, :p1, ''check_out'')) x');
  PERFORM pg_temp.expect('anon', 'checked out: waiting', 0, presence);
  PERFORM pg_temp.expect('p1', 'check in again', 1, format(ci, ':live', ':p1', 'check_in', 'NULL'));
END $$;

-- Expired rows are ignored before the job deletes them; the job ends timed
-- breaks, removes expired rows and records a ready transition once.
UPDATE public.tournament_checkins SET state = 'break', break_until = now() + interval '5 minutes'
 WHERE tournament_id = (SELECT id FROM pg_temp.fx WHERE name = 'live') AND player_id = (SELECT id FROM pg_temp.fx WHERE name = 'p2');
ALTER TABLE public.tournament_checkins DISABLE TRIGGER tournament_checkins_normalize;
UPDATE public.tournament_checkins SET break_until = now() - interval '1 minute'
 WHERE tournament_id = (SELECT id FROM pg_temp.fx WHERE name = 'live') AND player_id = (SELECT id FROM pg_temp.fx WHERE name = 'p2');
UPDATE public.tournament_checkins SET expires_at = now() - interval '1 minute'
 WHERE tournament_id = (SELECT id FROM pg_temp.fx WHERE name = 'live') AND player_id = (SELECT id FROM pg_temp.fx WHERE name = 'p3');
ALTER TABLE public.tournament_checkins ENABLE TRIGGER tournament_checkins_normalize;

DO $$
BEGIN
  PERFORM pg_temp.expect('anon', 'a timed break that ended counts as here', 1,
    'SELECT count(*) FROM public.tournament_match_presence(:live) WHERE match_id = :m1 AND ready');
  PERFORM pg_temp.expect('outsider', 'expired row still stored until the job runs', 5,
    'SELECT count(*) FROM public.tournament_checkins WHERE tournament_id = :live');
  PERFORM pg_temp.expect('service', 'job: one break ended, one expired row removed', 1,
    'SELECT count(*) FROM (SELECT public.process_tournament_checkins() r) x
      WHERE (r->>''breaks_ended'')::int >= 1 AND (r->>''expired'')::int >= 1');
  PERFORM pg_temp.expect('outsider', 'break ended: state is here', 1,
    'SELECT count(*) FROM public.tournament_checkins WHERE tournament_id = :live AND player_id = :p2 AND state = ''here''');
  PERFORM pg_temp.expect('outsider', 'expired row removed', 0,
    'SELECT count(*) FROM public.tournament_checkins WHERE tournament_id = :live AND player_id = :p3');
  PERFORM pg_temp.expect('service', 'm1 recorded ready once', 1,
    'SELECT count(*) FROM public.tournament_match_ready_state WHERE match_id = :m1 AND ready AND transitions = 1');
  PERFORM pg_temp.expect('service', 'second run: no new transition', 1,
    'SELECT count(*) FROM (SELECT public.process_tournament_checkins()) x');
  PERFORM pg_temp.expect('service', 'still one transition', 1,
    'SELECT count(*) FROM public.tournament_match_ready_state WHERE match_id = :m1 AND transitions = 1');
END $$;

-- Grants (what the API roles can execute).
SELECT pg_temp.expect_static('anon has no privilege on tournament_checkins', 0,
  (SELECT count(*) FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
    WHERE has_table_privilege('anon', 'public.tournament_checkins', p)));
SELECT pg_temp.expect_static('anon can read presence only', 1,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('tournament_match_presence', 'tournament_checkin', 'tournament_checkin_readiness',
                        'process_tournament_checkins', 'dispatch_authoritative_match_alert',
                        'can_manage_tournament_checkins', 'is_entered_in_tournament', 'tournament_checkin_open',
                        'tournament_checkin_expiry', 'tournament_player_next_match', 'checkin_alert_version')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')));
SELECT pg_temp.expect_static('signed-in users cannot dispatch alerts or run the job', 0,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('dispatch_authoritative_match_alert', 'process_tournament_checkins', 'tournament_checkin_readiness')
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')));
SELECT pg_temp.expect_static('one dispatcher overload', 1,
  (SELECT count(*) FROM pg_proc WHERE proname = 'dispatch_authoritative_match_alert'));
SELECT pg_temp.expect_static('check-ins are in the realtime publication', 2,
  (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND tablename IN ('tournament_checkins', 'court_calls')));
SELECT pg_temp.expect_static('no check-in policy looks up a role in players inline', 0,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournament_checkins'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'FROM players'));

SELECT 'tournament_checkin_assertions: ' || n || ' checks passed' AS result FROM pg_temp.passed;

ROLLBACK;
