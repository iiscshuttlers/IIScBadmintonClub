-- In-app tournament registration, Migration B: player RPCs and triggers.
-- Plan: happy-gliding-book.md, Phase 3. Needs 20261123150000 (schema).
--
-- Flag safety: every RPC refuses tournaments without require_app_registration
-- (or TEAM); both triggers return early unless the flag is on and the format is
-- not TEAM, so flag-off tournaments behave exactly as before.
--
-- Rules (mirrored in client/src/lib/registration/*.ts):
--   * one advisory lock per tournament, taken by every registration RPC;
--   * a pair is one participant row (player_id + partner_id), equal rights;
--   * taken = in another row of the category (either column) or its waitlist;
--   * B picks C: free -> pair; C alone -> B joins C's row; C with A -> refused
--     ("C is already entered with A", B may Ask C); already together -> no-op;
--   * whoever is left behind stays entered alone and is told;
--   * a waitlist move happens only when a row is deleted while the category is open;
--   * RPCs never write tournament_participants.email.

-- ------------------------------------------------------------ pure state --
CREATE OR REPLACE FUNCTION public.registration_category_state(
  p_flag boolean, p_format text, p_status text,
  p_t_opens timestamptz, p_t_closes timestamptz,
  p_c_opens timestamptz, p_c_closes timestamptz,
  p_locked_at timestamptz, p_has_draw boolean, p_now timestamptz)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  -- Twin of registrationWindow() in client/src/lib/registration/window.ts.
  SELECT CASE
    WHEN NOT coalesce(p_flag, false)
      OR upper(coalesce(p_format, '')) = 'TEAM'
      OR lower(coalesce(p_status, '')) NOT IN ('upcoming', 'active') THEN 'hidden'
    WHEN coalesce(p_has_draw, false) THEN 'locked'
    WHEN p_locked_at IS NOT NULL THEN 'locked'
    WHEN coalesce(p_c_closes, p_t_closes) IS NOT NULL AND p_now >= coalesce(p_c_closes, p_t_closes) THEN 'locked'
    WHEN coalesce(p_c_opens, p_t_opens) IS NOT NULL AND p_now < coalesce(p_c_opens, p_t_opens) THEN 'not_open'
    WHEN coalesce(p_c_closes, p_t_closes) IS NOT NULL
      AND coalesce(p_c_closes, p_t_closes) - p_now < interval '24 hours' THEN 'closing_soon'
    ELSE 'open'
  END
$$;

CREATE OR REPLACE FUNCTION public.reg_category_has_draw(p_tournament_id uuid, p_category text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_matches m
     WHERE m.tournament_id = p_tournament_id
       AND upper(btrim(m.category)) = upper(btrim(p_category)))
$$;

CREATE OR REPLACE FUNCTION public.registration_category_state(p_tournament_id uuid, p_category text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.registration_category_state(
           t.require_app_registration, t.format_family, t.status,
           t.registration_opens_at, t.form_close_date,
           s.opens_at, s.closes_at, s.locked_at,
           public.reg_category_has_draw(t.id, p_category), now())
    FROM public.tournaments t
    LEFT JOIN public.tournament_category_settings s
      ON s.tournament_id = t.id AND s.category = p_category
   WHERE t.id = p_tournament_id
$$;

-- Flag on and not a team tournament (used by triggers and a policy).
CREATE OR REPLACE FUNCTION public.registration_flag_on(p_tournament_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((
    SELECT t.require_app_registration AND upper(coalesce(t.format_family, '')) <> 'TEAM'
      FROM public.tournaments t WHERE t.id = p_tournament_id), false)
$$;

-- Host and organisers: the creator plus ORGANIZER officials.
CREATE OR REPLACE FUNCTION public.registration_host_ids(p_tournament_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(DISTINCT x.id) FILTER (WHERE x.id IS NOT NULL), ARRAY[]::uuid[])
    FROM (
      SELECT t.created_by AS id FROM public.tournaments t WHERE t.id = p_tournament_id
      UNION ALL
      SELECT o.user_id FROM public.tournament_officials o
       WHERE o.tournament_id = p_tournament_id AND o.role = 'ORGANIZER'
    ) x
    JOIN public.players p ON p.id = x.id
$$;

-- ---------------------------------------------------------- small helpers --
CREATE OR REPLACE FUNCTION public.reg_lock(p_tournament_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT pg_advisory_xact_lock(hashtext('registration:' || p_tournament_id::text))
$$;

CREATE OR REPLACE FUNCTION public.reg_player_name(p_player_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT nullif(btrim(full_name), '') FROM public.players WHERE id = p_player_id
$$;

-- display_name exactly like addParticipant: "P1 & P2", singles = name.
CREATE OR REPLACE FUNCTION public.reg_display(p_player uuid, p_partner uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.reg_player_name(p_player) IS NOT NULL AND public.reg_player_name(p_partner) IS NOT NULL
      THEN public.reg_player_name(p_player) || ' & ' || public.reg_player_name(p_partner)
    ELSE coalesce(public.reg_player_name(p_player), public.reg_player_name(p_partner), 'TBD')
  END
$$;

CREATE OR REPLACE FUNCTION public.reg_is_doubles(p_category text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT upper(btrim(coalesce(p_category, ''))) IN ('MD', 'WD', 'XD') OR coalesce(p_category, '') ~* '(doubles|mixed)'
$$;

-- Twin of genderCheck(): 'ok' | 'mismatch' | 'unknown'. p_solo = no partner yet.
CREATE OR REPLACE FUNCTION public.reg_gender_check(p_category text, p_a text, p_b text, p_solo boolean, p_ignore boolean)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d text := CASE
    WHEN upper(btrim(coalesce(p_category, ''))) IN ('MD', 'WD', 'XD') THEN upper(btrim(p_category))
    WHEN p_category ~* 'mixed' THEN 'XD'
    WHEN p_category ~* '(women|ladies|girls).*doubles' THEN 'WD'
    WHEN p_category ~* '(men|boys).*doubles' THEN 'MD'
  END;
  present text[] := CASE WHEN p_solo THEN ARRAY[p_a] ELSE ARRAY[p_a, p_b] END;
  known text[];
BEGIN
  IF coalesce(p_ignore, false) OR d IS NULL THEN RETURN 'ok'; END IF;
  SELECT coalesce(array_agg(g), '{}') INTO known FROM unnest(present) g WHERE g IN ('Male', 'Female');
  IF (d = 'MD' AND 'Female' = ANY (known))
     OR (d = 'WD' AND 'Male' = ANY (known))
     OR (d = 'XD' AND cardinality(known) = 2 AND known[1] = known[2]) THEN
    RETURN 'mismatch';
  END IF;
  IF cardinality(known) < cardinality(present) THEN RETURN 'unknown'; END IF;
  RETURN 'ok';
END
$$;

CREATE OR REPLACE FUNCTION public.reg_next_seed(p_tournament_id uuid, p_category text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(max(seed), 0) + 1 FROM public.tournament_participants
   WHERE tournament_id = p_tournament_id AND category = p_category
$$;

CREATE OR REPLACE FUNCTION public.reg_insert_entry(
  p_tournament_id uuid, p_category text, p_player uuid, p_partner uuid, p_source text, p_looking boolean)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.tournament_participants
    (tournament_id, category, player_id, partner_id, display_name, seed, registered_by, source, looking_for_partner)
  VALUES (p_tournament_id, p_category, p_player, p_partner, public.reg_display(p_player, p_partner),
          public.reg_next_seed(p_tournament_id, p_category), public.resolve_my_player_id(), p_source,
          p_partner IS NULL AND coalesce(p_looking, false))
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

-- Rewrite one row's members (display name, looking flag and updated_at follow).
CREATE OR REPLACE FUNCTION public.reg_set_row(p_row_id uuid, p_player uuid, p_partner uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.tournament_participants
     SET player_id = p_player,
         partner_id = p_partner,
         display_name = public.reg_display(p_player, p_partner),
         looking_for_partner = CASE WHEN p_partner IS NULL THEN looking_for_partner ELSE false END,
         updated_at = now()
   WHERE id = p_row_id
$$;

-- Players of p_ids who would go over max_events_per_player by entering p_category.
CREATE OR REPLACE FUNCTION public.reg_over_events_limit(p_tournament_id uuid, p_category text, p_ids uuid[])
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH lim AS (SELECT max_events_per_player AS m FROM public.tournaments WHERE id = p_tournament_id),
  cats AS (
    SELECT x.pid, count(DISTINCT x.category) AS n, bool_or(x.category = p_category) AS already
      FROM (
        SELECT u.pid, tp.category FROM unnest(p_ids) u(pid)
          JOIN public.tournament_participants tp
            ON tp.tournament_id = p_tournament_id AND u.pid IN (tp.player_id, tp.partner_id)
        UNION ALL
        SELECT u.pid, w.category FROM unnest(p_ids) u(pid)
          JOIN public.tournament_waitlist w
            ON w.tournament_id = p_tournament_id AND u.pid IN (w.player_id, w.partner_id)
      ) x GROUP BY x.pid)
  SELECT coalesce(array_agg(c.pid), ARRAY[]::uuid[])
    FROM cats c, lim
   WHERE lim.m IS NOT NULL AND NOT c.already AND c.n + 1 > lim.m
$$;

CREATE OR REPLACE FUNCTION public.reg_category_full(p_tournament_id uuid, p_category text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((
    SELECT s.max_entries IS NOT NULL
       AND (SELECT count(*) FROM public.tournament_participants tp
             WHERE tp.tournament_id = p_tournament_id AND tp.category = p_category) >= s.max_entries
      FROM public.tournament_category_settings s
     WHERE s.tournament_id = p_tournament_id AND s.category = p_category), false)
$$;

CREATE OR REPLACE FUNCTION public.reg_waitlist_position(p_tournament_id uuid, p_category text, p_player uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pos::int FROM (
    SELECT row_number() OVER (ORDER BY created_at, id) AS pos, player_id, partner_id
      FROM public.tournament_waitlist
     WHERE tournament_id = p_tournament_id AND category = p_category) w
   WHERE p_player IN (w.player_id, w.partner_id)
   LIMIT 1
$$;

-- --------------------------------------------------------- event + backup --
CREATE OR REPLACE FUNCTION public.reg_log_event(
  p_tournament_id uuid, p_category text, p_participant_id uuid, p_action text,
  p_player_ids uuid[], p_before jsonb, p_after jsonb, p_backup boolean)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.tournament_entry_events
    (tournament_id, category, participant_id, actor_id, action, player_ids, before, after)
  VALUES (p_tournament_id, p_category, p_participant_id, public.resolve_my_player_id(), p_action,
          coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_player_ids) x WHERE x IS NOT NULL), '{}'),
          p_before, p_after)
  RETURNING id INTO v_id;
  IF p_backup THEN
    INSERT INTO public.tournament_backup_outbox (event_id, tournament_id) VALUES (v_id, p_tournament_id);
  END IF;
  RETURN v_id;
END
$$;

-- A row as event data: ids and names only (no phones, no e-mail).
CREATE OR REPLACE FUNCTION public.reg_row_json(p_player uuid, p_partner uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'player_id', p_player, 'player_name', public.reg_player_name(p_player),
    'partner_id', p_partner, 'partner_name', public.reg_player_name(p_partner))
$$;

-- -------------------------------------------------------------- notices --
-- One scheduled_notifications row per recipient. SQL writes only kind +
-- payload; the dispatcher builds the text with registrationMessages.ts.
CREATE OR REPLACE FUNCTION public.enqueue_registration_notice(
  p_player_id uuid, p_kind text, p_tournament_id uuid, p_category text, p_payload jsonb,
  p_allow_self boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_host boolean;
  v_link text;
  v_group text;
BEGIN
  IF p_player_id IS NULL THEN RETURN; END IF;
  -- Guests have no account; deleted players get nothing.
  IF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = p_player_id AND NOT p.is_guest AND p.deleted_at IS NULL) THEN
    RETURN;
  END IF;
  IF NOT p_allow_self AND p_player_id = public.resolve_my_player_id() THEN RETURN; END IF;

  SELECT name INTO v_name FROM public.tournaments WHERE id = p_tournament_id;
  v_host := p_kind IN ('duplicate_found', 'daily_summary')
            OR (p_kind = 'withdrawal_requested' AND p_player_id = ANY (public.registration_host_ids(p_tournament_id)));
  v_link := '/tournaments/' || p_tournament_id::text ||
            CASE WHEN v_host THEN '?panel=organizer&view=registration' || coalesce('&cat=' || p_category, '')
                 ELSE '?panel=my-entry' || coalesce('&cat=' || p_category, '') END;
  v_group := CASE
    WHEN p_kind IN ('incomplete_entry_auto', 'incomplete_entry_manual')
      THEN 'reg:incomplete:' || p_tournament_id || ':' || coalesce(p_category, '') || ':' || p_player_id
    WHEN p_kind = 'daily_summary'
      THEN 'reg:summary:' || p_tournament_id || ':' || p_player_id || ':' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')
  END;

  INSERT INTO public.scheduled_notifications AS sn
    (title, body, channels, audience, recipient_ids, scheduled_at, tournament_id, link,
     event_type, group_key, payload, created_by)
  VALUES (
    'Registration update: ' || coalesce(v_name, 'tournament'),
    'There''s an update to your entry. Open the app to see it.',
    ARRAY['in_app', 'push', 'email'], 'custom', ARRAY[p_player_id], now(), p_tournament_id, v_link,
    'registration', v_group,
    jsonb_build_object('kind', p_kind, 'tournament_name', v_name, 'category', p_category) || coalesce(p_payload, '{}'::jsonb),
    public.resolve_my_player_id())
  ON CONFLICT (group_key) WHERE status = 'pending' AND group_key IS NOT NULL
  DO UPDATE SET payload = EXCLUDED.payload, scheduled_at = EXCLUDED.scheduled_at, link = EXCLUDED.link;
END
$$;

-- ------------------------------------------------------------- waitlist --
-- Fill free places from the waitlist while the category is open. Returns how many moved up.
CREATE OR REPLACE FUNCTION public.reg_promote_waitlist(p_tournament_id uuid, p_category text, p_force boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  w public.tournament_waitlist%ROWTYPE;
  v_moved int := 0;
  v_row uuid;
BEGIN
  IF NOT p_force AND public.registration_category_state(p_tournament_id, p_category) NOT IN ('open', 'closing_soon') THEN
    RETURN 0;
  END IF;
  LOOP
    EXIT WHEN public.reg_category_full(p_tournament_id, p_category);
    SELECT * INTO w FROM public.tournament_waitlist
     WHERE tournament_id = p_tournament_id AND category = p_category
     ORDER BY created_at, id LIMIT 1;
    EXIT WHEN NOT FOUND;
    DELETE FROM public.tournament_waitlist WHERE id = w.id;
    -- Someone already entered by other means stays where they are.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.tournament_participants tp
       WHERE tp.tournament_id = p_tournament_id AND tp.category = p_category
         AND (w.player_id IN (tp.player_id, tp.partner_id) OR w.partner_id IN (tp.player_id, tp.partner_id)));
    v_row := public.reg_insert_entry(p_tournament_id, p_category, w.player_id, w.partner_id, 'app', false);
    UPDATE public.tournament_participants SET registered_by = coalesce(w.registered_by, registered_by) WHERE id = v_row;
    PERFORM public.enqueue_registration_notice(w.player_id, 'waitlist_promoted', p_tournament_id, p_category, '{}'::jsonb, true);
    PERFORM public.enqueue_registration_notice(w.partner_id, 'waitlist_promoted', p_tournament_id, p_category, '{}'::jsonb, true);
    PERFORM public.reg_log_event(p_tournament_id, p_category, v_row, 'promoted', ARRAY[w.player_id, w.partner_id],
      NULL, public.reg_row_json(w.player_id, w.partner_id), true);
    v_moved := v_moved + 1;
    EXIT WHEN p_force;  -- an organiser's "move up next" moves one pair
  END LOOP;
  RETURN v_moved;
END
$$;

-- ------------------------------------------------------- the player RPCs --
CREATE OR REPLACE FUNCTION public.reg_require_tournament(p_tournament_id uuid)
RETURNS public.tournaments
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v public.tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND OR NOT public.registration_flag_on(p_tournament_id) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'registration_not_in_app: this tournament does not take entries in the app';
  END IF;
  RETURN v;
END
$$;

CREATE OR REPLACE FUNCTION public.reg_require_me()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v uuid := public.resolve_my_player_id();
BEGIN
  IF v IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'registration_sign_in: sign in and set up your profile to enter';
  END IF;
  RETURN v;
END
$$;

-- One category of save_my_tournament_entries. Caller holds the lock and has
-- checked the category is open.
CREATE OR REPLACE FUNCTION public.reg_save_one(p_t public.tournaments, p_category text, p_me uuid, p_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t uuid := p_t.id;
  v_doubles boolean := public.reg_is_doubles(p_category);
  v_looking boolean := CASE WHEN p_item ? 'looking_for_partner' THEN (p_item->>'looking_for_partner')::boolean END;
  v_partner uuid;
  v_guest boolean := false;
  v_guest_name text;
  v_guest_phone text;
  v_mine public.tournament_participants%ROWTYPE;
  v_has_mine boolean;
  v_other uuid;
  v_wait public.tournament_waitlist%ROWTYPE;
  v_has_wait boolean;
  v_target public.tournament_participants%ROWTYPE;
  v_has_target boolean;
  v_target_other uuid;
  v_over uuid[];
  v_row uuid;
  v_freed boolean := false;
  v_res jsonb := jsonb_build_object('category', p_category);
BEGIN
  -- Partner wanted (doubles only).
  IF v_doubles AND jsonb_typeof(p_item->'guest_partner') = 'object' THEN
    v_guest := true;
    v_guest_name := left(btrim(coalesce(p_item->'guest_partner'->>'name', '')), 80);
    v_guest_phone := nullif(left(btrim(coalesce(p_item->'guest_partner'->>'phone', '')), 20), '');
    IF v_guest_name = '' THEN RETURN v_res || '{"status":"refused","reason":"guest_name_required"}'; END IF;
    v_partner := gen_random_uuid();
  ELSIF v_doubles THEN
    v_partner := nullif(p_item->>'partner_id', '')::uuid;
    IF v_partner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.players WHERE id = v_partner AND deleted_at IS NULL) THEN
      RETURN v_res || '{"status":"refused","reason":"unknown_partner"}';
    END IF;
  END IF;

  SELECT * INTO v_mine FROM public.tournament_participants
   WHERE tournament_id = v_t AND category = p_category AND p_me IN (player_id, partner_id)
   ORDER BY created_at, id LIMIT 1;
  v_has_mine := FOUND;
  v_other := CASE WHEN NOT v_has_mine THEN NULL
                  WHEN v_mine.player_id = p_me THEN v_mine.partner_id ELSE v_mine.player_id END;
  SELECT * INTO v_wait FROM public.tournament_waitlist
   WHERE tournament_id = v_t AND category = p_category AND p_me IN (player_id, partner_id) LIMIT 1;
  v_has_wait := FOUND;

  -- ---- no partner: enter alone, or just update the looking flag
  IF v_partner IS NULL THEN
    IF v_has_mine THEN
      UPDATE public.tournament_participants
         SET looking_for_partner = CASE WHEN v_other IS NULL THEN coalesce(v_looking, looking_for_partner) ELSE false END,
             updated_at = now()
       WHERE id = v_mine.id;
      RETURN v_res || jsonb_build_object('status', 'unchanged', 'participant_id', v_mine.id);
    END IF;
    IF v_has_wait THEN
      RETURN v_res || jsonb_build_object('status', 'waitlisted', 'position', public.reg_waitlist_position(v_t, p_category, p_me));
    END IF;
    IF cardinality(public.reg_over_events_limit(v_t, p_category, ARRAY[p_me])) > 0 THEN
      RETURN v_res || '{"status":"refused","reason":"events_limit"}';
    END IF;
    IF public.reg_gender_check(p_category, (SELECT gender FROM public.players WHERE id = p_me), NULL, true, p_t.ignore_gender_rules) = 'mismatch' THEN
      RETURN v_res || '{"status":"refused","reason":"gender"}';
    END IF;
    IF public.reg_category_full(v_t, p_category) THEN
      INSERT INTO public.tournament_waitlist (tournament_id, category, player_id, registered_by) VALUES (v_t, p_category, p_me, p_me);
      PERFORM public.reg_log_event(v_t, p_category, NULL, 'waitlisted', ARRAY[p_me], NULL, public.reg_row_json(p_me, NULL), true);
      RETURN v_res || jsonb_build_object('status', 'waitlisted', 'position', public.reg_waitlist_position(v_t, p_category, p_me));
    END IF;
    v_row := public.reg_insert_entry(v_t, p_category, p_me, NULL, 'app', v_looking);
    PERFORM public.reg_log_event(v_t, p_category, v_row, 'entered', ARRAY[p_me], NULL, public.reg_row_json(p_me, NULL), true);
    RETURN v_res || jsonb_build_object('status', 'entered', 'participant_id', v_row);
  END IF;

  -- ---- a partner
  IF v_partner = p_me THEN RETURN v_res || '{"status":"refused","reason":"self"}'; END IF;
  IF v_has_mine AND v_other = v_partner THEN
    UPDATE public.tournament_participants SET looking_for_partner = false, updated_at = now() WHERE id = v_mine.id;
    RETURN v_res || jsonb_build_object('status', 'unchanged', 'participant_id', v_mine.id);
  END IF;
  IF public.reg_gender_check(p_category,
       (SELECT gender FROM public.players WHERE id = p_me),
       CASE WHEN v_guest THEN NULL ELSE (SELECT gender FROM public.players WHERE id = v_partner) END,
       false, p_t.ignore_gender_rules) = 'mismatch' THEN
    RETURN v_res || '{"status":"refused","reason":"gender"}';
  END IF;

  IF NOT v_guest THEN
    SELECT * INTO v_target FROM public.tournament_participants
     WHERE tournament_id = v_t AND category = p_category AND v_partner IN (player_id, partner_id)
       AND (NOT v_has_mine OR id <> v_mine.id)
     ORDER BY created_at, id LIMIT 1;
    v_has_target := FOUND;
    IF v_has_target THEN
      v_target_other := CASE WHEN v_target.player_id = v_partner THEN v_target.partner_id ELSE v_target.player_id END;
      IF v_target_other IS NOT NULL THEN
        RETURN v_res || jsonb_build_object('status', 'taken', 'partner_id', v_partner,
          'with_player_id', v_target_other, 'with_name', public.reg_player_name(v_target_other));
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.tournament_waitlist
                   WHERE tournament_id = v_t AND category = p_category AND v_partner IN (player_id, partner_id)) THEN
      RETURN v_res || jsonb_build_object('status', 'taken', 'reason', 'partner_waitlisted', 'partner_id', v_partner);
    END IF;
    v_over := public.reg_over_events_limit(v_t, p_category, ARRAY[p_me, v_partner]);
    IF cardinality(v_over) > 0 THEN
      RETURN v_res || jsonb_build_object('status', 'refused', 'reason', 'events_limit', 'player_ids', to_jsonb(v_over));
    END IF;
  ELSE
    v_has_target := false;
    IF cardinality(public.reg_over_events_limit(v_t, p_category, ARRAY[p_me])) > 0 THEN
      RETURN v_res || '{"status":"refused","reason":"events_limit"}';
    END IF;
    -- Guest partners are guest players (name only); the phone stays private.
    INSERT INTO public.players (id, full_name, is_guest, department) VALUES (v_partner, v_guest_name, true, 'Guest');
  END IF;

  -- ---- C entered alone: B joins C's row
  IF v_has_target THEN
    PERFORM public.reg_set_row(v_target.id, v_partner, p_me);
    IF v_has_mine THEN
      IF v_other IS NULL THEN
        DELETE FROM public.tournament_participants WHERE id = v_mine.id;
        v_freed := true;
      ELSE
        PERFORM public.reg_set_row(v_mine.id, v_other, NULL);
        PERFORM public.enqueue_registration_notice(v_other, 'partner_left', v_t, p_category,
          jsonb_build_object('actor_name', public.reg_player_name(p_me)));
      END IF;
    ELSIF v_has_wait THEN
      DELETE FROM public.tournament_waitlist WHERE id = v_wait.id;
    END IF;
    PERFORM public.enqueue_registration_notice(v_partner, 'entered_as_partner', v_t, p_category,
      jsonb_build_object('actor_name', public.reg_player_name(p_me)));
    PERFORM public.reg_log_event(v_t, p_category, v_target.id, CASE WHEN v_has_mine THEN 'changed' ELSE 'entered' END,
      ARRAY[p_me, v_partner, v_other],
      CASE WHEN v_has_mine THEN public.reg_row_json(p_me, v_other) END, public.reg_row_json(p_me, v_partner), true);
    IF v_freed THEN PERFORM public.reg_promote_waitlist(v_t, p_category); END IF;
    RETURN v_res || jsonb_build_object('status', 'joined', 'participant_id', v_target.id);
  END IF;

  -- ---- C free
  IF v_has_mine THEN
    PERFORM public.reg_set_row(v_mine.id, p_me, v_partner);  -- caller becomes player_id
    v_row := v_mine.id;
    IF v_other IS NOT NULL THEN
      -- The old partner stays entered alone.
      PERFORM public.reg_insert_entry(v_t, p_category, v_other, NULL, 'app', false);
      PERFORM public.enqueue_registration_notice(v_other, 'partner_left', v_t, p_category,
        jsonb_build_object('actor_name', public.reg_player_name(p_me)));
    END IF;
    v_res := v_res || jsonb_build_object('status', 'entered', 'participant_id', v_row);
  ELSIF v_has_wait THEN
    UPDATE public.tournament_waitlist SET player_id = p_me, partner_id = v_partner WHERE id = v_wait.id;
    v_res := v_res || jsonb_build_object('status', 'waitlisted', 'position', public.reg_waitlist_position(v_t, p_category, p_me));
  ELSIF public.reg_category_full(v_t, p_category) THEN
    INSERT INTO public.tournament_waitlist (tournament_id, category, player_id, partner_id, registered_by)
    VALUES (v_t, p_category, p_me, v_partner, p_me);
    v_res := v_res || jsonb_build_object('status', 'waitlisted', 'position', public.reg_waitlist_position(v_t, p_category, p_me));
  ELSE
    v_row := public.reg_insert_entry(v_t, p_category, p_me, v_partner, 'app', false);
    v_res := v_res || jsonb_build_object('status', 'entered', 'participant_id', v_row);
  END IF;

  IF v_guest AND v_guest_phone IS NOT NULL AND v_row IS NOT NULL THEN
    INSERT INTO public.tournament_entry_contacts (participant_id, partner_guest_phone) VALUES (v_row, v_guest_phone)
    ON CONFLICT (participant_id) DO UPDATE SET partner_guest_phone = EXCLUDED.partner_guest_phone, updated_at = now();
  END IF;
  PERFORM public.enqueue_registration_notice(v_partner, 'entered_as_partner', v_t, p_category,
    jsonb_build_object('actor_name', public.reg_player_name(p_me), 'waitlisted', v_res->>'status' = 'waitlisted'));
  PERFORM public.reg_log_event(v_t, p_category, v_row,
    CASE WHEN v_res->>'status' = 'waitlisted' THEN 'waitlisted' WHEN v_has_mine THEN 'changed' ELSE 'entered' END,
    ARRAY[p_me, v_partner, v_other],
    CASE WHEN v_has_mine THEN public.reg_row_json(p_me, v_other) END, public.reg_row_json(p_me, v_partner), true);
  RETURN v_res;
END
$$;

-- p_entries: [{category, partner_id?, guest_partner?: {name, phone}, looking_for_partner?}]
-- Returns {results: [{category, status: entered|joined|unchanged|waitlisted|taken|refused, ...}]}.
CREATE OR REPLACE FUNCTION public.save_my_tournament_entries(p_tournament_id uuid, p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := public.reg_require_me();
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_item jsonb;
  v_cat text;
  v_state text;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'registration_bad_input: entries must be a list';
  END IF;
  PERFORM public.reg_lock(p_tournament_id);
  FOR v_item IN SELECT e FROM jsonb_array_elements(p_entries) e LOOP
    v_cat := btrim(coalesce(v_item->>'category', ''));
    IF NOT (v_cat = ANY (coalesce(v_t.categories, '{}'))) THEN
      v_results := v_results || jsonb_build_object('category', v_cat, 'status', 'refused', 'reason', 'unknown_category');
      CONTINUE;
    END IF;
    v_state := public.registration_category_state(p_tournament_id, v_cat);
    IF v_state NOT IN ('open', 'closing_soon') THEN
      v_results := v_results || jsonb_build_object('category', v_cat, 'status', 'refused', 'reason', v_state);
      CONTINUE;
    END IF;
    v_results := v_results || public.reg_save_one(v_t, v_cat, v_me, v_item);
  END LOOP;
  RETURN jsonb_build_object('results', v_results);
END
$$;

-- Either member leaves the pair: both stay entered alone; the other is told.
CREATE OR REPLACE FUNCTION public.leave_my_pair(p_tournament_id uuid, p_category text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := public.reg_require_me();
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_row public.tournament_participants%ROWTYPE;
  v_other uuid;
  v_new uuid;
  v_state text;
BEGIN
  PERFORM public.reg_lock(p_tournament_id);
  v_state := public.registration_category_state(p_tournament_id, p_category);
  IF v_state NOT IN ('open', 'closing_soon') THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', v_state);
  END IF;
  SELECT * INTO v_row FROM public.tournament_participants
   WHERE tournament_id = p_tournament_id AND category = p_category AND v_me IN (player_id, partner_id)
     AND player_id IS NOT NULL AND partner_id IS NOT NULL
   ORDER BY created_at, id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'no_pair'); END IF;
  v_other := CASE WHEN v_row.player_id = v_me THEN v_row.partner_id ELSE v_row.player_id END;
  PERFORM public.reg_set_row(v_row.id, v_other, NULL);
  v_new := public.reg_insert_entry(p_tournament_id, p_category, v_me, NULL, 'app', false);
  PERFORM public.enqueue_registration_notice(v_other, 'partner_left', p_tournament_id, p_category,
    jsonb_build_object('actor_name', public.reg_player_name(v_me)));
  PERFORM public.reg_log_event(p_tournament_id, p_category, v_row.id, 'left', ARRAY[v_me, v_other],
    public.reg_row_json(v_me, v_other), public.reg_row_json(v_me, NULL), true);
  RETURN jsonb_build_object('status', 'left', 'participant_id', v_new);
END
$$;

-- Leave the category. A pair's other member stays entered alone. A deleted
-- row frees a place, so the waitlist moves up (category still open).
CREATE OR REPLACE FUNCTION public.withdraw_my_entry(p_tournament_id uuid, p_category text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := public.reg_require_me();
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_row public.tournament_participants%ROWTYPE;
  v_other uuid;
  v_found boolean;
  v_waited boolean;
  v_state text;
BEGIN
  PERFORM public.reg_lock(p_tournament_id);
  v_state := public.registration_category_state(p_tournament_id, p_category);
  IF v_state NOT IN ('open', 'closing_soon') THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', v_state);
  END IF;
  SELECT * INTO v_row FROM public.tournament_participants
   WHERE tournament_id = p_tournament_id AND category = p_category AND v_me IN (player_id, partner_id)
   ORDER BY created_at, id LIMIT 1;
  v_found := FOUND;

  -- Waitlist: drop me; a waitlisted partner keeps the place in the queue.
  WITH gone AS (
    DELETE FROM public.tournament_waitlist
     WHERE tournament_id = p_tournament_id AND category = p_category AND player_id = v_me AND partner_id IS NULL
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM gone) INTO v_waited;
  UPDATE public.tournament_waitlist
     SET player_id = CASE WHEN player_id = v_me THEN partner_id ELSE player_id END, partner_id = NULL
   WHERE tournament_id = p_tournament_id AND category = p_category AND v_me IN (player_id, partner_id);
  v_waited := v_waited OR FOUND;

  UPDATE public.tournament_partner_requests SET status = 'expired', responded_at = now()
   WHERE tournament_id = p_tournament_id AND category = p_category AND status = 'pending'
     AND v_me IN (from_player_id, to_player_id);

  IF NOT v_found THEN
    IF v_waited THEN
      PERFORM public.reg_log_event(p_tournament_id, p_category, NULL, 'withdrawn', ARRAY[v_me], NULL, NULL, true);
      RETURN jsonb_build_object('status', 'withdrawn');
    END IF;
    RETURN jsonb_build_object('status', 'refused', 'reason', 'not_entered');
  END IF;

  v_other := CASE WHEN v_row.player_id = v_me THEN v_row.partner_id ELSE v_row.player_id END;
  IF v_other IS NOT NULL THEN
    PERFORM public.reg_set_row(v_row.id, v_other, NULL);
    PERFORM public.enqueue_registration_notice(v_other, 'partner_left', p_tournament_id, p_category,
      jsonb_build_object('actor_name', public.reg_player_name(v_me)));
  ELSE
    DELETE FROM public.tournament_participants WHERE id = v_row.id;
  END IF;
  PERFORM public.reg_log_event(p_tournament_id, p_category, v_row.id, 'withdrawn', ARRAY[v_me, v_other],
    public.reg_row_json(v_me, v_other), CASE WHEN v_other IS NOT NULL THEN public.reg_row_json(v_other, NULL) END, true);
  IF v_other IS NULL THEN
    PERFORM public.reg_promote_waitlist(p_tournament_id, p_category);
  END IF;
  RETURN jsonb_build_object('status', 'withdrawn');
END
$$;

-- "Ask C": a partner request to someone who is already entered with another player.
CREATE OR REPLACE FUNCTION public.request_partner(p_tournament_id uuid, p_category text, p_to_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := public.reg_require_me();
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_state text;
  v_to_row public.tournament_participants%ROWTYPE;
  v_to_partner uuid;
  v_id uuid;
BEGIN
  PERFORM public.reg_lock(p_tournament_id);
  v_state := public.registration_category_state(p_tournament_id, p_category);
  IF v_state NOT IN ('open', 'closing_soon') THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', v_state);
  END IF;
  IF NOT public.reg_is_doubles(p_category) THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'not_doubles'); END IF;
  IF p_to_player_id IS NULL OR p_to_player_id = v_me THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'self'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = p_to_player_id AND NOT is_guest AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', 'unknown_partner');
  END IF;
  SELECT * INTO v_to_row FROM public.tournament_participants
   WHERE tournament_id = p_tournament_id AND category = p_category AND p_to_player_id IN (player_id, partner_id)
   ORDER BY created_at, id LIMIT 1;
  IF FOUND THEN
    v_to_partner := CASE WHEN v_to_row.player_id = p_to_player_id THEN v_to_row.partner_id ELSE v_to_row.player_id END;
  END IF;
  IF v_to_partner = v_me THEN RETURN jsonb_build_object('status', 'unchanged'); END IF;

  INSERT INTO public.tournament_partner_requests
    (tournament_id, category, from_player_id, to_player_id, to_partner_id_at_request, from_had_entry)
  VALUES (p_tournament_id, p_category, v_me, p_to_player_id, v_to_partner,
          EXISTS (SELECT 1 FROM public.tournament_participants
                   WHERE tournament_id = p_tournament_id AND category = p_category AND v_me IN (player_id, partner_id)))
  ON CONFLICT (tournament_id, category, from_player_id, to_player_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already_requested');
  END IF;
  PERFORM public.enqueue_registration_notice(p_to_player_id, 'partner_request', p_tournament_id, p_category,
    jsonb_build_object('actor_name', public.reg_player_name(v_me), 'request_id', v_id,
                       'partner_name', public.reg_player_name(v_to_partner)));
  PERFORM public.reg_log_event(p_tournament_id, p_category, NULL, 'partner_request', ARRAY[v_me, p_to_player_id], NULL,
    jsonb_build_object('request_id', v_id), false);
  RETURN jsonb_build_object('status', 'requested', 'request_id', v_id);
END
$$;

-- C answers B's request. Accept re-checks everything under the lock: if B has
-- since got a partner or withdrawn, or C's pair changed, the request is stale
-- and both are told; otherwise C pairs with B and C's old partner (A) is told.
CREATE OR REPLACE FUNCTION public.answer_partner_request(p_request_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := public.reg_require_me();
  r public.tournament_partner_requests%ROWTYPE;
  v_t public.tournaments;
  v_state text;
  v_b uuid;
  v_b_row public.tournament_participants%ROWTYPE;
  v_has_b boolean;
  v_b_other uuid;
  v_c_row public.tournament_participants%ROWTYPE;
  v_has_c boolean;
  v_a uuid;
  v_stale text;
  v_row uuid;
  v_freed boolean := false;
BEGIN
  SELECT * INTO r FROM public.tournament_partner_requests WHERE id = p_request_id;
  IF NOT FOUND OR r.to_player_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'registration_forbidden: not your request';
  END IF;
  v_t := public.reg_require_tournament(r.tournament_id);
  PERFORM public.reg_lock(r.tournament_id);
  SELECT * INTO r FROM public.tournament_partner_requests WHERE id = p_request_id;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('status', r.status); END IF;

  v_state := public.registration_category_state(r.tournament_id, r.category);
  IF v_state NOT IN ('open', 'closing_soon') THEN
    UPDATE public.tournament_partner_requests SET status = 'expired', responded_at = now() WHERE id = r.id;
    RETURN jsonb_build_object('status', 'expired', 'reason', v_state);
  END IF;

  v_b := r.from_player_id;
  IF NOT p_accept THEN
    UPDATE public.tournament_partner_requests SET status = 'declined', responded_at = now() WHERE id = r.id;
    PERFORM public.enqueue_registration_notice(v_b, 'partner_request_declined', r.tournament_id, r.category,
      jsonb_build_object('actor_name', public.reg_player_name(v_me)));
    PERFORM public.reg_log_event(r.tournament_id, r.category, NULL, 'request_declined', ARRAY[v_me, v_b], NULL, NULL, false);
    RETURN jsonb_build_object('status', 'declined');
  END IF;

  SELECT * INTO v_b_row FROM public.tournament_participants
   WHERE tournament_id = r.tournament_id AND category = r.category AND v_b IN (player_id, partner_id)
   ORDER BY created_at, id LIMIT 1;
  v_has_b := FOUND;
  v_b_other := CASE WHEN NOT v_has_b THEN NULL WHEN v_b_row.player_id = v_b THEN v_b_row.partner_id ELSE v_b_row.player_id END;
  SELECT * INTO v_c_row FROM public.tournament_participants
   WHERE tournament_id = r.tournament_id AND category = r.category AND v_me IN (player_id, partner_id)
   ORDER BY created_at, id LIMIT 1;
  v_has_c := FOUND;
  v_a := CASE WHEN NOT v_has_c THEN NULL WHEN v_c_row.player_id = v_me THEN v_c_row.partner_id ELSE v_c_row.player_id END;

  IF v_has_b AND v_b_other = v_me THEN
    UPDATE public.tournament_partner_requests SET status = 'accepted', responded_at = now() WHERE id = r.id;
    RETURN jsonb_build_object('status', 'accepted', 'participant_id', v_b_row.id);
  END IF;

  v_stale := CASE
    WHEN v_has_b AND v_b_other IS NOT NULL THEN 'they now have a partner'
    WHEN r.from_had_entry AND NOT v_has_b THEN 'they withdrew'
    WHEN EXISTS (SELECT 1 FROM public.tournament_waitlist
                  WHERE tournament_id = r.tournament_id AND category = r.category AND v_b IN (player_id, partner_id))
      THEN 'they are on the waitlist'
    WHEN v_a IS DISTINCT FROM r.to_partner_id_at_request THEN 'your entry changed'
  END;
  IF v_stale IS NOT NULL THEN
    UPDATE public.tournament_partner_requests SET status = 'stale', stale_reason = v_stale, responded_at = now() WHERE id = r.id;
    PERFORM public.enqueue_registration_notice(v_b, 'partner_request_stale', r.tournament_id, r.category,
      jsonb_build_object('actor_name', public.reg_player_name(v_me), 'stale_reason', v_stale), true);
    PERFORM public.enqueue_registration_notice(v_me, 'partner_request_stale', r.tournament_id, r.category,
      jsonb_build_object('actor_name', public.reg_player_name(v_b), 'stale_reason', v_stale), true);
    RETURN jsonb_build_object('status', 'stale', 'reason', v_stale);
  END IF;

  IF public.reg_gender_check(r.category, (SELECT gender FROM public.players WHERE id = v_me),
       (SELECT gender FROM public.players WHERE id = v_b), false, v_t.ignore_gender_rules) = 'mismatch' THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', 'gender');
  END IF;
  IF cardinality(public.reg_over_events_limit(r.tournament_id, r.category, ARRAY[v_me, v_b])) > 0 THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', 'events_limit');
  END IF;

  IF v_has_b THEN
    -- B entered alone: C joins B's row; C's old row stays with A (or goes).
    PERFORM public.reg_set_row(v_b_row.id, v_me, v_b);
    v_row := v_b_row.id;
    IF v_has_c THEN
      IF v_a IS NULL THEN
        DELETE FROM public.tournament_participants WHERE id = v_c_row.id;
        v_freed := true;
      ELSE
        PERFORM public.reg_set_row(v_c_row.id, v_a, NULL);
      END IF;
    END IF;
  ELSIF v_has_c THEN
    PERFORM public.reg_set_row(v_c_row.id, v_me, v_b);
    v_row := v_c_row.id;
    IF v_a IS NOT NULL THEN
      PERFORM public.reg_insert_entry(r.tournament_id, r.category, v_a, NULL, 'app', false);
    END IF;
  ELSIF public.reg_category_full(r.tournament_id, r.category) THEN
    INSERT INTO public.tournament_waitlist (tournament_id, category, player_id, partner_id, registered_by)
    VALUES (r.tournament_id, r.category, v_me, v_b, v_me);
  ELSE
    v_row := public.reg_insert_entry(r.tournament_id, r.category, v_me, v_b, 'app', false);
  END IF;

  UPDATE public.tournament_partner_requests SET status = 'accepted', responded_at = now() WHERE id = r.id;
  PERFORM public.enqueue_registration_notice(v_b, 'partner_request_accepted', r.tournament_id, r.category,
    jsonb_build_object('actor_name', public.reg_player_name(v_me)));
  IF v_a IS NOT NULL THEN
    PERFORM public.enqueue_registration_notice(v_a, 'partner_left', r.tournament_id, r.category,
      jsonb_build_object('actor_name', public.reg_player_name(v_me)));
  END IF;
  PERFORM public.reg_log_event(r.tournament_id, r.category, v_row, 'changed', ARRAY[v_me, v_b, v_a],
    public.reg_row_json(v_me, v_a), public.reg_row_json(v_me, v_b), true);
  IF v_freed THEN PERFORM public.reg_promote_waitlist(r.tournament_id, r.category); END IF;
  RETURN jsonb_build_object('status', 'accepted', 'participant_id', v_row);
END
$$;

-- After the lock: "Can't play?" asks the organiser to withdraw the pair.
CREATE OR REPLACE FUNCTION public.request_late_withdrawal(p_tournament_id uuid, p_category text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := public.reg_require_me();
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_row public.tournament_participants%ROWTYPE;
  v_other uuid;
  v_id uuid;
  v_host uuid;
  v_state text := public.registration_category_state(p_tournament_id, p_category);
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
BEGIN
  IF v_state <> 'locked' THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', CASE WHEN v_state IN ('open', 'closing_soon') THEN 'use_withdraw' ELSE v_state END);
  END IF;
  PERFORM public.reg_lock(p_tournament_id);
  SELECT * INTO v_row FROM public.tournament_participants
   WHERE tournament_id = p_tournament_id AND category = p_category AND v_me IN (player_id, partner_id)
   ORDER BY created_at, id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'not_entered'); END IF;
  SELECT id INTO v_id FROM public.tournament_withdrawal_requests
   WHERE participant_id = v_row.id AND status IN ('pending', 'waiting_opponent') LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('status', 'already_requested', 'request_id', v_id); END IF;
  v_other := CASE WHEN v_row.player_id = v_me THEN v_row.partner_id ELSE v_row.player_id END;

  INSERT INTO public.tournament_withdrawal_requests (tournament_id, category, participant_id, requested_by, player_ids, reason)
  VALUES (p_tournament_id, p_category, v_row.id, v_me, array_remove(ARRAY[v_row.player_id, v_row.partner_id], NULL), v_reason)
  RETURNING id INTO v_id;

  PERFORM public.enqueue_registration_notice(v_other, 'withdrawal_requested', p_tournament_id, p_category,
    jsonb_build_object('actor_name', public.reg_player_name(v_me), 'withdraw_reason', v_reason));
  FOREACH v_host IN ARRAY public.registration_host_ids(p_tournament_id) LOOP
    CONTINUE WHEN v_host = v_other;
    PERFORM public.enqueue_registration_notice(v_host, 'withdrawal_requested', p_tournament_id, p_category,
      jsonb_build_object('actor_name', public.reg_player_name(v_me), 'withdraw_reason', v_reason, 'request_id', v_id));
  END LOOP;
  PERFORM public.reg_log_event(p_tournament_id, p_category, v_row.id, 'withdrawal_requested', ARRAY[v_me, v_other],
    NULL, jsonb_build_object('request_id', v_id), false);
  RETURN jsonb_build_object('status', 'requested', 'request_id', v_id);
END
$$;

-- My place on each category's waitlist (players only see their own waitlist rows).
CREATE OR REPLACE FUNCTION public.my_waitlist_positions(p_tournament_id uuid)
RETURNS TABLE (category text, waitlist_position integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT w.category, public.reg_waitlist_position(p_tournament_id, w.category, public.resolve_my_player_id())
    FROM public.tournament_waitlist w
   WHERE w.tournament_id = p_tournament_id
     AND public.resolve_my_player_id() IN (w.player_id, w.partner_id)
$$;

-- ------------------------------------------------------------- triggers --
-- Making the draw locks the category (flag-on, non-TEAM tournaments only).
CREATE OR REPLACE FUNCTION public.reg_lock_on_draw()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    WITH cats AS (
      SELECT DISTINCT n.tournament_id, n.category
        FROM new_rows n
       WHERE n.category IS NOT NULL AND public.registration_flag_on(n.tournament_id))
    , locked AS (
      INSERT INTO public.tournament_category_settings (tournament_id, category, locked_at)
      SELECT c.tournament_id, c.category, now() FROM cats c
      ON CONFLICT (tournament_id, category)
      DO UPDATE SET locked_at = coalesce(public.tournament_category_settings.locked_at, EXCLUDED.locked_at), updated_at = now()
      RETURNING tournament_id, category)
    UPDATE public.tournament_partner_requests pr SET status = 'expired', responded_at = now()
      FROM locked l
     WHERE pr.status = 'pending' AND pr.tournament_id = l.tournament_id AND pr.category = l.category;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reg_lock_on_draw failed: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tournament_matches_registration_lock ON public.tournament_matches;
CREATE TRIGGER tournament_matches_registration_lock
  AFTER INSERT ON public.tournament_matches
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.reg_lock_on_draw();

-- tournament_registrations as a per-player summary of their entries.
CREATE OR REPLACE FUNCTION public.reg_sync_registration_summary(p_tournament_id uuid, p_player_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cats text[];
  v_partners text;
  v_p public.players%ROWTYPE;
BEGIN
  IF p_player_id IS NULL OR p_tournament_id IS NULL OR NOT public.registration_flag_on(p_tournament_id) THEN RETURN; END IF;
  SELECT * INTO v_p FROM public.players WHERE id = p_player_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT coalesce(array_agg(DISTINCT x.category ORDER BY x.category), '{}'),
         string_agg(x.category || ': ' || coalesce(x.partner_name, 'no partner') || x.note, '; ' ORDER BY x.category)
    INTO v_cats, v_partners
    FROM (
      SELECT tp.category,
             public.reg_player_name(CASE WHEN tp.player_id = p_player_id THEN tp.partner_id ELSE tp.player_id END) AS partner_name,
             '' AS note
        FROM public.tournament_participants tp
       WHERE tp.tournament_id = p_tournament_id AND p_player_id IN (tp.player_id, tp.partner_id)
      UNION ALL
      SELECT w.category,
             public.reg_player_name(CASE WHEN w.player_id = p_player_id THEN w.partner_id ELSE w.player_id END),
             ' (waitlist)'
        FROM public.tournament_waitlist w
       WHERE w.tournament_id = p_tournament_id AND p_player_id IN (w.player_id, w.partner_id)
    ) x;

  IF cardinality(v_cats) = 0 THEN
    -- A guest with no entries left is usually being claimed (merge_player_identity
    -- moves their rows to the real player). Drop the guest's summary row so the
    -- merge's own tournament_registrations update can't collide with the real
    -- player's row that this trigger has just written.
    IF v_p.is_guest THEN
      DELETE FROM public.tournament_registrations
       WHERE tournament_id = p_tournament_id AND player_id = p_player_id;
      RETURN;
    END IF;
    UPDATE public.tournament_registrations
       SET status = 'withdrawn', categories = '{}', partner_names = NULL
     WHERE tournament_id = p_tournament_id AND player_id = p_player_id AND status <> 'withdrawn';
    RETURN;
  END IF;

  -- Legacy pending rows keep message / transaction_id / receipt.
  INSERT INTO public.tournament_registrations AS tr
    (tournament_id, player_id, full_name, email, phone, categories, partner_names, status)
  VALUES (p_tournament_id, p_player_id, v_p.full_name, coalesce(v_p.email, v_p.iisc_email), v_p.contact_number,
          v_cats, v_partners, 'approved')
  ON CONFLICT (tournament_id, player_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = coalesce(EXCLUDED.email, tr.email),
    phone = coalesce(EXCLUDED.phone, tr.phone),
    categories = EXCLUDED.categories,
    partner_names = EXCLUDED.partner_names,
    status = 'approved';
END
$$;

CREATE OR REPLACE FUNCTION public.reg_summary_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t uuid := coalesce(NEW.tournament_id, OLD.tournament_id);
  v_id uuid;
BEGIN
  IF NOT public.registration_flag_on(v_t) THEN RETURN NULL; END IF;
  BEGIN
    FOR v_id IN
      SELECT DISTINCT x FROM unnest(ARRAY[
        CASE WHEN TG_OP <> 'DELETE' THEN NEW.player_id END, CASE WHEN TG_OP <> 'DELETE' THEN NEW.partner_id END,
        CASE WHEN TG_OP <> 'INSERT' THEN OLD.player_id END, CASE WHEN TG_OP <> 'INSERT' THEN OLD.partner_id END]) x
       WHERE x IS NOT NULL
    LOOP
      PERFORM public.reg_sync_registration_summary(v_t, v_id);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reg_summary_trigger failed: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tournament_participants_registration_summary ON public.tournament_participants;
CREATE TRIGGER tournament_participants_registration_summary
  AFTER INSERT OR DELETE OR UPDATE OF player_id, partner_id, category ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.reg_summary_trigger();
DROP TRIGGER IF EXISTS tournament_waitlist_registration_summary ON public.tournament_waitlist;
CREATE TRIGGER tournament_waitlist_registration_summary
  AFTER INSERT OR DELETE OR UPDATE OF player_id, partner_id, category ON public.tournament_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.reg_summary_trigger();

-- Players can't write tournament_registrations directly while the flag is on
-- (the summary is maintained by the trigger above).
DROP POLICY IF EXISTS tournament_registrations_self_insert ON public.tournament_registrations;
CREATE POLICY tournament_registrations_self_insert ON public.tournament_registrations FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid() AND NOT public.registration_flag_on(tournament_id));

DROP POLICY IF EXISTS tournament_registrations_update ON public.tournament_registrations;
CREATE POLICY tournament_registrations_update ON public.tournament_registrations FOR UPDATE TO authenticated
  USING (is_admin_or_master() OR is_tournament_official(tournament_id)
         OR (player_id = auth.uid() AND status = 'pending' AND NOT public.registration_flag_on(tournament_id)))
  WITH CHECK (is_admin_or_master() OR is_tournament_official(tournament_id)
              OR (player_id = auth.uid() AND status = ANY (ARRAY['pending', 'withdrawn'])
                  AND reviewed_by IS NULL AND reviewed_at IS NULL AND NOT public.registration_flag_on(tournament_id)));

DROP POLICY IF EXISTS tournament_registrations_delete ON public.tournament_registrations;
CREATE POLICY tournament_registrations_delete ON public.tournament_registrations FOR DELETE TO authenticated
  USING (is_admin_or_master() OR is_tournament_official(tournament_id)
         OR (player_id = auth.uid() AND NOT public.registration_flag_on(tournament_id)));

-- --------------------------------------------------------------- grants --
-- Supabase's default privileges grant EXECUTE to anon/authenticated on new
-- functions: revoke, then grant only what clients call.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.registration_category_state(boolean, text, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, boolean, timestamptz)',
    'public.reg_category_has_draw(uuid, text)',
    'public.registration_category_state(uuid, text)',
    'public.registration_flag_on(uuid)',
    'public.registration_host_ids(uuid)',
    'public.reg_lock(uuid)',
    'public.reg_player_name(uuid)',
    'public.reg_display(uuid, uuid)',
    'public.reg_is_doubles(text)',
    'public.reg_gender_check(text, text, text, boolean, boolean)',
    'public.reg_next_seed(uuid, text)',
    'public.reg_insert_entry(uuid, text, uuid, uuid, text, boolean)',
    'public.reg_set_row(uuid, uuid, uuid)',
    'public.reg_over_events_limit(uuid, text, uuid[])',
    'public.reg_category_full(uuid, text)',
    'public.reg_waitlist_position(uuid, text, uuid)',
    'public.reg_log_event(uuid, text, uuid, text, uuid[], jsonb, jsonb, boolean)',
    'public.reg_row_json(uuid, uuid)',
    'public.enqueue_registration_notice(uuid, text, uuid, text, jsonb, boolean)',
    'public.reg_promote_waitlist(uuid, text, boolean)',
    'public.reg_require_tournament(uuid)',
    'public.reg_require_me()',
    'public.reg_save_one(public.tournaments, text, uuid, jsonb)',
    'public.save_my_tournament_entries(uuid, jsonb)',
    'public.leave_my_pair(uuid, text)',
    'public.withdraw_my_entry(uuid, text)',
    'public.request_partner(uuid, text, uuid)',
    'public.answer_partner_request(uuid, boolean)',
    'public.request_late_withdrawal(uuid, text, text)',
    'public.my_waitlist_positions(uuid)',
    'public.reg_lock_on_draw()',
    'public.reg_sync_registration_summary(uuid, uuid)',
    'public.reg_summary_trigger()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  -- Client-callable (signed in).
  FOREACH f IN ARRAY ARRAY[
    'public.registration_category_state(uuid, text)',
    'public.registration_flag_on(uuid)',          -- used by a tournament_registrations policy
    'public.save_my_tournament_entries(uuid, jsonb)',
    'public.leave_my_pair(uuid, text)',
    'public.withdraw_my_entry(uuid, text)',
    'public.request_partner(uuid, text, uuid)',
    'public.answer_partner_request(uuid, boolean)',
    'public.request_late_withdrawal(uuid, text, text)',
    'public.my_waitlist_positions(uuid)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
