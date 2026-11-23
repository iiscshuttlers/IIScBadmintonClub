-- In-app tournament registration, Migration C: organiser RPCs, conflicts, reminders.
-- Plan: happy-gliding-book.md, Phase 4. Needs 20261123150000 + 20261123150100.
-- The pg_cron schedule for the two queue_* functions is a separate migration
-- (20261123150500_registration_cron.sql), applied last.
--
-- Organiser = is_tournament_official(t, 'ORGANIZER'): admins, the creator and
-- ORGANIZER officials. Organiser edits work after the lock and only WARN about
-- taken players (organiser and form rows may still share a player; the
-- conflict trigger tells the host).

CREATE OR REPLACE FUNCTION public.reg_require_organiser(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tournament_official(p_tournament_id, 'ORGANIZER') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'registration_forbidden: organisers only';
  END IF;
END
$$;

-- Effective deadline of a category (category closes_at, else form_close_date).
CREATE OR REPLACE FUNCTION public.reg_category_deadline(p_tournament_id uuid, p_category text)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(s.closes_at, t.form_close_date)
    FROM public.tournaments t
    LEFT JOIN public.tournament_category_settings s ON s.tournament_id = t.id AND s.category = p_category
   WHERE t.id = p_tournament_id
$$;

-- ------------------------------------------------------- lock / settings --
CREATE OR REPLACE FUNCTION public.reg_lock_category(p_tournament_id uuid, p_category text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.tournament_category_settings (tournament_id, category, locked_at, locked_by)
  VALUES (p_tournament_id, p_category, now(), public.resolve_my_player_id())
  ON CONFLICT (tournament_id, category) DO UPDATE
    SET locked_at = coalesce(public.tournament_category_settings.locked_at, now()),
        locked_by = coalesce(public.tournament_category_settings.locked_by, EXCLUDED.locked_by),
        updated_at = now();
  UPDATE public.tournament_partner_requests SET status = 'expired', responded_at = now()
   WHERE tournament_id = p_tournament_id AND category = p_category AND status = 'pending';
END
$$;

-- Reopen: allowed until the draw exists; clears locked_at; when the deadline
-- has passed a new future deadline is required (and saved as closes_at).
CREATE OR REPLACE FUNCTION public.reg_reopen_category(p_tournament_id uuid, p_category text, p_new_closes_at timestamptz)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_deadline timestamptz := public.reg_category_deadline(p_tournament_id, p_category);
BEGIN
  IF public.reg_category_has_draw(p_tournament_id, p_category) THEN RETURN 'draw_exists'; END IF;
  IF v_deadline IS NOT NULL AND v_deadline <= now() AND (p_new_closes_at IS NULL OR p_new_closes_at <= now()) THEN
    RETURN 'needs_new_deadline';
  END IF;
  INSERT INTO public.tournament_category_settings (tournament_id, category) VALUES (p_tournament_id, p_category)
  ON CONFLICT (tournament_id, category) DO NOTHING;
  UPDATE public.tournament_category_settings
     SET locked_at = NULL, locked_by = NULL,
         closes_at = CASE WHEN p_new_closes_at IS NOT NULL THEN p_new_closes_at ELSE closes_at END,
         updated_at = now()
   WHERE tournament_id = p_tournament_id AND category = p_category;
  RETURN 'reopened';
END
$$;

CREATE OR REPLACE FUNCTION public.set_category_lock(
  p_tournament_id uuid, p_category text, p_locked boolean, p_new_closes_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_res text;
BEGIN
  PERFORM public.reg_require_organiser(p_tournament_id);
  IF NOT (p_category = ANY (coalesce(v_t.categories, '{}'))) THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', 'unknown_category');
  END IF;
  PERFORM public.reg_lock(p_tournament_id);
  IF p_locked THEN
    PERFORM public.reg_lock_category(p_tournament_id, p_category);
    v_res := 'locked';
  ELSE
    v_res := public.reg_reopen_category(p_tournament_id, p_category, p_new_closes_at);
    IF v_res <> 'reopened' THEN RETURN jsonb_build_object('status', 'refused', 'reason', v_res); END IF;
  END IF;
  PERFORM public.reg_log_event(p_tournament_id, p_category, NULL, v_res, '{}', NULL, NULL, false);
  RETURN jsonb_build_object('status', v_res, 'state', public.registration_category_state(p_tournament_id, p_category));
END
$$;

-- p_settings keys (only the keys present change): opens_at, closes_at,
-- entries_visibility (null = same as tournament), max_entries.
CREATE OR REPLACE FUNCTION public.set_category_settings(p_tournament_id uuid, p_category text, p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  s public.tournament_category_settings%ROWTYPE;
BEGIN
  PERFORM public.reg_require_organiser(p_tournament_id);
  IF NOT (p_category = ANY (coalesce(v_t.categories, '{}'))) THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', 'unknown_category');
  END IF;
  IF p_settings ? 'entries_visibility' AND p_settings->>'entries_visibility' IS NOT NULL
     AND p_settings->>'entries_visibility' NOT IN ('as_entered', 'after_close', 'after_draw', 'hidden') THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', 'bad_visibility');
  END IF;
  PERFORM public.reg_lock(p_tournament_id);
  INSERT INTO public.tournament_category_settings (tournament_id, category) VALUES (p_tournament_id, p_category)
  ON CONFLICT (tournament_id, category) DO NOTHING;
  UPDATE public.tournament_category_settings SET
    opens_at = CASE WHEN p_settings ? 'opens_at' THEN (p_settings->>'opens_at')::timestamptz ELSE opens_at END,
    closes_at = CASE WHEN p_settings ? 'closes_at' THEN (p_settings->>'closes_at')::timestamptz ELSE closes_at END,
    entries_visibility = CASE WHEN p_settings ? 'entries_visibility' THEN p_settings->>'entries_visibility' ELSE entries_visibility END,
    max_entries = CASE WHEN p_settings ? 'max_entries' THEN nullif((p_settings->>'max_entries')::int, 0) ELSE max_entries END,
    updated_at = now()
  WHERE tournament_id = p_tournament_id AND category = p_category
  RETURNING * INTO s;
  -- A raised cap lets the waitlist move up (open categories only).
  PERFORM public.reg_promote_waitlist(p_tournament_id, p_category);
  PERFORM public.reg_log_event(p_tournament_id, p_category, NULL, 'settings', '{}', NULL, p_settings, false);
  RETURN jsonb_build_object('status', 'saved', 'settings', to_jsonb(s),
                            'state', public.registration_category_state(p_tournament_id, p_category));
END
$$;

-- p_patch keys: opens_at (registration_opens_at), closes_at (form_close_date),
-- collect_payment, max_events_per_player, action ('lock_all' | 'reopen_all').
CREATE OR REPLACE FUNCTION public.set_registration_timeline(p_tournament_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_cat text;
  v_res text;
  v_out jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.reg_require_organiser(p_tournament_id);
  PERFORM public.reg_lock(p_tournament_id);
  UPDATE public.tournaments SET
    registration_opens_at = CASE WHEN p_patch ? 'opens_at' THEN (p_patch->>'opens_at')::timestamptz ELSE registration_opens_at END,
    form_close_date = CASE WHEN p_patch ? 'closes_at' THEN (p_patch->>'closes_at')::timestamptz ELSE form_close_date END,
    collect_payment = CASE WHEN p_patch ? 'collect_payment' THEN coalesce((p_patch->>'collect_payment')::boolean, false) ELSE collect_payment END,
    max_events_per_player = CASE WHEN p_patch ? 'max_events_per_player' THEN nullif((p_patch->>'max_events_per_player')::int, 0) ELSE max_events_per_player END
  WHERE id = p_tournament_id;

  IF p_patch->>'action' IN ('lock_all', 'reopen_all') THEN
    FOREACH v_cat IN ARRAY coalesce(v_t.categories, '{}') LOOP
      IF p_patch->>'action' = 'lock_all' THEN
        PERFORM public.reg_lock_category(p_tournament_id, v_cat);
        v_res := 'locked';
      ELSIF public.registration_category_state(p_tournament_id, v_cat) = 'locked' THEN
        v_res := public.reg_reopen_category(p_tournament_id, v_cat, (p_patch->>'closes_at')::timestamptz);
      ELSE
        v_res := 'unchanged';
      END IF;
      v_out := v_out || jsonb_build_object(v_cat, v_res);
    END LOOP;
  END IF;
  PERFORM public.reg_log_event(p_tournament_id, NULL, NULL, 'timeline', '{}', NULL, p_patch, false);
  RETURN jsonb_build_object('status', 'saved', 'categories', v_out);
END
$$;

-- ------------------------------------------------------- organiser entries --
-- Add (p_participant_id null) or edit an entry. Works after the lock. Taken
-- players are reported as warnings, not refused.
CREATE OR REPLACE FUNCTION public.organiser_save_entry(
  p_tournament_id uuid, p_category text, p_participant_id uuid,
  p_player_id uuid, p_partner_id uuid, p_guest_partner jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_old public.tournament_participants%ROWTYPE;
  v_partner uuid := p_partner_id;
  v_row uuid := p_participant_id;
  v_warn jsonb := '[]'::jsonb;
  v_id uuid;
  v_other uuid;
  v_phone text;
BEGIN
  PERFORM public.reg_require_organiser(p_tournament_id);
  IF NOT (p_category = ANY (coalesce(v_t.categories, '{}'))) THEN
    RETURN jsonb_build_object('status', 'refused', 'reason', 'unknown_category');
  END IF;
  IF p_player_id IS NULL THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'player_required'); END IF;
  PERFORM public.reg_lock(p_tournament_id);

  IF v_row IS NOT NULL THEN
    SELECT * INTO v_old FROM public.tournament_participants WHERE id = v_row AND tournament_id = p_tournament_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'not_found'); END IF;
  END IF;

  IF jsonb_typeof(p_guest_partner) = 'object' AND nullif(btrim(p_guest_partner->>'name'), '') IS NOT NULL THEN
    v_partner := gen_random_uuid();
    INSERT INTO public.players (id, full_name, is_guest, department)
    VALUES (v_partner, left(btrim(p_guest_partner->>'name'), 80), true, 'Guest');
    v_phone := nullif(left(btrim(coalesce(p_guest_partner->>'phone', '')), 20), '');
  END IF;
  IF NOT public.reg_is_doubles(p_category) THEN v_partner := NULL; END IF;
  IF v_partner = p_player_id THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'self'); END IF;

  -- Warnings: taken elsewhere in the category, gender, events limit.
  FOREACH v_id IN ARRAY array_remove(ARRAY[p_player_id, v_partner], NULL) LOOP
    SELECT CASE WHEN tp.player_id = v_id THEN tp.partner_id ELSE tp.player_id END INTO v_other
      FROM public.tournament_participants tp
     WHERE tp.tournament_id = p_tournament_id AND tp.category = p_category AND v_id IN (tp.player_id, tp.partner_id)
       AND (v_row IS NULL OR tp.id <> v_row)
     LIMIT 1;
    IF FOUND THEN
      v_warn := v_warn || jsonb_build_object('kind', 'taken', 'player_id', v_id, 'player_name', public.reg_player_name(v_id),
                                             'with_name', public.reg_player_name(v_other));
    END IF;
  END LOOP;
  IF public.reg_gender_check(p_category, (SELECT gender FROM public.players WHERE id = p_player_id),
       (SELECT gender FROM public.players WHERE id = v_partner), v_partner IS NULL, v_t.ignore_gender_rules) = 'mismatch' THEN
    v_warn := v_warn || '{"kind":"gender"}'::jsonb;
  END IF;
  IF cardinality(public.reg_over_events_limit(p_tournament_id, p_category, array_remove(ARRAY[p_player_id, v_partner], NULL))) > 0 THEN
    v_warn := v_warn || '{"kind":"events_limit"}'::jsonb;
  END IF;

  IF v_row IS NULL THEN
    v_row := public.reg_insert_entry(p_tournament_id, p_category, p_player_id, v_partner, 'organiser', false);
  ELSE
    PERFORM public.reg_set_row(v_row, p_player_id, v_partner);
  END IF;
  IF v_phone IS NOT NULL THEN
    INSERT INTO public.tournament_entry_contacts (participant_id, partner_guest_phone) VALUES (v_row, v_phone)
    ON CONFLICT (participant_id) DO UPDATE SET partner_guest_phone = EXCLUDED.partner_guest_phone, updated_at = now();
  END IF;

  -- Tell everyone on the row now, and anyone removed from it.
  FOREACH v_id IN ARRAY array_remove(ARRAY[p_player_id, v_partner], NULL) LOOP
    PERFORM public.enqueue_registration_notice(v_id, 'entry_changed_by_organiser', p_tournament_id, p_category,
      jsonb_build_object('action', CASE WHEN p_participant_id IS NULL THEN 'added' ELSE 'changed' END,
                         'partner_name', public.reg_player_name(CASE WHEN v_id = p_player_id THEN v_partner ELSE p_player_id END)));
  END LOOP;
  IF p_participant_id IS NOT NULL THEN
    FOREACH v_id IN ARRAY array_remove(ARRAY[v_old.player_id, v_old.partner_id], NULL) LOOP
      CONTINUE WHEN v_id IN (p_player_id, coalesce(v_partner, p_player_id));
      PERFORM public.enqueue_registration_notice(v_id, 'entry_changed_by_organiser', p_tournament_id, p_category,
        jsonb_build_object('action', 'removed'));
    END LOOP;
  END IF;
  PERFORM public.reg_log_event(p_tournament_id, p_category, v_row,
    CASE WHEN p_participant_id IS NULL THEN 'entered' ELSE 'changed' END,
    ARRAY[p_player_id, v_partner, v_old.player_id, v_old.partner_id],
    CASE WHEN p_participant_id IS NOT NULL THEN public.reg_row_json(v_old.player_id, v_old.partner_id) END,
    public.reg_row_json(p_player_id, v_partner) || '{"by":"organiser"}'::jsonb, true);
  RETURN jsonb_build_object('status', 'saved', 'participant_id', v_row, 'warnings', v_warn);
END
$$;

-- Remove an entry. Open category: the waitlist moves up as usual. Locked: only
-- when p_move_up (the organiser's separate "Move up the next waitlisted pair").
CREATE OR REPLACE FUNCTION public.organiser_remove_entry(p_participant_id uuid, p_move_up boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.tournament_participants%ROWTYPE;
  v_id uuid;
  v_moved int := 0;
BEGIN
  SELECT * INTO v_row FROM public.tournament_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'not_found'); END IF;
  PERFORM public.reg_require_tournament(v_row.tournament_id);
  PERFORM public.reg_require_organiser(v_row.tournament_id);
  PERFORM public.reg_lock(v_row.tournament_id);
  DELETE FROM public.tournament_participants WHERE id = p_participant_id;
  FOREACH v_id IN ARRAY array_remove(ARRAY[v_row.player_id, v_row.partner_id], NULL) LOOP
    PERFORM public.enqueue_registration_notice(v_id, 'entry_changed_by_organiser', v_row.tournament_id, v_row.category,
      jsonb_build_object('action', 'removed'));
  END LOOP;
  PERFORM public.reg_log_event(v_row.tournament_id, v_row.category, v_row.id, 'withdrawn',
    ARRAY[v_row.player_id, v_row.partner_id], public.reg_row_json(v_row.player_id, v_row.partner_id),
    '{"by":"organiser"}'::jsonb, true);
  v_moved := public.reg_promote_waitlist(v_row.tournament_id, v_row.category);
  IF v_moved = 0 AND p_move_up THEN
    v_moved := public.reg_promote_waitlist(v_row.tournament_id, v_row.category, true);
  END IF;
  RETURN jsonb_build_object('status', 'removed', 'moved_up', v_moved);
END
$$;

CREATE OR REPLACE FUNCTION public.promote_from_waitlist(p_tournament_id uuid, p_category text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.reg_require_tournament(p_tournament_id);
  PERFORM public.reg_require_organiser(p_tournament_id);
  PERFORM public.reg_lock(p_tournament_id);
  RETURN jsonb_build_object('moved_up', public.reg_promote_waitlist(p_tournament_id, p_category, true));
END
$$;

-- --------------------------------------------------------------- attention --
-- Twin of entriesNeedingAttention() (client/src/lib/registration/attention.ts).
CREATE OR REPLACE FUNCTION public.reg_attention(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH t AS (SELECT * FROM public.tournaments WHERE id = p_tournament_id),
  rows AS (
    SELECT tp.*, pp.gender AS g1, pq.gender AS g2, pq.is_guest AS partner_guest
      FROM public.tournament_participants tp
      LEFT JOIN public.players pp ON pp.id = tp.player_id
      LEFT JOIN public.players pq ON pq.id = tp.partner_id
     WHERE tp.tournament_id = p_tournament_id),
  members AS (
    SELECT r.category, r.id AS row_id, m.pid,
           CASE WHEN m.pid = r.player_id THEN r.partner_id ELSE r.player_id END AS other_id, r.created_at
      FROM rows r CROSS JOIN LATERAL (VALUES (r.player_id), (r.partner_id)) m(pid)
     WHERE m.pid IS NOT NULL),
  shared AS (
    SELECT category, pid, array_agg(row_id ORDER BY created_at, row_id) AS row_ids,
           array_agg(other_id ORDER BY created_at, row_id) AS other_ids
      FROM members GROUP BY category, pid HAVING count(*) > 1)
  SELECT jsonb_build_object(
    'noPartner', coalesce((SELECT jsonb_agg(jsonb_build_object('row_id', r.id, 'category', r.category,
                    'player_id', r.player_id, 'looking', r.looking_for_partner) ORDER BY r.category, r.created_at)
                  FROM rows r WHERE public.reg_is_doubles(r.category) AND r.player_id IS NOT NULL AND r.partner_id IS NULL), '[]'),
    'sharedPartner', coalesce((SELECT jsonb_agg(jsonb_build_object('category', s.category, 'shared_player_id', s.pid,
                    'row_ids', to_jsonb(s.row_ids), 'other_player_ids', to_jsonb(s.other_ids)) ORDER BY s.category, s.pid)
                  FROM shared s), '[]'),
    'partnerNotOnApp', coalesce((SELECT jsonb_agg(jsonb_build_object('row_id', r.id, 'category', r.category, 'partner_id', r.partner_id))
                  FROM rows r WHERE r.partner_guest), '[]'),
    'genderMismatch', coalesce((SELECT jsonb_agg(jsonb_build_object('row_id', r.id, 'category', r.category))
                  FROM rows r, t
                 WHERE r.player_id IS NOT NULL
                   AND public.reg_gender_check(r.category, r.g1, r.g2, r.partner_id IS NULL, t.ignore_gender_rules) = 'mismatch'), '[]'),
    'genderUnknown', coalesce((SELECT jsonb_agg(jsonb_build_object('row_id', r.id, 'category', r.category))
                  FROM rows r, t
                 WHERE r.player_id IS NOT NULL
                   AND public.reg_gender_check(r.category, r.g1, r.g2, r.partner_id IS NULL, t.ignore_gender_rules) = 'unknown'), '[]'))
$$;

CREATE OR REPLACE FUNCTION public.registration_attention(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.reg_require_organiser(p_tournament_id);
  RETURN public.reg_attention(p_tournament_id);
END
$$;

-- Shared-partner conflicts with names, for the duplicates banner.
CREATE OR REPLACE FUNCTION public.tournament_partner_conflicts(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.reg_require_organiser(p_tournament_id);
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'category', s->>'category',
             'shared_player_id', s->>'shared_player_id',
             'shared_name', public.reg_player_name((s->>'shared_player_id')::uuid),
             'row_ids', s->'row_ids',
             'other_names', (SELECT jsonb_agg(public.reg_player_name(o::uuid)) FROM jsonb_array_elements_text(s->'other_player_ids') o),
             'first_seen_at', (SELECT c.first_seen_at FROM public.tournament_registration_conflicts c
                                WHERE c.tournament_id = p_tournament_id AND c.category = s->>'category'
                                  AND c.shared_player_id = (s->>'shared_player_id')::uuid AND c.resolved_at IS NULL)))
      FROM jsonb_array_elements(public.reg_attention(p_tournament_id)->'sharedPartner') s), '[]'::jsonb);
END
$$;

-- -------------------------------------------------------- conflict trigger --
-- A player in two rows of one category (organiser edit, form import) is
-- recorded once and the hosts get ONE duplicate_found per new conflict.
CREATE OR REPLACE FUNCTION public.reg_conflict_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t uuid := coalesce(NEW.tournament_id, OLD.tournament_id);
  v_pid uuid;
  v_cat text;
  v_n int;
  v_new uuid;
  v_host uuid;
BEGIN
  IF NOT public.registration_flag_on(v_t) THEN RETURN NULL; END IF;
  BEGIN
    FOR v_cat, v_pid IN
      SELECT DISTINCT x.cat, x.pid FROM (VALUES
        (CASE WHEN TG_OP <> 'DELETE' THEN NEW.category END, CASE WHEN TG_OP <> 'DELETE' THEN NEW.player_id END),
        (CASE WHEN TG_OP <> 'DELETE' THEN NEW.category END, CASE WHEN TG_OP <> 'DELETE' THEN NEW.partner_id END),
        (CASE WHEN TG_OP <> 'INSERT' THEN OLD.category END, CASE WHEN TG_OP <> 'INSERT' THEN OLD.player_id END),
        (CASE WHEN TG_OP <> 'INSERT' THEN OLD.category END, CASE WHEN TG_OP <> 'INSERT' THEN OLD.partner_id END)) x(cat, pid)
       WHERE x.pid IS NOT NULL AND x.cat IS NOT NULL
    LOOP
      SELECT count(*) INTO v_n FROM public.tournament_participants
       WHERE tournament_id = v_t AND category = v_cat AND v_pid IN (player_id, partner_id);
      IF v_n >= 2 THEN
        v_new := NULL;
        INSERT INTO public.tournament_registration_conflicts (tournament_id, category, shared_player_id)
        VALUES (v_t, v_cat, v_pid)
        ON CONFLICT (tournament_id, category, shared_player_id) WHERE resolved_at IS NULL DO NOTHING
        RETURNING id INTO v_new;
        IF v_new IS NOT NULL THEN
          FOREACH v_host IN ARRAY public.registration_host_ids(v_t) LOOP
            PERFORM public.enqueue_registration_notice(v_host, 'duplicate_found', v_t, v_cat,
              jsonb_build_object('other_name', public.reg_player_name(v_pid),
                'pair_names', (SELECT jsonb_agg(public.reg_player_name(CASE WHEN tp.player_id = v_pid THEN tp.partner_id ELSE tp.player_id END)
                                                ORDER BY tp.created_at)
                                 FROM public.tournament_participants tp
                                WHERE tp.tournament_id = v_t AND tp.category = v_cat AND v_pid IN (tp.player_id, tp.partner_id))),
              true);
          END LOOP;
        END IF;
      ELSE
        UPDATE public.tournament_registration_conflicts SET resolved_at = now()
         WHERE tournament_id = v_t AND category = v_cat AND shared_player_id = v_pid AND resolved_at IS NULL;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reg_conflict_trigger failed: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS tournament_participants_registration_conflicts ON public.tournament_participants;
CREATE TRIGGER tournament_participants_registration_conflicts
  AFTER INSERT OR DELETE OR UPDATE OF player_id, partner_id, category ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.reg_conflict_trigger();

-- ---------------------------------------------------------------- reminders --
-- Queue incomplete_entry_* reminders for one category. Shared by the manual
-- button and the automatic 24 h reminder. 12 h cooldown per player per
-- category across both. Returns {reminded, skipped[], no_email, capped}.
CREATE OR REPLACE FUNCTION public.reg_queue_reminders(
  p_tournament_id uuid, p_category text, p_kind text, p_player_ids uuid[], p_note text,
  p_notice text, p_limit int, p_auto_deadline timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_att jsonb := public.reg_attention(p_tournament_id);
  v_deadline timestamptz := public.reg_category_deadline(p_tournament_id, p_category);
  rec record;
  v_reminded int := 0;
  v_no_email int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_capped boolean := false;
BEGIN
  FOR rec IN
    WITH aud AS (
      -- no partner
      SELECT (n->>'player_id')::uuid AS pid, 'no_partner' AS reason, (n->>'looking')::boolean AS looking,
             NULL::text AS partner_name, NULL::text AS other_name, NULL::jsonb AS pair_names
        FROM jsonb_array_elements(v_att->'noPartner') n
       WHERE n->>'category' = p_category AND p_kind IN ('no_partner', 'all_incomplete', 'auto')
      UNION ALL
      -- the shared player
      SELECT (s->>'shared_player_id')::uuid, 'shared_player', NULL, NULL, NULL,
             (SELECT jsonb_agg(public.reg_player_name(o::uuid)) FROM jsonb_array_elements_text(s->'other_player_ids') o)
        FROM jsonb_array_elements(v_att->'sharedPartner') s
       WHERE s->>'category' = p_category AND p_kind IN ('shared_partner', 'all_incomplete')
      UNION ALL
      -- each other member: "Your partner C is also entered with B"
      SELECT o.pid, 'shared_pair', NULL, public.reg_player_name((s->>'shared_player_id')::uuid),
             (SELECT string_agg(public.reg_player_name(x::uuid), ', ')
                FROM jsonb_array_elements_text(s->'other_player_ids') x WHERE x::uuid <> o.pid),
             NULL
        FROM jsonb_array_elements(v_att->'sharedPartner') s
        CROSS JOIN LATERAL (SELECT x::uuid AS pid FROM jsonb_array_elements_text(s->'other_player_ids') x WHERE x IS NOT NULL) o
       WHERE s->>'category' = p_category AND p_kind IN ('shared_partner', 'all_incomplete')
      UNION ALL
      -- automatic only: players with an open partner request
      SELECT pr.to_player_id, 'open_request', NULL, NULL, NULL, NULL
        FROM public.tournament_partner_requests pr
       WHERE pr.tournament_id = p_tournament_id AND pr.category = p_category AND pr.status = 'pending'
         AND p_kind = 'auto')
    SELECT DISTINCT ON (a.pid) a.*, p.is_guest, p.full_name,
           (nullif(btrim(coalesce(p.email, '')), '') IS NULL AND nullif(btrim(coalesce(p.iisc_email, '')), '') IS NULL) AS no_email
      FROM aud a JOIN public.players p ON p.id = a.pid
     WHERE (p_player_ids IS NULL OR a.pid = ANY (p_player_ids))
       AND p.deleted_at IS NULL
     ORDER BY a.pid, CASE a.reason WHEN 'shared_player' THEN 0 WHEN 'shared_pair' THEN 1 ELSE 2 END
  LOOP
    IF rec.is_guest THEN
      v_skipped := v_skipped || jsonb_build_object('player_id', rec.pid, 'name', rec.full_name, 'reason', 'not_on_app',
        'payload', jsonb_build_object('kind', 'incomplete_entry_manual', 'category', p_category, 'reason', rec.reason,
          'deadline', v_deadline, 'partner_name', rec.partner_name, 'other_name', rec.other_name, 'pair_names', rec.pair_names));
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.tournament_entry_events e
                WHERE e.tournament_id = p_tournament_id AND e.category = p_category AND e.action = 'reminder_sent'
                  AND rec.pid = ANY (e.player_ids) AND e.created_at > now() - interval '12 hours') THEN
      v_skipped := v_skipped || jsonb_build_object('player_id', rec.pid, 'name', rec.full_name, 'reason', 'reminded_recently',
        'last_at', (SELECT max(e.created_at) FROM public.tournament_entry_events e
                     WHERE e.tournament_id = p_tournament_id AND e.category = p_category AND e.action = 'reminder_sent'
                       AND rec.pid = ANY (e.player_ids)));
      CONTINUE;
    END IF;
    IF p_auto_deadline IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.tournament_entry_events e
          WHERE e.tournament_id = p_tournament_id AND e.category = p_category AND e.action = 'reminder_sent'
            AND rec.pid = ANY (e.player_ids) AND (e.after->>'auto_deadline')::timestamptz = p_auto_deadline) THEN
      CONTINUE;  -- one automatic reminder per deadline
    END IF;
    IF v_reminded >= p_limit THEN v_capped := true; EXIT; END IF;

    PERFORM public.enqueue_registration_notice(rec.pid, p_notice, p_tournament_id, p_category,
      jsonb_build_object('reason', rec.reason, 'looking', rec.looking, 'deadline', v_deadline,
                         'partner_name', rec.partner_name, 'other_name', rec.other_name, 'pair_names', rec.pair_names,
                         'note', nullif(left(btrim(coalesce(p_note, '')), 200), '')),
      true);
    PERFORM public.reg_log_event(p_tournament_id, p_category, NULL, 'reminder_sent', ARRAY[rec.pid], NULL,
      jsonb_build_object('reason', rec.reason, 'auto', p_auto_deadline IS NOT NULL, 'auto_deadline', p_auto_deadline), false);
    v_reminded := v_reminded + 1;
    IF rec.no_email THEN v_no_email := v_no_email + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('reminded', v_reminded, 'skipped', v_skipped, 'no_email', v_no_email, 'capped', v_capped);
END
$$;

-- Manual reminder button. p_kind: no_partner | shared_partner | all_incomplete.
-- The audience is recomputed here; p_player_ids only narrows it.
CREATE OR REPLACE FUNCTION public.send_entry_reminders(
  p_tournament_id uuid, p_category text DEFAULT NULL, p_kind text DEFAULT 'all_incomplete',
  p_player_ids uuid[] DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_t public.tournaments := public.reg_require_tournament(p_tournament_id);
  v_cat text;
  v_res jsonb;
  v_reminded int := 0;
  v_no_email int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_refused jsonb := '[]'::jsonb;
  v_capped boolean := false;
BEGIN
  PERFORM public.reg_require_organiser(p_tournament_id);
  IF p_kind NOT IN ('no_partner', 'shared_partner', 'all_incomplete') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'registration_bad_input: unknown reminder kind';
  END IF;
  IF length(coalesce(p_note, '')) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'registration_bad_input: note is longer than 200 characters';
  END IF;
  PERFORM public.reg_lock(p_tournament_id);
  FOREACH v_cat IN ARRAY coalesce(v_t.categories, '{}') LOOP
    CONTINUE WHEN p_category IS NOT NULL AND v_cat <> p_category;
    IF public.registration_category_state(p_tournament_id, v_cat) NOT IN ('open', 'closing_soon') THEN
      IF p_category IS NOT NULL THEN
        v_refused := v_refused || to_jsonb(v_cat);
      END IF;
      CONTINUE;
    END IF;
    v_res := public.reg_queue_reminders(p_tournament_id, v_cat, p_kind, p_player_ids, p_note,
                                        'incomplete_entry_manual', 200 - v_reminded);
    v_reminded := v_reminded + (v_res->>'reminded')::int;
    v_no_email := v_no_email + (v_res->>'no_email')::int;
    v_skipped := v_skipped || (SELECT coalesce(jsonb_agg(s || jsonb_build_object('category', v_cat)), '[]') FROM jsonb_array_elements(v_res->'skipped') s);
    v_capped := v_capped OR (v_res->>'capped')::boolean;
  END LOOP;
  RETURN jsonb_build_object('reminded', v_reminded, 'skipped', v_skipped, 'no_email', v_no_email,
                            'refused_categories', v_refused, 'capped', v_capped);
END
$$;

-- ------------------------------------------------------ late withdrawals --
-- p_action: remove (before the draw) | walkover (after the draw) | dismiss.
CREATE OR REPLACE FUNCTION public.resolve_withdrawal_request(p_request_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.tournament_withdrawal_requests%ROWTYPE;
  v_row public.tournament_participants%ROWTYPE;
  m public.tournament_matches%ROWTYPE;
  v_side smallint;
  v_opp_known boolean;
  v_id uuid;
BEGIN
  SELECT * INTO r FROM public.tournament_withdrawal_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'not_found'); END IF;
  PERFORM public.reg_require_organiser(r.tournament_id);
  PERFORM public.reg_lock(r.tournament_id);
  SELECT * INTO r FROM public.tournament_withdrawal_requests WHERE id = p_request_id;
  IF r.status NOT IN ('pending', 'waiting_opponent') THEN RETURN jsonb_build_object('status', r.status); END IF;

  IF p_action = 'dismiss' THEN
    UPDATE public.tournament_withdrawal_requests SET status = 'dismissed', resolved_at = now(), resolved_by = public.resolve_my_player_id()
     WHERE id = r.id;
    RETURN jsonb_build_object('status', 'dismissed');
  END IF;

  IF p_action = 'remove' THEN
    IF public.reg_category_has_draw(r.tournament_id, r.category) THEN
      RETURN jsonb_build_object('status', 'refused', 'reason', 'draw_exists');
    END IF;
    SELECT * INTO v_row FROM public.tournament_participants WHERE id = r.participant_id;
    IF FOUND THEN
      DELETE FROM public.tournament_participants WHERE id = v_row.id;
      PERFORM public.reg_log_event(r.tournament_id, r.category, v_row.id, 'withdrawn', r.player_ids,
        public.reg_row_json(v_row.player_id, v_row.partner_id), '{"by":"organiser","late":true}'::jsonb, true);
    END IF;
    UPDATE public.tournament_withdrawal_requests SET status = 'removed', resolved_at = now(), resolved_by = public.resolve_my_player_id()
     WHERE id = r.id;
    FOREACH v_id IN ARRAY r.player_ids LOOP
      PERFORM public.enqueue_registration_notice(v_id, 'withdrawal_done', r.tournament_id, r.category,
        jsonb_build_object('action', 'removed'), true);
    END LOOP;
    RETURN jsonb_build_object('status', 'removed');
  END IF;

  IF p_action <> 'walkover' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'registration_bad_input: unknown action';
  END IF;

  -- The pair's next unplayed match in this category.
  SELECT * INTO m FROM public.tournament_matches tm
   WHERE tm.tournament_id = r.tournament_id AND upper(btrim(tm.category)) = upper(btrim(r.category))
     AND tm.status NOT IN ('completed', 'walkover', 'cancelled')
     AND (ARRAY[tm.player1_id, tm.player3_id, tm.player2_id, tm.player4_id] && r.player_ids)
   ORDER BY tm.round NULLS LAST, tm.match_number NULLS LAST
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'refused', 'reason', 'no_match'); END IF;
  v_side := CASE WHEN ARRAY[m.player1_id, m.player3_id] && r.player_ids THEN 1 ELSE 2 END;
  v_opp_known := CASE WHEN v_side = 1
    THEN m.player2_id IS NOT NULL OR m.player4_id IS NOT NULL
    ELSE m.player1_id IS NOT NULL OR m.player3_id IS NOT NULL END;
  IF NOT v_opp_known THEN
    UPDATE public.tournament_withdrawal_requests SET status = 'waiting_opponent' WHERE id = r.id;
    RETURN jsonb_build_object('status', 'waiting_opponent', 'match_id', m.id);
  END IF;

  -- Same result write as record_tournament_walkover (whose own check admits
  -- only umpires/admins): winner_side, W/O score, no sets, then advance.
  UPDATE public.tournament_matches SET
    winner_side  = CASE WHEN v_side = 1 THEN 2 ELSE 1 END,
    winner_id    = CASE WHEN v_side = 1 THEN m.player2_id ELSE m.player1_id END,
    score        = 'W/O',
    sets_history = NULL,
    status       = 'walkover',
    scored_by    = auth.uid(),
    scored_at    = now(),
    ended_at     = now()
  WHERE id = m.id;
  PERFORM public.advance_tournament_winner(m.id);

  UPDATE public.tournament_withdrawal_requests SET status = 'walkover', resolved_at = now(), resolved_by = public.resolve_my_player_id()
   WHERE id = r.id;
  FOREACH v_id IN ARRAY r.player_ids LOOP
    PERFORM public.enqueue_registration_notice(v_id, 'withdrawal_done', r.tournament_id, r.category,
      jsonb_build_object('action', 'walkover'), true);
  END LOOP;
  PERFORM public.reg_log_event(r.tournament_id, r.category, r.participant_id, 'walkover', r.player_ids, NULL,
    jsonb_build_object('match_id', m.id), false);
  RETURN jsonb_build_object('status', 'walkover', 'match_id', m.id);
END
$$;

-- --------------------------------------------------------- viewer counts --
-- Waitlist counts for the Players tab (viewers may be signed out). Only
-- tournaments the caller can see; counts only.
CREATE OR REPLACE FUNCTION public.registration_waitlist_counts(p_tournament_id uuid)
RETURNS TABLE (category text, waiting integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT w.category, count(*)::int
    FROM public.tournament_waitlist w
    JOIN public.tournaments t ON t.id = w.tournament_id
   WHERE w.tournament_id = p_tournament_id
     AND (t.status NOT IN ('draft', 'deleted') OR public.is_tournament_official(t.id))
   GROUP BY w.category
$$;

-- -------------------------------------------------------- cron bodies --
-- 24 h before each category deadline: incomplete_entry_auto to players with no
-- partner and players with an open request (cooldown + once per deadline).
CREATE OR REPLACE FUNCTION public.queue_registration_deadline_reminders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v record;
  v_res jsonb;
  v_total int := 0;
BEGIN
  FOR v IN
    SELECT t.id, c.cat
      FROM public.tournaments t CROSS JOIN LATERAL unnest(coalesce(t.categories, '{}')) c(cat)
     WHERE t.require_app_registration AND coalesce(t.auto_reminders_enabled, false)
       AND upper(coalesce(t.format_family, '')) <> 'TEAM' AND t.status IN ('upcoming', 'active')
  LOOP
    CONTINUE WHEN public.registration_category_state(v.id, v.cat) <> 'closing_soon';
    v_res := public.reg_queue_reminders(v.id, v.cat, 'auto', NULL, NULL, 'incomplete_entry_auto', 200,
                                        public.reg_category_deadline(v.id, v.cat));
    v_total := v_total + (v_res->>'reminded')::int;
  END LOOP;
  RETURN v_total;
END
$$;

-- 8 PM IST: one daily_summary per host/organiser while any category is open,
-- skipped when nothing changed in the last 24 hours.
-- Daily CSV digest of the day's entry changes to the club inbox (backup copy).
-- Queued for today's IST date when any registration tournament changed in the
-- last 24 h; independent of auto reminders. Idempotent per day.
CREATE OR REPLACE FUNCTION public.queue_registration_backup_digest()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_backup_outbox o
     WHERE o.created_at > now() - interval '24 hours') THEN
    RETURN 0;
  END IF;
  INSERT INTO public.tournament_backup_digests (digest_date)
  VALUES ((now() AT TIME ZONE 'Asia/Kolkata')::date)
  ON CONFLICT (digest_date) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$$;

CREATE OR REPLACE FUNCTION public.queue_registration_daily_summary()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v record;
  v_host uuid;
  v_att jsonb;
  v_sent int := 0;
BEGIN
  FOR v IN
    SELECT t.id,
           (SELECT count(*) FROM public.tournament_participants tp WHERE tp.tournament_id = t.id) AS entries,
           (SELECT count(*) FROM public.tournament_entry_events e
             WHERE e.tournament_id = t.id AND e.action IN ('entered', 'waitlisted', 'promoted')
               AND e.created_at > now() - interval '24 hours') AS new_entries,
           (SELECT count(*) FROM public.tournament_entry_events e
             WHERE e.tournament_id = t.id AND e.action NOT IN ('reminder_sent')
               AND e.created_at > now() - interval '24 hours') AS changes
      FROM public.tournaments t
     WHERE t.require_app_registration AND coalesce(t.auto_reminders_enabled, false)
       AND upper(coalesce(t.format_family, '')) <> 'TEAM' AND t.status IN ('upcoming', 'active')
       AND EXISTS (SELECT 1 FROM unnest(coalesce(t.categories, '{}')) c(cat)
                    WHERE public.registration_category_state(t.id, c.cat) IN ('open', 'closing_soon'))
  LOOP
    CONTINUE WHEN v.changes = 0;
    v_att := public.reg_attention(v.id);
    FOREACH v_host IN ARRAY public.registration_host_ids(v.id) LOOP
      PERFORM public.enqueue_registration_notice(v_host, 'daily_summary', v.id, NULL,
        jsonb_build_object('summary', jsonb_build_object(
          'entries', v.entries, 'new_entries', v.new_entries,
          'no_partner', jsonb_array_length(v_att->'noPartner'),
          'shared', jsonb_array_length(v_att->'sharedPartner'))), true);
      v_sent := v_sent + 1;
    END LOOP;
  END LOOP;
  RETURN v_sent;
END
$$;

-- --------------------------------------------------------------- grants --
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.reg_require_organiser(uuid)',
    'public.reg_category_deadline(uuid, text)',
    'public.reg_lock_category(uuid, text)',
    'public.reg_reopen_category(uuid, text, timestamptz)',
    'public.set_category_lock(uuid, text, boolean, timestamptz)',
    'public.set_category_settings(uuid, text, jsonb)',
    'public.set_registration_timeline(uuid, jsonb)',
    'public.organiser_save_entry(uuid, text, uuid, uuid, uuid, jsonb)',
    'public.organiser_remove_entry(uuid, boolean)',
    'public.promote_from_waitlist(uuid, text)',
    'public.reg_attention(uuid)',
    'public.registration_attention(uuid)',
    'public.tournament_partner_conflicts(uuid)',
    'public.reg_conflict_trigger()',
    'public.reg_queue_reminders(uuid, text, text, uuid[], text, text, integer, timestamptz)',
    'public.send_entry_reminders(uuid, text, text, uuid[], text)',
    'public.resolve_withdrawal_request(uuid, text)',
    'public.registration_waitlist_counts(uuid)',
    'public.queue_registration_deadline_reminders()',
    'public.queue_registration_daily_summary()',
    'public.queue_registration_backup_digest()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.set_category_lock(uuid, text, boolean, timestamptz)',
    'public.set_category_settings(uuid, text, jsonb)',
    'public.set_registration_timeline(uuid, jsonb)',
    'public.organiser_save_entry(uuid, text, uuid, uuid, uuid, jsonb)',
    'public.organiser_remove_entry(uuid, boolean)',
    'public.promote_from_waitlist(uuid, text)',
    'public.registration_attention(uuid)',
    'public.tournament_partner_conflicts(uuid)',
    'public.send_entry_reminders(uuid, text, text, uuid[], text)',
    'public.resolve_withdrawal_request(uuid, text)',
    'public.registration_waitlist_counts(uuid)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  -- The Players tab shows waitlist counts to signed-out viewers too (counts only).
  GRANT EXECUTE ON FUNCTION public.registration_waitlist_counts(uuid) TO anon;
END $$;
