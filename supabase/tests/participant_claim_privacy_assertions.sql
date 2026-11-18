\set ON_ERROR_STOP on
-- Run after contact_privacy_bootstrap.sql, this file's own setup block below,
-- and 20261114090000_restrict_participant_email_and_claim_contact.sql.
-- Usage: bootstrap → (setup section via psql -c or the file part 1) → migration → this file.

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_role text, p_sub text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_role);
END $$;

-- Anonymous: entries and posts readable without the restricted columns.
SELECT pg_temp.as_user('anon', NULL);
DO $$ BEGIN
  PERFORM id, display_name FROM public.tournament_participants;
  PERFORM id, title, contact FROM public.find_lost_posts;
  BEGIN PERFORM email FROM public.tournament_participants; RAISE EXCEPTION 'anon read entry email';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.tournament_participants; RAISE EXCEPTION 'anon select * on entries';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM claim_contact FROM public.find_lost_posts; RAISE EXCEPTION 'anon read claim contact';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- A member who is neither author nor claimant sees no claim contact and no entry emails.
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b3');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.get_find_lost_claim_contacts(ARRAY['70000000-0000-0000-0000-000000000001'::uuid]);
  IF n <> 0 THEN RAISE EXCEPTION 'bystander saw claim contact'; END IF;
  BEGIN PERFORM * FROM public.get_participant_emails('10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'member read entry emails';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;
RESET ROLE;

-- The author and the claimant see the claim contact.
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b1');
DO $$ BEGIN
  IF (SELECT claim_contact FROM public.get_find_lost_claim_contacts(ARRAY['70000000-0000-0000-0000-000000000001'::uuid])) <> '98765' THEN
    RAISE EXCEPTION 'author cannot see claim contact';
  END IF;
END $$;
RESET ROLE;
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000b2');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.get_find_lost_claim_contacts(ARRAY['70000000-0000-0000-0000-000000000001'::uuid])) <> 1 THEN
    RAISE EXCEPTION 'claimant cannot see own claim contact';
  END IF;
END $$;
RESET ROLE;

-- Tournament officials read entry emails.
SELECT pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000000c1');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.get_participant_emails('10000000-0000-0000-0000-000000000001')) <> 1 THEN
    RAISE EXCEPTION 'official cannot read entry emails';
  END IF;
END $$;
RESET ROLE;

SELECT 'participant/claim contact privacy assertions passed' AS result;
