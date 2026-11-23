-- Registration Migration B (20261123150100) assertions: player RPCs + triggers.
-- Needs registration_test_helpers.sql first. Run:
--   node supabase/tests/registration_rehearse.mjs B supabase/tests/registration_test_helpers.sql \
--        supabase/tests/registration_rpc_assertions.sql

-- save one category as a viewer; returns the result object.
CREATE FUNCTION pg_temp.reg_save(p_viewer text, p_t text, p_cat text, p_partner text DEFAULT NULL, p_extra jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.reg_as(p_viewer, format(
    'SELECT (public.save_my_tournament_entries(%L::uuid, %L::jsonb)->''results''->0)::text',
    pg_temp.reg_id(p_t),
    jsonb_build_array(jsonb_build_object('category', p_cat, 'partner_id', pg_temp.reg_id(p_partner)) || p_extra)))::jsonb;
END $$;

CREATE FUNCTION pg_temp.reg_call(p_viewer text, p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.reg_as(p_viewer, p_sql)::jsonb;
END $$;

-- Row of a category containing the player, as "player|partner" fixture names.
CREATE FUNCTION pg_temp.reg_pair(p_cat text, p_name text) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(coalesce(fp.name, '-') || '|' || coalesce(fq.name, '-'), ',' ORDER BY tp.created_at)
    FROM public.tournament_participants tp
    LEFT JOIN pg_temp.reg_fx fp ON fp.id = tp.player_id
    LEFT JOIN pg_temp.reg_fx fq ON fq.id = tp.partner_id
   WHERE tp.tournament_id = pg_temp.reg_id('reg') AND tp.category = p_cat
     AND pg_temp.reg_id(p_name) IN (tp.player_id, tp.partner_id)
$$;

CREATE FUNCTION pg_temp.reg_notices(p_name text, p_kind text) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.scheduled_notifications
   WHERE recipient_ids = ARRAY[pg_temp.reg_id(p_name)] AND payload->>'kind' = p_kind
$$;

CREATE FUNCTION pg_temp.reg_rows(p_cat text) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.tournament_participants
   WHERE tournament_id = pg_temp.reg_id('reg') AND category = p_cat
$$;

-- ------------------------------------------------- the shared case list --
DO $$
DECLARE c jsonb; i jsonb; got text;
BEGIN
  FOR c IN SELECT * FROM jsonb_array_elements(:'window_cases'::jsonb) LOOP
    i := c->'input';
    got := public.registration_category_state(
      (i->>'flagOn')::boolean, i->>'formatFamily', i->>'status',
      (i->>'tournamentOpensAt')::timestamptz, (i->>'tournamentClosesAt')::timestamptz,
      (i->>'categoryOpensAt')::timestamptz, (i->>'categoryClosesAt')::timestamptz,
      (i->>'lockedAt')::timestamptz, coalesce((i->>'hasDraw')::boolean, false), (i->>'now')::timestamptz);
    PERFORM pg_temp.reg_check('window case: ' || (c->>'name'), c->>'state', got);
  END LOOP;
END $$;

-- ------------------------------------------------------------ refusals --
DO $$
BEGIN
  PERFORM pg_temp.reg_fails('anon', 'anon cannot call save', 'permission denied',
    'SELECT public.save_my_tournament_entries(:reg, ''[]''::jsonb)::text');
  PERFORM pg_temp.reg_fails('A', 'flag-off tournament refused', 'registration_not_in_app',
    'SELECT public.save_my_tournament_entries(:off, ''[{"category":"MS"}]''::jsonb)::text');
  PERFORM pg_temp.reg_fails('A', 'team tournament refused', 'registration_not_in_app',
    'SELECT public.save_my_tournament_entries(:team, ''[{"category":"MS"}]''::jsonb)::text');
  PERFORM pg_temp.reg_check('draft (hidden) refused', 'hidden', pg_temp.reg_save('A', 'draft', 'MS')->>'reason');
  PERFORM pg_temp.reg_check('unknown category refused', 'unknown_category', pg_temp.reg_save('A', 'reg', 'ZZ')->>'reason');

  INSERT INTO public.tournament_category_settings (tournament_id, category, opens_at)
  VALUES (pg_temp.reg_id('reg'), 'WD', now() + interval '2 days');
  PERFORM pg_temp.reg_check('not open yet refused', 'not_open', pg_temp.reg_save('F', 'reg', 'WD')->>'reason');
  UPDATE public.tournament_category_settings SET opens_at = NULL, locked_at = now() WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'WD';
  PERFORM pg_temp.reg_check('locked refused', 'locked', pg_temp.reg_save('F', 'reg', 'WD')->>'reason');
  UPDATE public.tournament_category_settings SET locked_at = NULL WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'WD';
  -- Deadline passed (tournament form_close_date) locks too.
  UPDATE public.tournaments SET form_close_date = now() - interval '1 hour' WHERE id = pg_temp.reg_id('reg');
  PERFORM pg_temp.reg_check('deadline passed refused', 'locked', pg_temp.reg_save('F', 'reg', 'WD')->>'reason');
  UPDATE public.tournaments SET form_close_date = now() + interval '10 days' WHERE id = pg_temp.reg_id('reg');
END $$;

-- ----------------------------------------------------- B picks C outcomes --
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.reg_save('A', 'reg', 'MD', 'C');
  PERFORM pg_temp.reg_check('A enters with C', 'entered', r->>'status');
  PERFORM pg_temp.reg_check('row A|C', 'A|C', pg_temp.reg_pair('MD', 'A'));
  PERFORM pg_temp.reg_check('display name like addParticipant', 'Reg A & Reg C',
    pg_temp.reg_val('SELECT display_name FROM public.tournament_participants WHERE tournament_id = :reg AND category = ''MD'' AND player_id = :A'));
  PERFORM pg_temp.reg_check('source app, registered_by A', 'app|true',
    pg_temp.reg_val('SELECT source || ''|'' || (registered_by = :A) FROM public.tournament_participants WHERE tournament_id = :reg AND player_id = :A'));
  PERFORM pg_temp.reg_check('C told: entered_as_partner', '1', pg_temp.reg_notices('C', 'entered_as_partner'));

  -- Notice shape.
  PERFORM pg_temp.reg_check('notice shape', 'registration|{in_app,push,email}|custom|pending|true|true',
    pg_temp.reg_val('SELECT event_type || ''|'' || channels::text || ''|'' || audience || ''|'' || status || ''|''
                       || (tournament_id = :reg) || ''|'' || (link = ''/tournaments/'' || :reg || ''?panel=my-entry&cat=MD'')
                       FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:C] AND payload->>''kind'' = ''entered_as_partner'''));
  PERFORM pg_temp.reg_check('notice payload names the actor', 'Reg A',
    pg_temp.reg_val('SELECT payload->>''actor_name'' FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:C] AND payload->>''kind'' = ''entered_as_partner'''));
  PERFORM pg_temp.reg_check('event-type notices have no group_key', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:C] AND group_key IS NOT NULL'));

  r := pg_temp.reg_save('B', 'reg', 'MD', 'C');
  PERFORM pg_temp.reg_check('B picks taken C', 'taken', r->>'status');
  PERFORM pg_temp.reg_check('taken names A', 'Reg A', r->>'with_name');
  PERFORM pg_temp.reg_check('taken changed nothing', '1', pg_temp.reg_rows('MD'));

  r := pg_temp.reg_save('D', 'reg', 'MD', NULL, '{"looking_for_partner": true}');
  PERFORM pg_temp.reg_check('D enters alone', 'entered', r->>'status');
  PERFORM pg_temp.reg_check('D looking', 'true',
    pg_temp.reg_val('SELECT looking_for_partner::text FROM public.tournament_participants WHERE tournament_id = :reg AND player_id = :D'));

  r := pg_temp.reg_save('B', 'reg', 'MD', 'D');
  PERFORM pg_temp.reg_check('B joins entered-alone D', 'joined', r->>'status');
  PERFORM pg_temp.reg_check('one row D|B', 'D|B', pg_temp.reg_pair('MD', 'D'));
  PERFORM pg_temp.reg_check('joining clears looking', 'false',
    pg_temp.reg_val('SELECT looking_for_partner::text FROM public.tournament_participants WHERE tournament_id = :reg AND player_id = :D'));
  PERFORM pg_temp.reg_check('D told', '1', pg_temp.reg_notices('D', 'entered_as_partner'));
  PERFORM pg_temp.reg_check('rows after join', '2', pg_temp.reg_rows('MD'));

  r := pg_temp.reg_save('B', 'reg', 'MD', 'D');
  PERFORM pg_temp.reg_check('already together: nothing new', 'unchanged', r->>'status');
  PERFORM pg_temp.reg_check('still two rows', '2', pg_temp.reg_rows('MD'));

  -- Swap: C is the stored partner of A|C; C picks E.
  r := pg_temp.reg_save('C', 'reg', 'MD', 'E');
  PERFORM pg_temp.reg_check('C changes partner', 'entered', r->>'status');
  PERFORM pg_temp.reg_check('columns swap: caller is player_id', 'C|E', pg_temp.reg_pair('MD', 'C'));
  PERFORM pg_temp.reg_check('A left behind, entered alone', 'A|-', pg_temp.reg_pair('MD', 'A'));
  PERFORM pg_temp.reg_check('A told partner_left', '1', pg_temp.reg_notices('A', 'partner_left'));
  PERFORM pg_temp.reg_check('E told', '1', pg_temp.reg_notices('E', 'entered_as_partner'));

  -- Self pick refused.
  PERFORM pg_temp.reg_check('self pick refused', 'self', pg_temp.reg_save('A', 'reg', 'MD', 'A')->>'reason');
END $$;

-- ------------------------------------------------------- leave / withdraw --
DO $$
DECLARE r jsonb; v_waitlisted text;
BEGIN
  r := pg_temp.reg_call('E', 'SELECT public.leave_my_pair(:reg, ''MD'')::text');
  PERFORM pg_temp.reg_check('E leaves', 'left', r->>'status');
  PERFORM pg_temp.reg_check('C stays alone', 'C|-', pg_temp.reg_pair('MD', 'C'));
  PERFORM pg_temp.reg_check('E stays entered alone', 'E|-', pg_temp.reg_pair('MD', 'E'));
  PERFORM pg_temp.reg_check('C told partner_left', '1', pg_temp.reg_notices('C', 'partner_left'));

  -- Leave never moves the waitlist (it frees no place).
  INSERT INTO public.tournament_category_settings (tournament_id, category, max_entries)
  VALUES (pg_temp.reg_id('reg'), 'MD', (SELECT count(*) FROM public.tournament_participants WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'MD'))
  ON CONFLICT (tournament_id, category) DO UPDATE SET max_entries = EXCLUDED.max_entries;
  r := pg_temp.reg_save('outsider', 'reg', 'MD');
  PERFORM pg_temp.reg_check('full category: waitlisted', 'waitlisted', r->>'status');
  PERFORM pg_temp.reg_check('waitlist position', '1', r->>'position');
  r := pg_temp.reg_save('linked_login', 'reg', 'MD');
  PERFORM pg_temp.reg_check('second on waitlist', '2', r->>'position');
  PERFORM pg_temp.reg_expect('linked_login', 'my waitlist position', '2',
    'SELECT waitlist_position::text FROM public.my_waitlist_positions(:reg) WHERE category = ''MD''');
  PERFORM pg_temp.reg_expect('A', 'others have no waitlist position', '0',
    'SELECT count(*)::text FROM public.my_waitlist_positions(:reg)');
  PERFORM pg_temp.reg_check('waitlisted player is taken', 'taken', pg_temp.reg_save('C', 'reg', 'MD', 'outsider')->>'status');
  r := pg_temp.reg_call('D', 'SELECT public.leave_my_pair(:reg, ''MD'')::text');
  PERFORM pg_temp.reg_check('D leaves B', 'left', r->>'status');
  PERFORM pg_temp.reg_check('leave: waitlist unchanged', '2',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_waitlist WHERE tournament_id = :reg AND category = ''MD'''));

  -- The split put MD one over its cap (5 rows, cap 4): the first withdrawal
  -- deletes a row but the category is still full, so nobody moves yet.
  r := pg_temp.reg_call('A', 'SELECT public.withdraw_my_entry(:reg, ''MD'')::text');
  PERFORM pg_temp.reg_check('A withdraws', 'withdrawn', r->>'status');
  PERFORM pg_temp.reg_check('A row gone', NULL, pg_temp.reg_pair('MD', 'A'));
  PERFORM pg_temp.reg_check('still full: nobody moved', '2',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_waitlist WHERE tournament_id = :reg AND category = ''MD'''));
  -- The next deleted row frees a place: the first waitlisted entry moves up.
  r := pg_temp.reg_call('B', 'SELECT public.withdraw_my_entry(:reg, ''MD'')::text');
  PERFORM pg_temp.reg_check('outsider moved up', 'outsider|-', pg_temp.reg_pair('MD', 'outsider'));
  PERFORM pg_temp.reg_check('outsider told', '1', pg_temp.reg_notices('outsider', 'waitlist_promoted'));
  PERFORM pg_temp.reg_check('one still waiting', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_waitlist WHERE tournament_id = :reg AND category = ''MD'''));
  PERFORM pg_temp.reg_check('e-mail-linked login entered as its player row', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_waitlist WHERE tournament_id = :reg AND player_id = :linked'));

  -- Withdraw from a pair: the other stays alone, nothing deleted, no move.
  PERFORM pg_temp.reg_save('B', 'reg', 'MD', 'E');           -- B (alone) picks E (alone): joins E's row
  PERFORM pg_temp.reg_check('B joined E', 'E|B', pg_temp.reg_pair('MD', 'B'));
  r := pg_temp.reg_call('B', 'SELECT public.withdraw_my_entry(:reg, ''MD'')::text');
  PERFORM pg_temp.reg_check('pair withdraw keeps E', 'E|-', pg_temp.reg_pair('MD', 'E'));
  PERFORM pg_temp.reg_check('pair withdraw: no waitlist move', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_waitlist WHERE tournament_id = :reg AND category = ''MD'''));
  PERFORM pg_temp.reg_check('E told partner_left after withdraw', '1', pg_temp.reg_notices('E', 'partner_left'));

  -- A locked category never moves its waitlist.
  UPDATE public.tournament_category_settings SET locked_at = now() WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'MD';
  PERFORM pg_temp.reg_check('withdraw refused when locked', 'locked',
    pg_temp.reg_call('E', 'SELECT public.withdraw_my_entry(:reg, ''MD'')::text')->>'reason');
  PERFORM pg_temp.reg_check('locked: promote does nothing', '0', public.reg_promote_waitlist(pg_temp.reg_id('reg'), 'MD')::text);
  UPDATE public.tournament_category_settings SET locked_at = NULL, max_entries = NULL WHERE tournament_id = pg_temp.reg_id('reg') AND category = 'MD';
