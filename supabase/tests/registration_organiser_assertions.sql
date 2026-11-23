-- Registration Migration C (20261123150200) assertions: organiser RPCs,
-- conflicts, reminders, late withdrawals. Needs registration_test_helpers.sql
-- (and runs after registration_rpc_assertions.sql in the full rehearsal, so it
-- starts by clearing the fixture tournaments). Run:
--   node supabase/tests/registration_rehearse.mjs C supabase/tests/registration_test_helpers.sql \
--        supabase/tests/registration_organiser_assertions.sql

DELETE FROM public.tournament_withdrawal_requests WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_matches WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_backup_outbox WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_entry_events WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_partner_requests WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_waitlist WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_registration_conflicts WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_category_settings WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.tournament_participants WHERE tournament_id IN (SELECT id FROM pg_temp.reg_fx);
DELETE FROM public.scheduled_notifications WHERE recipient_ids && ARRAY(SELECT id FROM pg_temp.reg_fx);
UPDATE public.tournaments SET form_close_date = now() + interval '10 days', max_events_per_player = NULL,
       ignore_gender_rules = false, auto_reminders_enabled = false
 WHERE id = pg_temp.reg_id('reg');

CREATE FUNCTION pg_temp.org_call(p_viewer text, p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.reg_as(p_viewer, p_sql)::jsonb;
END $$;

-- organiser_save_entry as org: returns the result.
CREATE FUNCTION pg_temp.org_add(p_cat text, p_player text, p_partner text DEFAULT NULL, p_row uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.reg_as('org', format('SELECT public.organiser_save_entry(%L::uuid, %L, %L::uuid, %L::uuid, %L::uuid)::text',
    pg_temp.reg_id('reg'), p_cat, p_row, pg_temp.reg_id(p_player), pg_temp.reg_id(p_partner)))::jsonb;
END $$;

CREATE FUNCTION pg_temp.org_notices(p_name text, p_kind text) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.scheduled_notifications
   WHERE recipient_ids = ARRAY[pg_temp.reg_id(p_name)] AND payload->>'kind' = p_kind
$$;

CREATE FUNCTION pg_temp.org_state(p_cat text) RETURNS text LANGUAGE sql AS $$
  SELECT public.registration_category_state(pg_temp.reg_id('reg'), p_cat)
$$;

-- ------------------------------------------------- non-organisers refused --
DO $$
DECLARE v text; s text;
BEGIN
  FOREACH v IN ARRAY ARRAY['outsider', 'ump', 'A'] LOOP
    FOREACH s IN ARRAY ARRAY[
      'SELECT public.set_category_lock(:reg, ''MS'', true)::text',
      'SELECT public.set_category_settings(:reg, ''MS'', ''{"max_entries": 4}'')::text',
      'SELECT public.set_registration_timeline(:reg, ''{"action": "lock_all"}'')::text',
      'SELECT public.organiser_save_entry(:reg, ''MS'', NULL, :A, NULL)::text',
      'SELECT public.promote_from_waitlist(:reg, ''MS'')::text',
      'SELECT public.registration_attention(:reg)::text',
      'SELECT public.tournament_partner_conflicts(:reg)::text',
      'SELECT public.send_entry_reminders(:reg, NULL, ''no_partner'')::text'] LOOP
      PERFORM pg_temp.reg_fails(v, 'non-organiser refused: ' || left(s, 50), 'registration_forbidden', s);
    END LOOP;
  END LOOP;
  PERFORM pg_temp.reg_fails('anon', 'anon refused', 'permission denied', 'SELECT public.registration_attention(:reg)::text');
  PERFORM pg_temp.reg_check('host is an organiser', 'locked',
    pg_temp.org_call('host', 'SELECT public.set_category_lock(:reg, ''MS'', true)::text')->>'status');
  PERFORM pg_temp.reg_check('state follows', 'locked', pg_temp.org_state('MS'));
  PERFORM pg_temp.reg_check('ORGANIZER official reopens', 'reopened',
    pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MS'', false)::text')->>'status');
  PERFORM pg_temp.reg_check('open again', 'open', pg_temp.org_state('MS'));
  PERFORM pg_temp.reg_check('admin is an organiser', 'saved',
    pg_temp.org_call('admin', 'SELECT public.set_category_settings(:reg, ''MS'', ''{"entries_visibility": "after_close"}'')::text')->>'status');
  PERFORM pg_temp.reg_check('visibility saved', 'after_close',
    pg_temp.reg_val('SELECT entries_visibility FROM public.tournament_category_settings WHERE tournament_id = :reg AND category = ''MS'''));
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_settings(:reg, ''MS'', ''{"entries_visibility": null}'')::text');
  PERFORM pg_temp.reg_check('null = same as tournament', NULL,
    pg_temp.reg_val('SELECT entries_visibility FROM public.tournament_category_settings WHERE tournament_id = :reg AND category = ''MS'''));
  PERFORM pg_temp.reg_check('bad visibility refused', 'bad_visibility',
    pg_temp.org_call('org', 'SELECT public.set_category_settings(:reg, ''MS'', ''{"entries_visibility": "sometimes"}'')::text')->>'reason');
END $$;

-- ------------------------------------------------------------ reopen rules --
DO $$
BEGIN
  UPDATE public.tournament_category_settings SET closes_at = now() - interval '1 hour'
   WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'MS';
  PERFORM pg_temp.reg_check('deadline passed: locked', 'locked', pg_temp.org_state('MS'));
  PERFORM pg_temp.reg_check('reopen needs a new deadline', 'needs_new_deadline',
    pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MS'', false)::text')->>'reason');
  PERFORM pg_temp.reg_check('past new deadline refused', 'needs_new_deadline',
    pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MS'', false, now() - interval ''1 minute'')::text')->>'reason');
  PERFORM pg_temp.reg_check('future deadline reopens', 'reopened',
    pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MS'', false, now() + interval ''3 days'')::text')->>'status');
  PERFORM pg_temp.reg_check('open after reopen', 'open', pg_temp.org_state('MS'));

  PERFORM pg_temp.reg_check('lock all', 'locked',
    pg_temp.org_call('org', 'SELECT public.set_registration_timeline(:reg, ''{"action": "lock_all"}'')::text')->'categories'->>'XD');
  PERFORM pg_temp.reg_check('every category locked', '4',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_category_settings WHERE tournament_id = :reg AND locked_at IS NOT NULL'));
  PERFORM pg_temp.reg_check('reopen all', 'reopened',
    pg_temp.org_call('org', 'SELECT public.set_registration_timeline(:reg, ''{"action": "reopen_all"}'')::text')->'categories'->>'WD');
  PERFORM pg_temp.org_call('org', 'SELECT public.set_registration_timeline(:reg, ''{"collect_payment": true, "max_events_per_player": 4}'')::text');
END $$;

DO $$
BEGIN
  PERFORM pg_temp.reg_check('timeline saved', 'true|4',
    pg_temp.reg_val('SELECT collect_payment || ''|'' || max_events_per_player FROM public.tournaments WHERE id = :reg'));
  PERFORM pg_temp.org_call('org', 'SELECT public.set_registration_timeline(:reg, ''{"collect_payment": false, "max_events_per_player": null}'')::text');
END $$;

-- ------------------------------------------- organiser edits after the lock --
DO $$
DECLARE r jsonb; v_cb uuid; v_db uuid;
BEGIN
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MD'', true)::text');
  PERFORM pg_temp.reg_check('player refused while locked', 'locked', (SELECT pg_temp.reg_as('A', format(
    'SELECT (public.save_my_tournament_entries(%L::uuid, ''[{"category":"MD"}]'')->''results''->0->>''reason'')', pg_temp.reg_id('reg')))));
  r := pg_temp.org_add('MD', 'A', 'B');
  PERFORM pg_temp.reg_check('organiser adds after lock', 'saved', r->>'status');
  PERFORM pg_temp.reg_check('no warnings for a clean add', '0', jsonb_array_length(r->'warnings')::text);
  PERFORM pg_temp.reg_check('source organiser', 'organiser',
    pg_temp.reg_val('SELECT source FROM public.tournament_participants WHERE tournament_id = :reg AND player_id = :A'));
  PERFORM pg_temp.reg_check('A told (added)', '1', pg_temp.org_notices('A', 'entry_changed_by_organiser'));
  PERFORM pg_temp.reg_check('B told (added)', '1', pg_temp.org_notices('B', 'entry_changed_by_organiser'));

  -- Shared player: warning, allowed, ONE duplicate notice per host per new conflict.
  r := pg_temp.org_add('MD', 'C', 'B');
  v_cb := (r->>'participant_id')::uuid;
  PERFORM pg_temp.reg_check('taken is a warning', 'taken', r->'warnings'->0->>'kind');
  PERFORM pg_temp.reg_check('warning names the pair', 'Reg A', r->'warnings'->0->>'with_name');
  PERFORM pg_temp.reg_check('conflict recorded', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_registration_conflicts WHERE tournament_id = :reg AND shared_player_id = :B AND resolved_at IS NULL'));
  PERFORM pg_temp.reg_check('host told once', '1', pg_temp.org_notices('host', 'duplicate_found'));
  PERFORM pg_temp.reg_check('organiser told once', '1', pg_temp.org_notices('org', 'duplicate_found'));
  PERFORM pg_temp.reg_check('umpire not told', '0', pg_temp.org_notices('ump', 'duplicate_found'));
  PERFORM pg_temp.reg_check('duplicate payload names the player', 'Reg B',
    pg_temp.reg_val('SELECT payload->>''other_name'' FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:host] AND payload->>''kind'' = ''duplicate_found'''));

  UPDATE public.tournament_participants SET seed = 7 WHERE id = v_cb;
  PERFORM pg_temp.reg_check('unrelated update: no new notice', '1', pg_temp.org_notices('host', 'duplicate_found'));
  r := pg_temp.org_add('MD', 'D', 'B');
  v_db := (r->>'participant_id')::uuid;
  PERFORM pg_temp.reg_check('same conflict growing: no new notice', '1', pg_temp.org_notices('host', 'duplicate_found'));

  PERFORM pg_temp.reg_check('conflicts listed with names', 'Reg B|3',
    (SELECT (c->>'shared_name') || '|' || jsonb_array_length(c->'other_names')
       FROM jsonb_array_elements(pg_temp.org_call('org', 'SELECT public.tournament_partner_conflicts(:reg)::text')) c));

  PERFORM pg_temp.org_call('org', format('SELECT public.organiser_remove_entry(%L::uuid)::text', v_cb));
  PERFORM pg_temp.org_call('org', format('SELECT public.organiser_remove_entry(%L::uuid)::text', v_db));
  PERFORM pg_temp.reg_check('conflict resolved when the rows go', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_registration_conflicts WHERE tournament_id = :reg AND resolved_at IS NULL'));
  PERFORM pg_temp.reg_check('removed players told', '2', pg_temp.org_notices('C', 'entry_changed_by_organiser'));
  PERFORM pg_temp.org_add('MD', 'C', 'B');
  PERFORM pg_temp.reg_check('recreated conflict: new notice', '2', pg_temp.org_notices('host', 'duplicate_found'));

  -- Edit: changing a row's partner tells the removed player.
  r := pg_temp.org_add('MD', 'C', 'E', (SELECT id FROM public.tournament_participants WHERE tournament_id = pg_temp.reg_id('reg') AND player_id = pg_temp.reg_id('C')));
  PERFORM pg_temp.reg_check('edit saved', 'C|E',
    pg_temp.reg_val('SELECT (SELECT name FROM pg_temp.reg_fx WHERE id = player_id) || ''|'' || (SELECT name FROM pg_temp.reg_fx WHERE id = partner_id) FROM public.tournament_participants WHERE tournament_id = :reg AND player_id = :C'));
  -- B was removed three times: the C|B and D|B rows deleted, then this edit.
  PERFORM pg_temp.reg_check('B told removed', '3',
    pg_temp.reg_val('SELECT count(*) FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:B] AND payload->>''kind'' = ''entry_changed_by_organiser'' AND payload->>''action'' = ''removed'''));
  PERFORM pg_temp.reg_check('B conflict resolved by the edit', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_registration_conflicts WHERE tournament_id = :reg AND resolved_at IS NULL'));
  PERFORM pg_temp.reg_check('no participant e-mail written', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_participants WHERE tournament_id = :reg AND email IS NOT NULL'));
END $$;

-- --------------------------------------------------------------- reminders --
DO $$
DECLARE r jsonb; v_guest uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MD'', false)::text');
  -- MD: A|B, C|E. Solo: D; a guest; outsider.
  PERFORM pg_temp.org_add('MD', 'D');
  PERFORM pg_temp.org_add('MD', 'outsider');
  INSERT INTO public.players (id, full_name, is_guest) VALUES (v_guest, 'Reg Guest Solo', true);
  PERFORM pg_temp.reg_as('org', format('SELECT public.organiser_save_entry(%L::uuid, ''MD'', NULL, %L::uuid, NULL)::text', pg_temp.reg_id('reg'), v_guest));

  PERFORM pg_temp.reg_fails('org', 'note over 200 refused', 'longer than 200',
    format('SELECT public.send_entry_reminders(:reg, ''MD'', ''no_partner'', NULL, %L)::text', repeat('x', 201)));
  PERFORM pg_temp.reg_fails('org', 'unknown kind refused', 'unknown reminder kind',
    'SELECT public.send_entry_reminders(:reg, ''MD'', ''everyone'')::text');

  r := pg_temp.org_call('org', 'SELECT public.send_entry_reminders(:reg, ''MD'', ''no_partner'', ARRAY[:D, :A], NULL)::text');
  PERFORM pg_temp.reg_check('ids only narrow the audience', '1', r->>'reminded');
  PERFORM pg_temp.reg_check('A (paired) never reminded', '0', pg_temp.org_notices('A', 'incomplete_entry_manual'));

  r := pg_temp.org_call('org', 'SELECT public.send_entry_reminders(:reg, ''MD'', ''no_partner'', NULL, ''Draw on Sunday'')::text');
  PERFORM pg_temp.reg_check('no-partner reminder: outsider only (D cooling down)', '1', r->>'reminded');
  PERFORM pg_temp.reg_check('guest skipped as not on the app', 'not_on_app',
    (SELECT s->>'reason' FROM jsonb_array_elements(r->'skipped') s WHERE s->>'name' = 'Reg Guest Solo'));
  PERFORM pg_temp.reg_check('guest skip carries a message payload', 'no_partner',
    (SELECT s->'payload'->>'reason' FROM jsonb_array_elements(r->'skipped') s WHERE s->>'name' = 'Reg Guest Solo'));
  PERFORM pg_temp.reg_check('cooldown skip', 'reminded_recently',
    (SELECT s->>'reason' FROM jsonb_array_elements(r->'skipped') s WHERE s->>'player_id' = pg_temp.reg_id('D')::text));
  PERFORM pg_temp.reg_check('no e-mail address counted', '1', r->>'no_email');
  PERFORM pg_temp.reg_check('reminder shape', 'incomplete_entry_manual|no_partner|Draw on Sunday|{in_app,push,email}|t',
    pg_temp.reg_val('SELECT payload->>''kind'' || ''|'' || (payload->>''reason'') || ''|'' || (payload->>''note'') || ''|'' || channels::text || ''|'' || (group_key IS NOT NULL)::text::char
                       FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:outsider] AND payload->>''kind'' = ''incomplete_entry_manual'''));
  PERFORM pg_temp.reg_check('one reminder_sent event per recipient', '2',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_entry_events WHERE tournament_id = :reg AND action = ''reminder_sent'''));

  r := pg_temp.org_call('org', 'SELECT public.send_entry_reminders(:reg, ''MD'', ''no_partner'')::text');
  PERFORM pg_temp.reg_check('again within 12 h: nobody', '0', r->>'reminded');

  -- Shared partner: E in C|E and D|E.
  PERFORM pg_temp.org_add('MD', 'D', 'E', (SELECT id FROM public.tournament_participants WHERE tournament_id = pg_temp.reg_id('reg') AND player_id = pg_temp.reg_id('D')));
  r := pg_temp.org_call('org', 'SELECT public.send_entry_reminders(:reg, ''MD'', ''shared_partner'')::text');
  PERFORM pg_temp.reg_check('shared: E and C reminded (D cooling down)', '2', r->>'reminded');
  PERFORM pg_temp.reg_check('shared player text', 'shared_player',
    pg_temp.reg_val('SELECT payload->>''reason'' FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:E] AND payload->>''kind'' = ''incomplete_entry_manual'''));
  PERFORM pg_temp.reg_check('pair member text names both', 'shared_pair|Reg E|Reg D',
    pg_temp.reg_val('SELECT (payload->>''reason'') || ''|'' || (payload->>''partner_name'') || ''|'' || (payload->>''other_name'') FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:C] AND payload->>''kind'' = ''incomplete_entry_manual'''));

  -- Cap: B (alone, never reminded) is due, but the limit is 0.
  PERFORM pg_temp.org_add('MD', 'B');
  PERFORM pg_temp.reg_check('cap stops at the limit', 'true',
    (public.reg_queue_reminders(pg_temp.reg_id('reg'), 'MD', 'all_incomplete', NULL, NULL, 'incomplete_entry_manual', 0)->>'capped'));

  -- Locked categories refused.
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MD'', true)::text');
  r := pg_temp.org_call('org', 'SELECT public.send_entry_reminders(:reg, ''MD'', ''all_incomplete'')::text');
  PERFORM pg_temp.reg_check('locked category refused', '["MD"]', (r->'refused_categories')::text);
  PERFORM pg_temp.reg_check('locked: nobody reminded', '0', r->>'reminded');

  -- Attention for organisers.
  r := pg_temp.org_call('org', 'SELECT public.registration_attention(:reg)::text');
  PERFORM pg_temp.reg_check('attention: no partner', '3', jsonb_array_length(r->'noPartner')::text);
  PERFORM pg_temp.reg_check('attention: shared', 'true',
    EXISTS (SELECT 1 FROM jsonb_array_elements(r->'sharedPartner') s WHERE s->>'shared_player_id' = pg_temp.reg_id('E')::text)::text);
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''MD'', false)::text');
END $$;

-- ------------------------------------------------- automatic reminders --
DO $$
DECLARE n int;
BEGIN
  PERFORM pg_temp.reg_as('F', format('SELECT public.save_my_tournament_entries(%L::uuid, ''[{"category":"XD"}]'')::text', pg_temp.reg_id('reg')));
  PERFORM pg_temp.reg_as('W', format('SELECT public.save_my_tournament_entries(%L::uuid, ''[{"category":"XD"}]'')::text', pg_temp.reg_id('reg')));
  PERFORM pg_temp.reg_as('A', format('SELECT public.request_partner(%L::uuid, ''XD'', %L::uuid)::text', pg_temp.reg_id('reg'), pg_temp.reg_id('U')));
  UPDATE public.tournament_category_settings SET closes_at = now() + interval '12 hours'
   WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'XD';
  INSERT INTO public.tournament_category_settings (tournament_id, category, closes_at)
  VALUES (pg_temp.reg_id('reg'), 'XD', now() + interval '12 hours')
  ON CONFLICT (tournament_id, category) DO UPDATE SET closes_at = EXCLUDED.closes_at;

  n := public.queue_registration_deadline_reminders();
  PERFORM pg_temp.reg_check('auto off: nothing', '0', pg_temp.org_notices('F', 'incomplete_entry_auto'));
  UPDATE public.tournaments SET auto_reminders_enabled = true WHERE id = pg_temp.reg_id('reg');
  n := public.queue_registration_deadline_reminders();
  PERFORM pg_temp.reg_check('auto: F (no partner)', '1', pg_temp.org_notices('F', 'incomplete_entry_auto'));
  PERFORM pg_temp.reg_check('auto: U (open request)', 'open_request',
    pg_temp.reg_val('SELECT payload->>''reason'' FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:U] AND payload->>''kind'' = ''incomplete_entry_auto'''));
  PERFORM pg_temp.reg_check('auto: MD (not closing soon) untouched', '0', pg_temp.org_notices('outsider', 'incomplete_entry_auto'));
  -- Running again (cron every hour) adds nothing.
  DELETE FROM public.tournament_entry_events WHERE tournament_id = pg_temp.reg_id('reg') AND action = 'reminder_sent'
     AND created_at < now() - interval '1 second';  -- (no-op inside one transaction; cooldown + once-per-deadline hold)
  PERFORM public.queue_registration_deadline_reminders();
  PERFORM pg_temp.reg_check('auto: once', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_entry_events WHERE tournament_id = :reg AND action = ''reminder_sent'' AND :F = ANY (player_ids)'));
  -- Once per deadline even after the cooldown.
  UPDATE public.tournament_entry_events SET created_at = now() - interval '13 hours'
   WHERE tournament_id = pg_temp.reg_id('reg') AND action = 'reminder_sent' AND pg_temp.reg_id('F') = ANY (player_ids);
  PERFORM public.queue_registration_deadline_reminders();
  PERFORM pg_temp.reg_check('auto: once per deadline', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_entry_events WHERE tournament_id = :reg AND action = ''reminder_sent'' AND :F = ANY (player_ids)'));

  -- Evening summary.
  n := public.queue_registration_daily_summary();
  PERFORM pg_temp.reg_check('summary to host', '1', pg_temp.org_notices('host', 'daily_summary'));
  PERFORM pg_temp.reg_check('summary to organiser', '1', pg_temp.org_notices('org', 'daily_summary'));
  PERFORM pg_temp.reg_check('summary counts', 'true',
    pg_temp.reg_val('SELECT ((payload->''summary''->>''entries'')::int > 0)::text FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:host] AND payload->>''kind'' = ''daily_summary'''));
  n := public.queue_registration_daily_summary();
  PERFORM pg_temp.reg_check('one summary per host per day', '1', pg_temp.org_notices('host', 'daily_summary'));
  PERFORM pg_temp.reg_check('summary link opens the organiser view', 'true',
    pg_temp.reg_val('SELECT (link LIKE ''%panel=organizer%'')::text FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:host] AND payload->>''kind'' = ''daily_summary'''));

  -- A quiet tournament (no changes in 24 h) gets no summary.
  INSERT INTO pg_temp.reg_fx (name, id) VALUES ('quiet', gen_random_uuid());
  INSERT INTO public.tournaments (id, name, year, status, created_by, categories, require_app_registration, auto_reminders_enabled)
  VALUES (pg_temp.reg_id('quiet'), 'Reg quiet', 2026, 'upcoming', pg_temp.reg_id('host'), ARRAY['MS'], true, true);
  PERFORM public.queue_registration_daily_summary();
  PERFORM pg_temp.reg_check('nothing new: no summary', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.scheduled_notifications WHERE tournament_id = :quiet'));
  UPDATE public.tournaments SET auto_reminders_enabled = false WHERE id = pg_temp.reg_id('reg');
END $$;

-- ---------------------------------------------------------- late withdrawals --
DO $$
DECLARE r jsonb; v_req uuid; v_m uuid := gen_random_uuid(); v_m2 uuid := gen_random_uuid();
BEGIN
  -- MS: A alone, C alone; draw A vs C; E alone with no opponent yet.
  PERFORM pg_temp.org_add('MS', 'A');
  PERFORM pg_temp.org_add('MS', 'C');
  PERFORM pg_temp.org_add('MS', 'E');
  INSERT INTO public.tournament_matches (id, tournament_id, category, match_code, round, round_name, match_number, status, player1_id, player2_id)
  VALUES (v_m, pg_temp.reg_id('reg'), 'MS', 'REG_WO_1', 1, 'R1', 1, 'scheduled', pg_temp.reg_id('A'), pg_temp.reg_id('C')),
         (v_m2, pg_temp.reg_id('reg'), 'MS', 'REG_WO_2', 1, 'R1', 2, 'scheduled', pg_temp.reg_id('E'), NULL);
  PERFORM pg_temp.reg_check('draw locked MS', 'locked', pg_temp.org_state('MS'));

  r := pg_temp.org_call('A', 'SELECT public.request_late_withdrawal(:reg, ''MS'', ''injured'')::text');
  v_req := (r->>'request_id')::uuid;
  PERFORM pg_temp.reg_fails('ump', 'umpire official cannot resolve', 'registration_forbidden',
    format('SELECT public.resolve_withdrawal_request(%L::uuid, ''walkover'')::text', v_req));
  PERFORM pg_temp.reg_check('remove refused after the draw', 'draw_exists',
    pg_temp.org_call('org', format('SELECT public.resolve_withdrawal_request(%L::uuid, ''remove'')::text', v_req))->>'reason');
  r := pg_temp.org_call('org', format('SELECT public.resolve_withdrawal_request(%L::uuid, ''walkover'')::text', v_req));
  PERFORM pg_temp.reg_check('walkover given', 'walkover', r->>'status');
  PERFORM pg_temp.reg_check('match: winner_side 2, W/O, walkover', '2|W/O|walkover|<NULL>',
    (SELECT winner_side || '|' || score || '|' || status || '|' || coalesce(sets_history::text, '<NULL>') FROM public.tournament_matches WHERE id = v_m));
  PERFORM pg_temp.reg_check('pair told', '1', pg_temp.org_notices('A', 'withdrawal_done'));

  r := pg_temp.org_call('E', 'SELECT public.request_late_withdrawal(:reg, ''MS'', NULL)::text');
  v_req := (r->>'request_id')::uuid;
  r := pg_temp.org_call('org', format('SELECT public.resolve_withdrawal_request(%L::uuid, ''walkover'')::text', v_req));
  PERFORM pg_temp.reg_check('no opponent yet: waits', 'waiting_opponent', r->>'status');
  PERFORM pg_temp.reg_check('match untouched', 'scheduled', (SELECT status FROM public.tournament_matches WHERE id = v_m2));
  PERFORM pg_temp.reg_check('dismiss', 'dismissed',
    pg_temp.org_call('org', format('SELECT public.resolve_withdrawal_request(%L::uuid, ''dismiss'')::text', v_req))->>'status');

  -- Before the draw: Remove entry.
  PERFORM pg_temp.org_add('WD', 'F');
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''WD'', true)::text');
  r := pg_temp.org_call('F', 'SELECT public.request_late_withdrawal(:reg, ''WD'', NULL)::text');
  r := pg_temp.org_call('org', format('SELECT public.resolve_withdrawal_request(%L::uuid, ''remove'')::text', (r->>'request_id')));
  PERFORM pg_temp.reg_check('removed before the draw', 'removed', r->>'status');
  PERFORM pg_temp.reg_check('row gone', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_participants WHERE tournament_id = :reg AND category = ''WD'''));
END $$;

-- ----------------------------------------------------- waitlist after lock --
DO $$
DECLARE v_row uuid;
BEGIN
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''WD'', false)::text');
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_settings(:reg, ''WD'', ''{"max_entries": 1}'')::text');
  PERFORM pg_temp.reg_as('F', format('SELECT public.save_my_tournament_entries(%L::uuid, ''[{"category":"WD"}]'')::text', pg_temp.reg_id('reg')));
  PERFORM pg_temp.reg_check('W waitlisted', 'waitlisted', pg_temp.reg_as('W',
    format('SELECT public.save_my_tournament_entries(%L::uuid, ''[{"category":"WD"}]'')->''results''->0->>''status''', pg_temp.reg_id('reg'))));
  PERFORM pg_temp.reg_expect('anon', 'viewer waitlist count', '1',
    'SELECT waiting FROM public.registration_waitlist_counts(:reg) WHERE category = ''WD''');
  PERFORM pg_temp.reg_expect('anon', 'draft waitlist hidden', '0',
    'SELECT count(*) FROM public.registration_waitlist_counts(:draft)');
  PERFORM pg_temp.org_call('org', 'SELECT public.set_category_lock(:reg, ''WD'', true)::text');
  SELECT id INTO v_row FROM public.tournament_participants WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'WD';
  PERFORM pg_temp.reg_check('locked remove: no automatic move', '0',
    pg_temp.org_call('org', format('SELECT public.organiser_remove_entry(%L::uuid)::text', v_row))->>'moved_up');
  PERFORM pg_temp.reg_check('organiser moves up on request', '1',
    pg_temp.org_call('org', 'SELECT public.promote_from_waitlist(:reg, ''WD'')::text')->>'moved_up');
  PERFORM pg_temp.reg_check('W entered', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_participants WHERE tournament_id = :reg AND category = ''WD'' AND player_id = :W'));
END $$;

-- ------------------------------------------------------------------ grants --
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.reg_attention(uuid)', 'public.reg_conflict_trigger()',
    'public.reg_queue_reminders(uuid, text, text, uuid[], text, text, integer, timestamptz)',
    'public.queue_registration_deadline_reminders()', 'public.queue_registration_daily_summary()',
    'public.reg_lock_category(uuid, text)', 'public.reg_require_organiser(uuid)'] LOOP
    PERFORM pg_temp.reg_check('anon cannot execute ' || f, 'false', has_function_privilege('anon', f, 'EXECUTE')::text);
    PERFORM pg_temp.reg_check('authenticated cannot execute ' || f, 'false', has_function_privilege('authenticated', f, 'EXECUTE')::text);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.set_category_lock(uuid, text, boolean, timestamptz)', 'public.send_entry_reminders(uuid, text, text, uuid[], text)',
    'public.organiser_save_entry(uuid, text, uuid, uuid, uuid, jsonb)', 'public.resolve_withdrawal_request(uuid, text)'] LOOP
    PERFORM pg_temp.reg_check('anon cannot execute ' || f, 'false', has_function_privilege('anon', f, 'EXECUTE')::text);
    PERFORM pg_temp.reg_check('authenticated executes ' || f, 'true', has_function_privilege('authenticated', f, 'EXECUTE')::text);
  END LOOP;
  PERFORM pg_temp.reg_check('anon reads waitlist counts', 'true',
    has_function_privilege('anon', 'public.registration_waitlist_counts(uuid)', 'EXECUTE')::text);
END $$;

SELECT 'registration_organiser_assertions: ' || n || ' checks passed' AS result FROM pg_temp.reg_passed;
