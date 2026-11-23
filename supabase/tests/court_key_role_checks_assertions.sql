-- Part B assertions: 20261123150300_court_key_normalise + 20261123150400_tournament_role_checks.
-- Needs registration_test_helpers.sql (fixtures + helpers). Run:
--   node supabase/tests/registration_rehearse.mjs partb --only=partb supabase/tests/tournament_visibility_assertions.sql \
--        supabase/tests/registration_test_helpers.sql supabase/tests/court_key_role_checks_assertions.sql

-- --------------------------------------------------------------- court_key --
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('1', '1'), ('C1', '1'), ('c1', '1'), ('C 01', '1'), ('Court 1', '1'), ('court-3', '3'), ('Court #12', '12'),
    ('Court', NULL), ('TBD', NULL), ('-', NULL), ('', NULL), (NULL, NULL), ('  ', NULL),
    ('Centre Court', 'centre court'), ('C11', '11')) v(raw, want)
  LOOP
    PERFORM pg_temp.reg_check('court_key(' || coalesce(c.raw, 'NULL') || ')', c.want, public.court_key(c.raw));
  END LOOP;
  PERFORM pg_temp.reg_check('data fix: no "1" courts left', '0',
    (SELECT count(*)::text FROM public.tournament_matches WHERE court_number = '1'));
  PERFORM pg_temp.reg_check('data fix queued no schedule alert', '0',
    (SELECT count(*)::text FROM public.scheduled_notifications WHERE created_at = now() AND event_type = 'schedule_change'));
END $$;

-- ------------------------------------------------- overlap + start check --
INSERT INTO pg_temp.reg_fx (name, id) VALUES ('m_live', gen_random_uuid()), ('m_next', gen_random_uuid()), ('m_other', gen_random_uuid());
INSERT INTO public.tournament_matches (id, tournament_id, category, match_code, round, round_name, match_number, status, court_number, scheduled_at, started_at)
VALUES (pg_temp.reg_id('m_live'), pg_temp.reg_id('off'), 'MS', 'CK_LIVE', 1, 'R1', 1, 'in_progress', '1', now() - interval '10 minutes', now() - interval '10 minutes');

DO $$
DECLARE ok boolean := false;
BEGIN
  -- "C1" overlapping a live match stored as "1" is the same court now.
  BEGIN
    INSERT INTO public.tournament_matches (id, tournament_id, category, match_code, round, round_name, match_number, status, court_number, scheduled_at)
    VALUES (pg_temp.reg_id('m_next'), pg_temp.reg_id('off'), 'MS', 'CK_NEXT', 1, 'R1', 2, 'scheduled', 'C1', now());
    ok := true;
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
  PERFORM pg_temp.reg_check('overlap trigger: "C1" vs "1" conflicts', 'false', ok::text);

  -- Placeholders never conflict with each other.
  INSERT INTO public.tournament_matches (tournament_id, category, match_code, round, round_name, match_number, status, court_number, scheduled_at)
  VALUES (pg_temp.reg_id('off'), 'MS', 'CK_PH1', 1, 'R1', 3, 'scheduled', 'Court', now()),
         (pg_temp.reg_id('off'), 'MS', 'CK_PH2', 1, 'R1', 4, 'scheduled', 'Court', now());
  PERFORM pg_temp.reg_check('placeholders insert fine', '2',
    (SELECT count(*)::text FROM public.tournament_matches WHERE match_code IN ('CK_PH1', 'CK_PH2')));

  -- A later slot on C1 is fine.
  INSERT INTO public.tournament_matches (id, tournament_id, category, match_code, round, round_name, match_number, status, court_number, scheduled_at)
  VALUES (pg_temp.reg_id('m_next'), pg_temp.reg_id('off'), 'MS', 'CK_NEXT', 1, 'R1', 2, 'scheduled', 'C1', now() + interval '2 hours'),
         (pg_temp.reg_id('m_other'), pg_temp.reg_id('off'), 'MS', 'CK_OTHER', 1, 'R1', 5, 'scheduled', 'C2', now() + interval '2 hours');
END $$;

DO $$
BEGIN
  -- Start check: "Court 1" expected vs stored "C1" is not a court change; the live "1" match occupies it.
  PERFORM pg_temp.reg_fails('admin', 'start: court 1 busy under another spelling', 'court_in_use',
    'SELECT public.start_tournament_match_checked(:m_next, ''Court 1'', NULL)::text');
  PERFORM pg_temp.reg_fails('admin', 'start: a real court change is still caught', 'match_schedule_changed',
    'SELECT public.start_tournament_match_checked(:m_other, ''C3'', NULL)::text');
  PERFORM pg_temp.reg_expect('admin', 'start: free court with another spelling of itself', 'true',
    'SELECT (public.start_tournament_match_checked(:m_other, ''2'', NULL)->>''applied'')');
END $$;

-- ------------------------------------------------------------- role checks --
INSERT INTO pg_temp.reg_fx (name, id, email) VALUES ('host_alias', gen_random_uuid(), 'reg-host@reg-test.invalid');
INSERT INTO pg_temp.reg_fx (name, id, email) VALUES ('admin_alias', gen_random_uuid(), 'reg-admin-alias@reg-test.invalid');
UPDATE public.players SET email = 'reg-admin-alias@reg-test.invalid' WHERE id = pg_temp.reg_id('admin');

DO $$
BEGIN
  PERFORM pg_temp.reg_expect('host', 'creator manages', 'true', 'SELECT public.is_tournament_manager(:reg)::text');
  PERFORM pg_temp.reg_expect('host_alias', 'creator signed in with a linked e-mail manages', 'true', 'SELECT public.is_tournament_manager(:reg)::text');
  PERFORM pg_temp.reg_expect('admin_alias', 'admin matched by e-mail manages', 'true', 'SELECT public.is_tournament_manager(:reg)::text');
  PERFORM pg_temp.reg_expect('admin', 'admin by id manages', 'true', 'SELECT public.is_tournament_manager(:reg)::text');
  PERFORM pg_temp.reg_expect('A', 'member does not manage', 'false', 'SELECT public.is_tournament_manager(:reg)::text');
  PERFORM pg_temp.reg_expect('org', 'ORGANIZER official: unchanged (not a manager)', 'false', 'SELECT public.is_tournament_manager(:reg)::text');

  PERFORM pg_temp.reg_check('reveal functions: no inline role lookup', '0',
    (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('reveal_tie_lineup', 'reveal_decider_rubber', 'is_tournament_manager')
        AND pg_get_functiondef(p.oid) ~* 'from\s+(public\.)?players\s+(p\s+)?where\s+(p\.)?id\s*=\s*auth\.uid\(\)\s+and\s+(p\.)?role'));
  PERFORM pg_temp.reg_check('anon cannot reveal lineups', 'false',
    has_function_privilege('anon', 'public.reveal_tie_lineup(uuid, integer)', 'EXECUTE')::text);
  PERFORM pg_temp.reg_check('anon cannot reveal the decider', 'false',
    has_function_privilege('anon', 'public.reveal_decider_rubber(uuid)', 'EXECUTE')::text);
  PERFORM pg_temp.reg_check('umpires still can', 'true',
    has_function_privilege('authenticated', 'public.reveal_tie_lineup(uuid, integer)', 'EXECUTE')::text);
  PERFORM pg_temp.reg_fails('A', 'member cannot reveal', 'Unauthorized',
    format('SELECT public.reveal_tie_lineup(%L::uuid, NULL)::text', gen_random_uuid()));
END $$;

SELECT 'court_key_role_checks_assertions: ' || n || ' checks passed' AS result FROM pg_temp.reg_passed;
