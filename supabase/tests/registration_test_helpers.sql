-- Shared fixtures and helpers for the registration assertion files.
-- Run only through supabase/tests/registration_rehearse.mjs (one transaction,
-- always rolled back). Names are prefixed reg_ so they can share a transaction
-- with tournament_visibility_assertions.sql (which owns pg_temp.fx / expect).

CREATE TEMP TABLE reg_fx (name text PRIMARY KEY, id uuid NOT NULL, email text NOT NULL DEFAULT '');
CREATE TEMP TABLE reg_passed (n int);
INSERT INTO pg_temp.reg_passed VALUES (0);

-- People. players.id = auth uid, except "linked": their player row has another
-- id and is matched by e-mail only (like resolveMyPlayerId).
INSERT INTO pg_temp.reg_fx (name, id) VALUES
  ('host', gen_random_uuid()), ('org', gen_random_uuid()), ('ump', gen_random_uuid()),
  ('admin', gen_random_uuid()), ('outsider', gen_random_uuid()),
  ('A', gen_random_uuid()), ('B', gen_random_uuid()), ('C', gen_random_uuid()),
  ('D', gen_random_uuid()), ('E', gen_random_uuid()), ('F', gen_random_uuid()),
  ('W', gen_random_uuid()), ('U', gen_random_uuid()), ('linked', gen_random_uuid()),
  ('linked_login', gen_random_uuid());
UPDATE pg_temp.reg_fx SET email = 'reg-linked@reg-test.invalid' WHERE name IN ('linked', 'linked_login');

INSERT INTO public.players (id, full_name, role, email, gender, pref_receive_email)
SELECT f.id, 'Reg ' || f.name, r.role, nullif(r.email, ''), r.gender, r.pref_email
  FROM pg_temp.reg_fx f
  JOIN (VALUES
    ('host', 'player', 'reg-host@reg-test.invalid', 'Male', true),
    ('org', 'player', 'reg-org@reg-test.invalid', 'Male', true),
    ('ump', 'player', '', 'Male', true),
    ('admin', 'admin', '', 'Male', true),
    ('outsider', 'player', '', 'Male', true),
    ('A', 'player', 'reg-a@reg-test.invalid', 'Male', true),
    ('B', 'player', 'reg-b@reg-test.invalid', 'Male', false),
    ('C', 'player', 'reg-c@reg-test.invalid', 'Male', true),
    ('D', 'player', '', 'Male', true),
    ('E', 'player', '', 'Male', true),
    ('F', 'player', '', 'Female', true),
    ('W', 'player', '', 'Female', true),
    ('U', 'player', '', NULL, true),
    ('linked', 'player', 'reg-linked@reg-test.invalid', 'Male', true)
  ) r(name, role, email, gender, pref_email) ON r.name = f.name;
-- linked_login has no players row of its own: it signs in and resolves to "linked".

-- Tournaments: reg (flag on, upcoming), off (flag off), team (TEAM), draft.
INSERT INTO pg_temp.reg_fx (name, id) VALUES
  ('reg', gen_random_uuid()), ('off', gen_random_uuid()), ('team', gen_random_uuid()), ('draft', gen_random_uuid());
INSERT INTO public.tournaments (id, name, year, status, created_by, categories, require_app_registration, format_family)
SELECT f.id, 'Reg test ' || f.name, 2026,
       CASE f.name WHEN 'draft' THEN 'draft' ELSE 'upcoming' END,
       (SELECT id FROM pg_temp.reg_fx WHERE name = 'host'),
       ARRAY['MS', 'MD', 'XD', 'WD'],
       f.name <> 'off',
       CASE f.name WHEN 'team' THEN 'TEAM' ELSE 'OPEN_EVENT' END
  FROM pg_temp.reg_fx f WHERE f.name IN ('reg', 'off', 'team', 'draft');
INSERT INTO public.tournament_officials (tournament_id, user_id, role)
SELECT t.id, o.id, r.role
  FROM pg_temp.reg_fx t
  JOIN (VALUES ('org', 'ORGANIZER'), ('ump', 'UMPIRE')) r(name, role) ON true
  JOIN pg_temp.reg_fx o ON o.name = r.name
 WHERE t.name IN ('reg', 'off', 'draft');

-- Run p_sql (one value, cast to text) as a real API role; ':<fixture>' becomes its id.
CREATE FUNCTION pg_temp.reg_sql(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE f record; q text := p_sql;
BEGIN
  FOR f IN SELECT name, id FROM pg_temp.reg_fx ORDER BY length(name) DESC LOOP
    q := regexp_replace(q, ':' || f.name || '\M', quote_literal(f.id) || '::uuid', 'g');
  END LOOP;
  RETURN q;
END $$;

CREATE FUNCTION pg_temp.reg_login(p_viewer text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_role text; v_sub uuid; v_email text;
BEGIN
  IF p_viewer = 'anon' THEN
    v_role := 'anon';
  ELSE
    v_role := 'authenticated';
    SELECT id, email INTO v_sub, v_email FROM pg_temp.reg_fx WHERE name = p_viewer;
    IF v_sub IS NULL THEN RAISE EXCEPTION 'unknown viewer %', p_viewer; END IF;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_sub::text, ''), true);
  PERFORM set_config('request.jwt.claim.email', coalesce(v_email, ''), true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', v_role, 'sub', v_sub, 'email', coalesce(v_email, ''))::text, true);
  EXECUTE format('SET LOCAL ROLE %I', v_role);
END $$;

-- Run one statement as a viewer and return its single value as text.
CREATE FUNCTION pg_temp.reg_as(p_viewer text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; q text := pg_temp.reg_sql(p_sql);
BEGIN
  PERFORM pg_temp.reg_login(p_viewer);
  EXECUTE q INTO r;
  EXECUTE 'RESET ROLE';
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.reg_expect(p_viewer text, p_label text, p_want text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got text := pg_temp.reg_as(p_viewer, p_sql);
BEGIN
  IF got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'FAIL [%] %: expected %, got %', p_viewer, p_label, p_want, got;
  END IF;
  UPDATE pg_temp.reg_passed SET n = n + 1;
END $$;

-- Expect the statement to fail with a message matching p_pattern (regex).
CREATE FUNCTION pg_temp.reg_fails(p_viewer text, p_label text, p_pattern text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE ok boolean := false; msg text;
BEGIN
  BEGIN
    PERFORM pg_temp.reg_as(p_viewer, p_sql);
    ok := true;
  EXCEPTION WHEN OTHERS THEN
    msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  IF ok THEN RAISE EXCEPTION 'FAIL [%] %: expected an error, it succeeded', p_viewer, p_label; END IF;
  IF msg !~* p_pattern THEN RAISE EXCEPTION 'FAIL [%] %: error "%" does not match %', p_viewer, p_label, msg, p_pattern; END IF;
  UPDATE pg_temp.reg_passed SET n = n + 1;
END $$;

CREATE FUNCTION pg_temp.reg_check(p_label text, p_want text, p_got text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'FAIL [static] %: expected %, got %', p_label, p_want, p_got;
  END IF;
  UPDATE pg_temp.reg_passed SET n = n + 1;
END $$;

-- Value lookups as the superuser (no role switch).
CREATE FUNCTION pg_temp.reg_val(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  EXECUTE pg_temp.reg_sql(p_sql) INTO r;
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.reg_id(p_name text) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM pg_temp.reg_fx WHERE name = p_name
$$;
