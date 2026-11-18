\set ON_ERROR_STOP on
-- Player contact privacy assertions. Run after contact_privacy_bootstrap.sql and
-- 20261113180000_restrict_player_contact_columns.sql. Executes as the real
-- anon / authenticated roles so column privileges and RLS both apply.

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_role text, p_sub text, p_email text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), false);
  PERFORM set_config('request.jwt.claim.email', coalesce(p_email, ''), false);
  EXECUTE format('SET ROLE %I', p_role);
END $$;

-- 1. Anonymous: public columns readable, private columns and `*` refused.
SELECT pg_temp.as_user('anon', NULL, NULL);
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.players WHERE full_name IS NOT NULL;
  IF n <> 6 THEN RAISE EXCEPTION 'anon cannot read public columns (%)', n; END IF;
  BEGIN
    PERFORM email FROM public.players LIMIT 1;
    RAISE EXCEPTION 'anon read email';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM contact_number FROM public.players LIMIT 1;
    RAISE EXCEPTION 'anon read contact_number';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM public.players LIMIT 1;
    RAISE EXCEPTION 'anon select * succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM id FROM public.players WHERE email = 'asha@x.test';
    RAISE EXCEPTION 'anon filtered by email (enumeration)';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM public.get_my_player_private();
    RAISE EXCEPTION 'anon called get_my_player_private';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- 2. A member: own details via RPC, nobody else's; profile updates still work.
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b1', 'asha@x.test');
DO $$
DECLARE r record; n int;
BEGIN
  BEGIN
    PERFORM email FROM public.players WHERE id = '00000000-0000-0000-0000-0000000000b2';
    RAISE EXCEPTION 'member read another email';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT * INTO r FROM public.get_my_player_private();
  IF r.email <> 'asha@x.test' OR r.contact_number <> '911' THEN RAISE EXCEPTION 'own private details wrong: %', r; END IF;
  UPDATE public.players SET nickname = 'Ash', contact_number = '912' WHERE id = '00000000-0000-0000-0000-0000000000b1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'own profile update blocked'; END IF;
  BEGIN
    PERFORM * FROM public.admin_get_player_private(ARRAY['00000000-0000-0000-0000-0000000000b2'::uuid]);
    RAISE EXCEPTION 'member used admin lookup';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  -- Exact-address lookup returns identity only; partial input returns nothing.
  SELECT * INTO r FROM public.find_player_by_email('BINA@x.test ');
  IF r.id IS DISTINCT FROM '00000000-0000-0000-0000-0000000000b2'::uuid THEN RAISE EXCEPTION 'exact email lookup failed'; END IF;
  SELECT count(*) INTO n FROM public.find_player_by_email('bina');
  IF n <> 0 THEN RAISE EXCEPTION 'partial email lookup returned a row'; END IF;
  -- Venue presence: own row allowed, someone else's refused (rewritten policy).
  INSERT INTO public.venue_presence_events (player_id) VALUES ('00000000-0000-0000-0000-0000000000b1');
  BEGIN
    INSERT INTO public.venue_presence_events (player_id) VALUES ('00000000-0000-0000-0000-0000000000b2');
    RAISE EXCEPTION 'logged presence for another player';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 3. Tournament contacts: nothing while disabled; opponents + officials once enabled.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.get_tournament_contacts('10000000-0000-0000-0000-000000000001',
    ARRAY['00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000c1']::uuid[]);
  IF n <> 0 THEN RAISE EXCEPTION 'contacts visible while disabled (%)', n; END IF;
END $$;
RESET ROLE;
INSERT INTO public.site_data VALUES ('tournament_contacts_10000000-0000-0000-0000-000000000001', '{"enabled": true}');
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b1', 'asha@x.test');
DO $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(id ORDER BY id) INTO ids FROM public.get_tournament_contacts('10000000-0000-0000-0000-000000000001',
    ARRAY['00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000c1']::uuid[]);
  IF ids IS DISTINCT FROM ARRAY['00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c1']::uuid[] THEN
    RAISE EXCEPTION 'player saw wrong contacts: % (must be own opponent + official, not Chitra)', ids;
  END IF;
END $$;
RESET ROLE;

-- 4. Officials and admins see everyone in the event; nobody sees outside it.
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000c1', 'ump@x.test');
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.get_tournament_contacts('10000000-0000-0000-0000-000000000001',
    ARRAY['00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a1']::uuid[]);
  IF n <> 3 THEN RAISE EXCEPTION 'official saw % contacts (expected the 3 players, not the admin outside the event)', n; END IF;
END $$;
RESET ROLE;
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'admin@x.test');
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.admin_get_player_private(ARRAY['00000000-0000-0000-0000-0000000000b2'::uuid]);
  IF n <> 1 THEN RAISE EXCEPTION 'admin lookup failed'; END IF;
  SELECT count(*) INTO n FROM public.admin_search_players_by_email('asha@');
  IF n <> 1 THEN RAISE EXCEPTION 'admin email search failed'; END IF;
END $$;
RESET ROLE;

-- 5. Account linked by email (auth id ≠ player id) resolves to its record.
SELECT pg_temp.as_user('authenticated', '99999999-0000-0000-0000-000000000099', 'dev@x.test');
DO $$
BEGIN
  IF public.resolve_my_player_id() IS DISTINCT FROM '00000000-0000-0000-0000-0000000000d1'::uuid THEN
    RAISE EXCEPTION 'email-linked account did not resolve';
  END IF;
  IF (SELECT contact_number FROM public.get_my_player_private()) <> '955' THEN
    RAISE EXCEPTION 'email-linked account cannot read own details';
  END IF;
END $$;
RESET ROLE;

-- 6. Import fill: admins fill only empty numbers; members cannot.
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b1', 'asha@x.test');
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_fill_player_contact('00000000-0000-0000-0000-0000000000b2', '000');
    RAISE EXCEPTION 'member set a contact number';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.players SET contact_number = NULL WHERE id = '00000000-0000-0000-0000-0000000000b3';
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000a1', 'admin@x.test');
DO $$ BEGIN
  IF public.admin_fill_player_contact('00000000-0000-0000-0000-0000000000b2', '777') THEN
    RAISE EXCEPTION 'overwrote an existing number';
  END IF;
  IF NOT public.admin_fill_player_contact('00000000-0000-0000-0000-0000000000b3', '777') THEN
    RAISE EXCEPTION 'did not fill an empty number';
  END IF;
END $$;
RESET ROLE;

SELECT 'player contact privacy assertions passed' AS result;
