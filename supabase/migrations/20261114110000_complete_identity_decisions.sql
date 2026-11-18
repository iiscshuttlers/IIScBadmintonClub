-- WP8 follow-up: notify claim requesters and close the registration-review
-- privilege gap found during the contact-field audit.

CREATE OR REPLACE FUNCTION public.notify_player_claim_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, is_read)
    VALUES (
      NEW.requester_id,
      CASE WHEN NEW.status = 'approved' THEN 'Player record linked' ELSE 'Player claim reviewed' END,
      CASE
        WHEN NEW.status = 'approved' THEN 'Your player-record claim was approved. Your match history is now linked to your profile.'
        ELSE 'Your player-record claim was not approved. Open the claim record to review the administrator note.'
      END,
      'player_claim_' || NEW.status,
      CASE WHEN NEW.status = 'approved'
        THEN '/player/' || NEW.requester_id::text
        ELSE '/player/' || NEW.guest_id::text
      END,
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS player_claim_decision_notification ON public.player_claim_requests;
CREATE TRIGGER player_claim_decision_notification
AFTER UPDATE OF status ON public.player_claim_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_player_claim_decision();

REVOKE ALL ON FUNCTION public.notify_player_claim_decision() FROM PUBLIC, anon, authenticated;

-- A registrant may edit their own pending form or withdraw it, but cannot
-- self-approve, self-reject, or forge review metadata. Officials retain the
-- review path. Contact fields remain row-private to the registrant and that
-- tournament's authorized officials through RLS.
DROP POLICY IF EXISTS "tournament_registrations_update" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_update" ON public.tournament_registrations
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_master()
    OR public.is_tournament_official(tournament_id)
    OR (player_id = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    public.is_admin_or_master()
    OR public.is_tournament_official(tournament_id)
    OR (
      player_id = auth.uid()
      AND status IN ('pending', 'withdrawn')
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
    )
  );

COMMENT ON POLICY "tournament_registrations_update" ON public.tournament_registrations
IS 'Registrants may edit or withdraw only their own pending form; only admins and tournament officials may set review outcomes.';

-- Future merges are reversible because we retain the deleted guest row and
-- the primary-key locator of every reference that moved. Merges created before
-- this ledger exists remain intentionally non-reversible: guessing which rows
-- belonged to the guest would corrupt the surviving member's history.
CREATE TABLE public.player_identity_merge_operations (
  operation_id uuid PRIMARY KEY,
  guest_id uuid NOT NULL,
  target_id uuid NOT NULL,
  guest_snapshot jsonb NOT NULL,
  redirected_aliases uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'reversed')),
  merged_by uuid NOT NULL,
  merged_at timestamptz NOT NULL DEFAULT now(),
  reversed_by uuid,
  reversed_at timestamptz,
  reversal_reason text
);

CREATE TABLE public.player_identity_merge_moves (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES public.player_identity_merge_operations(operation_id) ON DELETE RESTRICT,
  table_name text NOT NULL,
  column_name text NOT NULL,
  row_key jsonb NOT NULL,
  UNIQUE (operation_id, table_name, column_name, row_key)
);

