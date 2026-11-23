-- Registration Migration A (20261123150000) assertions. Needs registration_test_helpers.sql first.
-- Run: node supabase/tests/registration_rehearse.mjs A supabase/tests/tournament_visibility_assertions.sql \
--        supabase/tests/registration_test_helpers.sql supabase/tests/registration_schema_assertions.sql

DO $$
DECLARE t text;
BEGIN
  -- RLS on every new table.
  FOREACH t IN ARRAY ARRAY['tournament_category_settings', 'tournament_entry_contacts', 'tournament_partner_requests',
    'tournament_entry_events', 'tournament_backup_outbox', 'tournament_waitlist',
    'tournament_withdrawal_requests', 'tournament_registration_conflicts', 'tournament_backup_digests'] LOOP
    PERFORM pg_temp.reg_check('relrowsecurity ' || t, 'true',
      (SELECT relrowsecurity::text FROM pg_class WHERE oid = ('public.' || t)::regclass));
    -- Clients never write these tables directly.
    PERFORM pg_temp.reg_check('authenticated cannot insert ' || t, 'false',
      has_table_privilege('authenticated', 'public.' || t, 'INSERT')::text);
  END LOOP;
END $$;

-- Fixture rows written as the owner.
INSERT INTO public.tournament_category_settings (tournament_id, category, max_entries)
VALUES (pg_temp.reg_id('reg'), 'MD', 8), (pg_temp.reg_id('draft'), 'MD', 8);
INSERT INTO pg_temp.reg_fx (name, id) VALUES ('p_ab', gen_random_uuid());
INSERT INTO public.tournament_participants (id, tournament_id, category, player_id, partner_id, display_name, registered_by, source)
VALUES (pg_temp.reg_id('p_ab'), pg_temp.reg_id('reg'), 'MD', pg_temp.reg_id('A'), pg_temp.reg_id('B'), 'Reg A & Reg B', pg_temp.reg_id('A'), 'app');
INSERT INTO public.tournament_entry_contacts (participant_id, partner_guest_phone) VALUES (pg_temp.reg_id('p_ab'), '9999900000');
INSERT INTO public.tournament_partner_requests (tournament_id, category, from_player_id, to_player_id)
VALUES (pg_temp.reg_id('reg'), 'MD', pg_temp.reg_id('C'), pg_temp.reg_id('A'));
INSERT INTO public.tournament_entry_events (tournament_id, category, actor_id, action, player_ids)
VALUES (pg_temp.reg_id('reg'), 'MD', pg_temp.reg_id('A'), 'entered', ARRAY[pg_temp.reg_id('A'), pg_temp.reg_id('B')]);
INSERT INTO public.tournament_backup_outbox (event_id, tournament_id, last_error)
SELECT id, tournament_id, 'smtp said no to club@example' FROM public.tournament_entry_events WHERE tournament_id = pg_temp.reg_id('reg');
INSERT INTO public.tournament_waitlist (tournament_id, category, player_id, partner_id)
VALUES (pg_temp.reg_id('reg'), 'MD', pg_temp.reg_id('D'), pg_temp.reg_id('E'));
INSERT INTO public.tournament_registration_conflicts (tournament_id, category, shared_player_id)
VALUES (pg_temp.reg_id('reg'), 'MD', pg_temp.reg_id('C'));

DO $$
DECLARE
  s text := 'SELECT count(*) FROM public.tournament_category_settings WHERE tournament_id = ';
  c text := 'SELECT count(*) FROM public.tournament_entry_contacts';
  r text := 'SELECT count(*) FROM public.tournament_partner_requests WHERE tournament_id = :reg';
  e text := 'SELECT count(*) FROM public.tournament_entry_events WHERE tournament_id = :reg';
  o text := 'SELECT count(*) FROM public.tournament_backup_outbox WHERE tournament_id = :reg';
  w text := 'SELECT count(*) FROM public.tournament_waitlist WHERE tournament_id = :reg';
  k text := 'SELECT count(*) FROM public.tournament_registration_conflicts WHERE tournament_id = :reg';