END $$;

-- --------------------------------------------------------- partner requests --
DO $$
DECLARE r jsonb; v_req uuid;
BEGIN
  -- MD now: C alone, D alone, E alone, outsider alone. A re-enters alone.
  PERFORM pg_temp.reg_save('A', 'reg', 'MD');
  PERFORM pg_temp.reg_save('D', 'reg', 'MD', 'C');                -- D joins C's row: C|D
  PERFORM pg_temp.reg_check('C|D pair', 'C|D', pg_temp.reg_pair('MD', 'C'));
  r := pg_temp.reg_call('A', 'SELECT public.request_partner(:reg, ''MD'', :C)::text');
  PERFORM pg_temp.reg_check('A asks C', 'requested', r->>'status');
  v_req := (r->>'request_id')::uuid;
  PERFORM pg_temp.reg_check('C told partner_request', '1', pg_temp.reg_notices('C', 'partner_request'));
  PERFORM pg_temp.reg_check('second ask is a no-op', 'already_requested',
    pg_temp.reg_call('A', 'SELECT public.request_partner(:reg, ''MD'', :C)::text')->>'status');
  PERFORM pg_temp.reg_fails('B', 'only the receiver can answer', 'registration_forbidden',
    format('SELECT public.answer_partner_request(%L::uuid, true)::text', v_req));

  r := pg_temp.reg_call('C', format('SELECT public.answer_partner_request(%L::uuid, true)::text', v_req));
  PERFORM pg_temp.reg_check('C accepts', 'accepted', r->>'status');
  PERFORM pg_temp.reg_check('accept: C pairs with A in A''s row', 'C|A', pg_temp.reg_pair('MD', 'A'));
  PERFORM pg_temp.reg_check('accept: D left alone', 'D|-', pg_temp.reg_pair('MD', 'D'));
  PERFORM pg_temp.reg_check('A told accepted', '1', pg_temp.reg_notices('A', 'partner_request_accepted'));
  PERFORM pg_temp.reg_check('D told partner_left', '1', pg_temp.reg_notices('D', 'partner_left'));

  -- Stale: the sender got a partner since asking.
  r := pg_temp.reg_call('E', 'SELECT public.request_partner(:reg, ''MD'', :D)::text');
  v_req := (r->>'request_id')::uuid;
  PERFORM pg_temp.reg_save('E', 'reg', 'MD', 'outsider');          -- E joins outsider
  r := pg_temp.reg_call('D', format('SELECT public.answer_partner_request(%L::uuid, true)::text', v_req));
  PERFORM pg_temp.reg_check('stale: sender has a partner', 'stale', r->>'status');
  PERFORM pg_temp.reg_check('stale: sender told', '1', pg_temp.reg_notices('E', 'partner_request_stale'));
  PERFORM pg_temp.reg_check('stale: receiver told too', '1', pg_temp.reg_notices('D', 'partner_request_stale'));
  PERFORM pg_temp.reg_check('stale changed nothing', 'D|-', pg_temp.reg_pair('MD', 'D'));

  -- Stale: the receiver's pair changed since the ask (XD: F with A, C asks F, A withdraws).
  PERFORM pg_temp.reg_save('F', 'reg', 'XD', 'A');
  r := pg_temp.reg_call('C', 'SELECT public.request_partner(:reg, ''XD'', :F)::text');
  v_req := (r->>'request_id')::uuid;
  PERFORM pg_temp.reg_call('A', 'SELECT public.withdraw_my_entry(:reg, ''XD'')::text');
  r := pg_temp.reg_call('F', format('SELECT public.answer_partner_request(%L::uuid, true)::text', v_req));
  PERFORM pg_temp.reg_check('stale: receiver''s entry changed', 'your entry changed', r->>'reason');

  -- Withdrawing expires your pending requests.
  r := pg_temp.reg_call('W', 'SELECT public.request_partner(:reg, ''XD'', :C)::text');
  v_req := (r->>'request_id')::uuid;
  PERFORM pg_temp.reg_save('W', 'reg', 'XD');
  PERFORM pg_temp.reg_call('W', 'SELECT public.withdraw_my_entry(:reg, ''XD'')::text');
  PERFORM pg_temp.reg_check('sender withdrew: request expired', 'expired',
    pg_temp.reg_call('C', format('SELECT public.answer_partner_request(%L::uuid, true)::text', v_req))->>'status');

  -- Decline.
  r := pg_temp.reg_call('E', 'SELECT public.request_partner(:reg, ''MD'', :A)::text');
  r := pg_temp.reg_call('A', format('SELECT public.answer_partner_request(%L::uuid, false)::text', (r->>'request_id')));
  PERFORM pg_temp.reg_check('decline', 'declined', r->>'status');
  PERFORM pg_temp.reg_check('sender told declined', '1', pg_temp.reg_notices('E', 'partner_request_declined'));