ALTER TABLE public.player_identity_merge_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_identity_merge_moves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_identity_merge_operations, public.player_identity_merge_moves FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.merge_player_identity(
  p_guest_id uuid,
  p_real_id uuid,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.player_identity_merge_operations%ROWTYPE;
  v_preview jsonb;
  v_guest_snapshot jsonb;
  v_redirected_aliases uuid[];
  v_pk_cols text[];
  r record;
  v_moved jsonb := '[]'::jsonb;
  v_count bigint;
  v_email text := NULLIF(auth.jwt()->>'email', '');
BEGIN
  IF public._is_site_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can merge player identities';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A reason is required to merge identities';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'operation_id is required';
  END IF;

  SELECT * INTO v_existing
  FROM public.player_identity_merge_operations
  WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.guest_id = p_guest_id AND v_existing.target_id = p_real_id THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'already_' || v_existing.status,
                                'summary', v_existing.summary);
    END IF;
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'operation_id was already used for a different merge';
  END IF;

  PERFORM 1 FROM public.players WHERE id IN (p_guest_id, p_real_id) ORDER BY id FOR UPDATE;
  v_preview := public.preview_player_merge(p_guest_id, p_real_id);
  IF jsonb_array_length(v_preview->'blockers') > 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'merge_blocked: ' || (SELECT string_agg(b, ', ') FROM jsonb_array_elements_text(v_preview->'blockers') b),
      DETAIL = (v_preview->'conflicts')::text;
  END IF;

  SELECT to_jsonb(p) INTO v_guest_snapshot FROM public.players p WHERE p.id = p_guest_id;
  SELECT COALESCE(array_agg(old_player_id ORDER BY old_player_id), ARRAY[]::uuid[])
  INTO v_redirected_aliases FROM public.player_aliases WHERE player_id = p_guest_id;

  INSERT INTO public.player_identity_merge_operations
    (operation_id, guest_id, target_id, guest_snapshot, redirected_aliases, merged_by)
  VALUES
    (p_operation_id, p_guest_id, p_real_id, v_guest_snapshot, v_redirected_aliases, auth.uid());

  FOR r IN SELECT * FROM public._player_reference_columns() LOOP
    SELECT array_agg(a.attname ORDER BY k.ordinality)
    INTO v_pk_cols
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN unnest(i.indkey) WITH ORDINALITY k(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public' AND c.relname = r.table_name AND i.indisprimary;

    IF COALESCE(cardinality(v_pk_cols), 0) = 0 THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = format('merge_blocked: reference table %I has no primary key for safe reversal', r.table_name);
    END IF;

    EXECUTE format(
      'INSERT INTO public.player_identity_merge_moves (operation_id, table_name, column_name, row_key)
       SELECT $1, %L, %L,
              (SELECT jsonb_object_agg(k, to_jsonb(src)->k) FROM unnest($2::text[]) k)
       FROM public.%I src WHERE %I = $3',
      r.table_name, r.column_name, r.table_name, r.column_name
    ) USING p_operation_id, v_pk_cols, p_guest_id;

    EXECUTE format('UPDATE public.%I SET %I = $2 WHERE %I = $1', r.table_name, r.column_name, r.column_name)
      USING p_guest_id, p_real_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_moved := v_moved || jsonb_build_object('table', r.table_name, 'column', r.column_name, 'rows', v_count);
    END IF;
  END LOOP;

  UPDATE public.player_aliases SET player_id = p_real_id WHERE player_id = p_guest_id;
  INSERT INTO public.player_aliases (old_player_id, player_id, merged_by, reason, operation_id, summary)
  VALUES (p_guest_id, p_real_id, auth.uid(), btrim(p_reason), p_operation_id,
          jsonb_build_object('moved', v_moved, 'guest_name', v_preview->'guest'->>'name',
                             'target_name', v_preview->'target'->>'name'));

  UPDATE public.player_identity_merge_operations
  SET summary = jsonb_build_object('moved', v_moved, 'guest_name', v_preview->'guest'->>'name',
                                   'target_name', v_preview->'target'->>'name')
  WHERE operation_id = p_operation_id;

  DELETE FROM public.players WHERE id = p_guest_id AND is_guest IS TRUE;

  UPDATE public.player_claim_requests
  SET status = 'approved', decided_by = auth.uid(), decided_at = now(),
      decision_note = COALESCE(decision_note, btrim(p_reason))
  WHERE guest_id = p_guest_id AND requester_id = p_real_id AND status = 'pending';
  UPDATE public.player_claim_requests
  SET status = 'rejected', decided_by = auth.uid(), decided_at = now(),
      decision_note = 'Record was merged into another member'
  WHERE guest_id = p_guest_id AND status = 'pending';

  INSERT INTO public.admin_logs (admin_email, action, details, created_at)
  VALUES (COALESCE(v_email, 'admin'), 'player_identity_merge',
          jsonb_build_object('guest_id', p_guest_id, 'real_id', p_real_id, 'reason', btrim(p_reason),
                             'operation_id', p_operation_id, 'moved', v_moved, 'actor_id', auth.uid()), now());

  RETURN jsonb_build_object('applied', true, 'moved', v_moved, 'reversible', true);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_player_identity(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_player_identity(uuid, uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_player_aliases()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.player_merge_reversal', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' OR NEW.old_player_id <> OLD.old_player_id OR NEW.operation_id IS DISTINCT FROM OLD.operation_id
     OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.merged_at <> OLD.merged_at THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'player_aliases history is append-only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_player_identity_merge(
  p_operation_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op public.player_identity_merge_operations%ROWTYPE;
  r record;
  v_count bigint;
  v_restored bigint := 0;
  v_email text := NULLIF(auth.jwt()->>'email', '');
BEGIN
  IF public._is_site_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can reverse identity merges';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A reason is required to reverse an identity merge';
  END IF;

  SELECT * INTO v_op FROM public.player_identity_merge_operations
  WHERE operation_id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002',
      MESSAGE = 'Merge is not reversible because no exact move ledger exists';
  END IF;
  IF v_op.status = 'reversed' THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_reversed');
  END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE id = v_op.guest_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Cannot restore guest: player ID is already in use';
  END IF;

  INSERT INTO public.players
  SELECT (jsonb_populate_record(NULL::public.players, v_op.guest_snapshot)).*;

  FOR r IN
    SELECT table_name, column_name, row_key
    FROM public.player_identity_merge_moves
    WHERE operation_id = p_operation_id ORDER BY id DESC
  LOOP
    EXECUTE format(
      'UPDATE public.%I AS target SET %I = $1
       WHERE %I = $2
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_each($3) keypart
           WHERE to_jsonb(target)->keypart.key IS DISTINCT FROM keypart.value
         )',
      r.table_name, r.column_name, r.column_name
    ) USING v_op.guest_id, v_op.target_id, r.row_key;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = format('merge_reversal_conflict: expected one %I.%I row, restored %s', r.table_name, r.column_name, v_count),
        DETAIL = r.row_key::text;
    END IF;
    v_restored := v_restored + 1;
  END LOOP;

  UPDATE public.player_aliases SET player_id = v_op.guest_id
  WHERE old_player_id = ANY(v_op.redirected_aliases);
  PERFORM set_config('app.player_merge_reversal', 'on', true);
  DELETE FROM public.player_aliases
  WHERE old_player_id = v_op.guest_id AND operation_id = p_operation_id;

  UPDATE public.player_identity_merge_operations
  SET status = 'reversed', reversed_by = auth.uid(), reversed_at = now(), reversal_reason = btrim(p_reason)
  WHERE operation_id = p_operation_id;

  UPDATE public.player_claim_requests
  SET status = 'rejected', decided_by = auth.uid(), decided_at = now(),
      decision_note = concat_ws(' ', decision_note, '[Merge reversed: ' || btrim(p_reason) || ']')
  WHERE guest_id = v_op.guest_id AND requester_id = v_op.target_id AND status = 'approved';

  INSERT INTO public.admin_logs (admin_email, action, details, created_at)
  VALUES (COALESCE(v_email, 'admin'), 'player_identity_merge_reversed',
          jsonb_build_object('operation_id', p_operation_id, 'guest_id', v_op.guest_id,
                             'target_id', v_op.target_id, 'reason', btrim(p_reason),
                             'restored_references', v_restored, 'actor_id', auth.uid()), now());

  RETURN jsonb_build_object('applied', true, 'restored_references', v_restored, 'guest_id', v_op.guest_id);
END;
$$;
REVOKE ALL ON FUNCTION public.reverse_player_identity_merge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_player_identity_merge(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_reversible_player_merges()
RETURNS TABLE (
  operation_id uuid,
  guest_id uuid,
  target_id uuid,
  guest_name text,
  target_name text,
  merged_at timestamptz,
  summary jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public._is_site_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can review identity merges';
  END IF;
  RETURN QUERY
    SELECT o.operation_id, o.guest_id, o.target_id,
           o.guest_snapshot->>'full_name', p.full_name, o.merged_at, o.summary
    FROM public.player_identity_merge_operations o
    LEFT JOIN public.players p ON p.id = o.target_id
    WHERE o.status = 'applied'
    ORDER BY o.merged_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_reversible_player_merges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_reversible_player_merges() TO authenticated;