BEGIN
  -- Category settings follow tournament visibility.
  PERFORM pg_temp.reg_expect('anon', 'settings of a public tournament', '1', s || ':reg');
  PERFORM pg_temp.reg_expect('anon', 'settings of a draft hidden', '0', s || ':draft');
  PERFORM pg_temp.reg_expect('org', 'organiser sees draft settings', '1', s || ':draft');

  -- Guest phones: registrant + organisers only.
  PERFORM pg_temp.reg_expect('A', 'registrant reads contact', '1', c);
  PERFORM pg_temp.reg_expect('org', 'organiser reads contact', '1', c);
  PERFORM pg_temp.reg_expect('host', 'host reads contact', '1', c);
  PERFORM pg_temp.reg_expect('B', 'partner does not read contact', '0', c);
  PERFORM pg_temp.reg_expect('ump', 'umpire official does not read contact', '0', c);
  PERFORM pg_temp.reg_expect('outsider', 'outsider does not read contact', '0', c);
  PERFORM pg_temp.reg_fails('anon', 'anon has no access to contacts', 'permission denied', c);

  -- Partner requests: sender, receiver, organisers.
  PERFORM pg_temp.reg_expect('C', 'sender sees request', '1', r);
  PERFORM pg_temp.reg_expect('A', 'receiver sees request', '1', r);
  PERFORM pg_temp.reg_expect('org', 'organiser sees request', '1', r);
  PERFORM pg_temp.reg_expect('B', 'others do not', '0', r);

  -- Events: named players + organisers.
  PERFORM pg_temp.reg_expect('B', 'named player sees event', '1', e);
  PERFORM pg_temp.reg_expect('outsider', 'outsider does not see event', '0', e);
  PERFORM pg_temp.reg_expect('org', 'organiser sees event', '1', e);

  -- Backup outbox: organisers only (errors may contain the address).
  PERFORM pg_temp.reg_expect('org', 'organiser sees outbox', '1', o);
  PERFORM pg_temp.reg_expect('A', 'player does not see outbox', '0', o);
  PERFORM pg_temp.reg_expect('ump', 'umpire official does not see outbox', '0', o);

  -- Waitlist: members + organisers; conflicts: organisers.
  PERFORM pg_temp.reg_expect('E', 'waitlisted partner sees row', '1', w);
  PERFORM pg_temp.reg_expect('A', 'others do not see waitlist', '0', w);
  PERFORM pg_temp.reg_expect('org', 'organiser sees waitlist', '1', w);
  PERFORM pg_temp.reg_expect('org', 'organiser sees conflicts', '1', k);
  PERFORM pg_temp.reg_expect('C', 'player does not see conflicts', '0', k);

  -- Direct writes refused.
  PERFORM pg_temp.reg_fails('A', 'player cannot insert a waitlist row', 'permission denied',
    'INSERT INTO public.tournament_waitlist (tournament_id, category, player_id) VALUES (:reg, ''MD'', :A) RETURNING 1');
  PERFORM pg_temp.reg_fails('host', 'host cannot lock directly', 'permission denied',
    'UPDATE public.tournament_category_settings SET locked_at = now() WHERE tournament_id = :reg RETURNING 1');
END $$;

-- scheduled_notifications accepts the new event type and status, keeps the old ones.
DO $$
BEGIN
  INSERT INTO public.scheduled_notifications (title, body, channels, audience, recipient_ids, event_type, status)
  VALUES ('t', 'b', ARRAY['in_app', 'push', 'email'], 'custom', ARRAY[pg_temp.reg_id('A')], 'registration', 'sending');
  PERFORM pg_temp.reg_check('delivered_channels default', '{}',
    (SELECT delivered_channels::text FROM public.scheduled_notifications WHERE event_type = 'registration' AND recipient_ids = ARRAY[pg_temp.reg_id('A')]));
  PERFORM pg_temp.reg_check('attempts default', '0',
    (SELECT attempts::text FROM public.scheduled_notifications WHERE event_type = 'registration' AND recipient_ids = ARRAY[pg_temp.reg_id('A')]));
  BEGIN
    INSERT INTO public.scheduled_notifications (title, body, event_type) VALUES ('t', 'b', 'bogus');
    RAISE EXCEPTION 'FAIL bogus event_type accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE pg_temp.reg_passed SET n = n + 1;
END $$;

-- Participant defaults for rows made the old way.
DO $$
BEGIN
  INSERT INTO public.tournament_participants (tournament_id, category, display_name)
  VALUES (pg_temp.reg_id('off'), 'MS', 'old-style row');
  PERFORM pg_temp.reg_check('old rows default to organiser source', 'organiser|false',
    (SELECT source || '|' || looking_for_partner FROM public.tournament_participants
      WHERE tournament_id = pg_temp.reg_id('off') AND display_name = 'old-style row'));
END $$;

-- Clean up so later assertion files start from empty tournaments.
DELETE FROM public.tournament_backup_outbox WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_entry_events WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_partner_requests WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_waitlist WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_registration_conflicts WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_category_settings WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_participants WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_registrations WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.scheduled_notifications WHERE recipient_ids && ARRAY(SELECT id FROM pg_temp.reg_fx);

SELECT 'registration_schema_assertions: ' || n || ' checks passed' AS result FROM pg_temp.reg_passed;