END $$;

-- ---------------------------------------------------------- gender + limits --
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.reg_check('man alone in WD refused', 'gender', pg_temp.reg_save('A', 'reg', 'WD')->>'reason');
  PERFORM pg_temp.reg_check('two men in XD refused', 'gender', pg_temp.reg_save('D', 'reg', 'XD', 'B')->>'reason');
  PERFORM pg_temp.reg_check('unknown gender allowed', 'entered', pg_temp.reg_save('U', 'reg', 'XD', 'W')->>'status');
  UPDATE public.tournaments SET ignore_gender_rules = true WHERE id = pg_temp.reg_id('reg');
  PERFORM pg_temp.reg_check('ignore_gender_rules', 'entered', pg_temp.reg_save('A', 'reg', 'WD')->>'status');
  PERFORM pg_temp.reg_call('A', 'SELECT public.withdraw_my_entry(:reg, ''WD'')::text');
  UPDATE public.tournaments SET ignore_gender_rules = false, max_events_per_player = 2 WHERE id = pg_temp.reg_id('reg');

  -- E is in MD; MS makes 2; a third category is refused.
  PERFORM pg_temp.reg_check('E second event ok', 'entered', pg_temp.reg_save('E', 'reg', 'MS')->>'status');
  PERFORM pg_temp.reg_check('E third event refused', 'events_limit', pg_temp.reg_save('E', 'reg', 'XD', 'F')->>'reason');
  -- Checked for the partner too: W is in XD + MS = 2; D (MD only) picking W in... W already in XD, so use WD for F/W.
  PERFORM pg_temp.reg_save('W', 'reg', 'MS');
  r := pg_temp.reg_save('F', 'reg', 'WD', 'W');
  PERFORM pg_temp.reg_check('partner over the limit refused', 'events_limit', r->>'reason');
  PERFORM pg_temp.reg_check('names the partner', 'true', ((r->'player_ids') ? pg_temp.reg_id('W')::text)::text);
  UPDATE public.tournaments SET max_events_per_player = NULL WHERE id = pg_temp.reg_id('reg');
END $$;

-- ------------------------------------------------------------ guest partner --
DO $$
DECLARE r jsonb; v_guest uuid;
BEGIN
  r := pg_temp.reg_save('F', 'reg', 'WD', NULL, '{"guest_partner": {"name": "Guest Gita", "phone": "9876543210"}}');
  PERFORM pg_temp.reg_check('guest partner entered', 'entered', r->>'status');
  SELECT partner_id INTO v_guest FROM public.tournament_participants WHERE id = (r->>'participant_id')::uuid;
  PERFORM pg_temp.reg_check('guest is a guest player', 'true|Guest Gita',
    (SELECT is_guest || '|' || full_name FROM public.players WHERE id = v_guest));
  PERFORM pg_temp.reg_check('phone only in the private table', '9876543210',
    (SELECT partner_guest_phone FROM public.tournament_entry_contacts WHERE participant_id = (r->>'participant_id')::uuid));
  PERFORM pg_temp.reg_check('guests get no notices', '0',
    (SELECT count(*)::text FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[v_guest]));
END $$;

-- ---------------------------------------------------------------- summary --
DO $$
BEGIN
  PERFORM pg_temp.reg_check('summary row for A', 'approved|{MD}|MD: Reg C',
    pg_temp.reg_val('SELECT status || ''|'' || categories::text || ''|'' || partner_names FROM public.tournament_registrations WHERE tournament_id = :reg AND player_id = :A'));
  PERFORM pg_temp.reg_check('summary row for C (both members)', 'approved|{MD}|MD: Reg A',
    pg_temp.reg_val('SELECT status || ''|'' || categories::text || ''|'' || partner_names FROM public.tournament_registrations WHERE tournament_id = :reg AND player_id = :C'));
  PERFORM pg_temp.reg_check('e-mail-linked player promoted once the cap was lifted', 'approved|MD: no partner',
    pg_temp.reg_val('SELECT status || ''|'' || partner_names FROM public.tournament_registrations WHERE tournament_id = :reg AND player_id = :linked'));
  INSERT INTO public.tournament_waitlist (tournament_id, category, player_id) VALUES (pg_temp.reg_id('reg'), 'WD', pg_temp.reg_id('U'));
  PERFORM pg_temp.reg_check('waitlist shows in summary', 'WD: no partner (waitlist); XD: Reg W',
    pg_temp.reg_val('SELECT partner_names FROM public.tournament_registrations WHERE tournament_id = :reg AND player_id = :U'));
  DELETE FROM public.tournament_waitlist WHERE tournament_id = pg_temp.reg_id('reg') AND player_id = pg_temp.reg_id('U');
  PERFORM pg_temp.reg_call('B', 'SELECT public.withdraw_my_entry(:reg, ''MD'')::text');
  PERFORM pg_temp.reg_check('summary withdrawn when nothing left', 'withdrawn|{}',
    pg_temp.reg_val('SELECT status || ''|'' || categories::text FROM public.tournament_registrations WHERE tournament_id = :reg AND player_id = :B'));
  PERFORM pg_temp.reg_check('no summary rows for the flag-off tournament', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_registrations WHERE tournament_id = :off'));
  -- Players can't write the summary directly while the flag is on.
  PERFORM pg_temp.reg_fails('E', 'direct registration insert refused', 'row-level security',
    'INSERT INTO public.tournament_registrations (tournament_id, player_id, full_name) VALUES (:reg, :E, ''x'') RETURNING 1');
  PERFORM pg_temp.reg_expect('E', 'direct registration insert still fine with the flag off', '1',
    'WITH i AS (INSERT INTO public.tournament_registrations (tournament_id, player_id, full_name) VALUES (:off, :E, ''x'') RETURNING 1) SELECT count(*) FROM i');
END $$;

-- ------------------------------------------- email always on, no participant e-mail --
DO $$
BEGIN
  PERFORM pg_temp.reg_check('B has e-mail off', 'false', pg_temp.reg_val('SELECT pref_receive_email::text FROM public.players WHERE id = :B'));
  PERFORM pg_temp.reg_check('B''s notices still carry the email channel', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.scheduled_notifications WHERE :B = ANY (recipient_ids) AND event_type = ''registration'' AND NOT (''email'' = ANY (channels))'));
  PERFORM pg_temp.reg_check('B has registration notices', 'true',
    pg_temp.reg_val('SELECT (count(*) > 0)::text FROM public.scheduled_notifications WHERE :B = ANY (recipient_ids) AND event_type = ''registration'''));
  PERFORM pg_temp.reg_check('RPCs never write participant e-mail', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_participants WHERE tournament_id = :reg AND email IS NOT NULL'));
  PERFORM pg_temp.reg_check('events carry no phone', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_entry_events WHERE tournament_id = :reg AND (coalesce(before::text, '''') || coalesce(after::text, '''')) ~ ''98765'''));
  PERFORM pg_temp.reg_check('backup outbox filled for entry changes', 'true',
    pg_temp.reg_val('SELECT (count(*) > 5)::text FROM public.tournament_backup_outbox WHERE tournament_id = :reg'));
END $$;

-- ------------------------------------------------------ draw lock trigger --
DO $$
BEGIN
  INSERT INTO public.tournament_matches (tournament_id, category, match_code, round, round_name, match_number, status)
  VALUES (pg_temp.reg_id('off'), 'MS', 'REG_OFF_1', 1, 'R1', 1, 'scheduled');
  PERFORM pg_temp.reg_check('flag-off draw: no settings row', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_category_settings WHERE tournament_id = :off'));
  PERFORM pg_temp.reg_check('flag-off draw: match inserted', '1',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_matches WHERE tournament_id = :off'));

  PERFORM pg_temp.reg_call('C', 'SELECT public.request_partner(:reg, ''MS'', :E)::text');
  INSERT INTO public.tournament_matches (tournament_id, category, match_code, round, round_name, match_number, status)
  VALUES (pg_temp.reg_id('reg'), 'MS', 'REG_MS_1', 1, 'R1', 1, 'scheduled');
  PERFORM pg_temp.reg_check('draw locks MS', 'true|<NULL>',
    pg_temp.reg_val('SELECT (locked_at IS NOT NULL) || ''|'' || coalesce(entries_visibility, ''<NULL>'') FROM public.tournament_category_settings WHERE tournament_id = :reg AND category = ''MS'''));
  PERFORM pg_temp.reg_check('state locked after draw', 'locked', public.registration_category_state(pg_temp.reg_id('reg'), 'MS'));
  PERFORM pg_temp.reg_check('draw expires pending requests', '0',
    pg_temp.reg_val('SELECT count(*) FROM public.tournament_partner_requests WHERE tournament_id = :reg AND category = ''MS'' AND status = ''pending'''));
  PERFORM pg_temp.reg_check('MD untouched by the MS draw', 'open',
    public.registration_category_state(pg_temp.reg_id('reg'), 'MD'));
END $$;

-- --------------------------------------------------------- late withdrawal --
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.reg_check('Can''t play? refused while open', 'use_withdraw',
    pg_temp.reg_call('A', 'SELECT public.request_late_withdrawal(:reg, ''MD'', NULL)::text')->>'reason');
  r := pg_temp.reg_call('E', 'SELECT public.request_late_withdrawal(:reg, ''MS'', ''Exam that day'')::text');
  PERFORM pg_temp.reg_check('late withdrawal requested', 'requested', r->>'status');
  PERFORM pg_temp.reg_check('host told', '1', pg_temp.reg_notices('host', 'withdrawal_requested'));
  PERFORM pg_temp.reg_check('organiser told', '1', pg_temp.reg_notices('org', 'withdrawal_requested'));
  PERFORM pg_temp.reg_check('umpire official not told', '0', pg_temp.reg_notices('ump', 'withdrawal_requested'));
  PERFORM pg_temp.reg_check('host link opens the organiser view', 'true',
    pg_temp.reg_val('SELECT (link LIKE ''%panel=organizer&view=registration%'')::text FROM public.scheduled_notifications WHERE recipient_ids = ARRAY[:host] AND payload->>''kind'' = ''withdrawal_requested'''));
  PERFORM pg_temp.reg_check('second request reuses the first', 'already_requested',
    pg_temp.reg_call('E', 'SELECT public.request_late_withdrawal(:reg, ''MS'', NULL)::text')->>'status');
END $$;

-- ------------------------------------------------------------------ grants --
DO $$
DECLARE f text; internal text[] := ARRAY[
  'public.enqueue_registration_notice(uuid, text, uuid, text, jsonb, boolean)',
  'public.reg_save_one(public.tournaments, text, uuid, jsonb)',
  'public.reg_insert_entry(uuid, text, uuid, uuid, text, boolean)',
  'public.reg_set_row(uuid, uuid, uuid)',
  'public.reg_promote_waitlist(uuid, text, boolean)',
  'public.reg_log_event(uuid, text, uuid, text, uuid[], jsonb, jsonb, boolean)',
  'public.reg_sync_registration_summary(uuid, uuid)',
  'public.reg_lock_on_draw()', 'public.reg_summary_trigger()', 'public.registration_host_ids(uuid)'];
BEGIN
  FOREACH f IN ARRAY internal LOOP
    PERFORM pg_temp.reg_check('anon cannot execute ' || f, 'false', has_function_privilege('anon', f, 'EXECUTE')::text);
    PERFORM pg_temp.reg_check('authenticated cannot execute ' || f, 'false', has_function_privilege('authenticated', f, 'EXECUTE')::text);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.save_my_tournament_entries(uuid, jsonb)', 'public.leave_my_pair(uuid, text)',
    'public.withdraw_my_entry(uuid, text)', 'public.request_partner(uuid, text, uuid)',
    'public.answer_partner_request(uuid, boolean)', 'public.request_late_withdrawal(uuid, text, text)'] LOOP
    PERFORM pg_temp.reg_check('anon cannot execute ' || f, 'false', has_function_privilege('anon', f, 'EXECUTE')::text);
    PERFORM pg_temp.reg_check('authenticated executes ' || f, 'true', has_function_privilege('authenticated', f, 'EXECUTE')::text);
  END LOOP;
  -- Every new SECURITY DEFINER function pins search_path.
  PERFORM pg_temp.reg_check('definer functions set search_path', '0',
    (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
        AND (p.proname LIKE 'reg\_%' OR p.proname LIKE 'registration\_%' OR p.proname IN
             ('enqueue_registration_notice', 'save_my_tournament_entries', 'leave_my_pair', 'withdraw_my_entry',
              'request_partner', 'answer_partner_request', 'request_late_withdrawal'))
        AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')));
END $$;

SELECT 'registration_rpc_assertions: ' || n || ' checks passed' AS result FROM pg_temp.reg_passed;
