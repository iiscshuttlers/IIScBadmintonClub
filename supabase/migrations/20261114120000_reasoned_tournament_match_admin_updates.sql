-- WP7 follow-up: one audited RPC for administrative schedule, status,
-- assignment and pre-start participant edits. Result/winner fields are
-- intentionally excluded and must use the correction/undo RPCs.

CREATE OR REPLACE FUNCTION public.admin_update_tournament_match(
  p_match_id uuid,
  p_patch jsonb,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_after public.tournament_matches%ROWTYPE;
  v_bad_keys text;
  v_existing bigint;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A reason is required';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'operation_id is required';
  END IF;

  SELECT id INTO v_existing FROM public.tournament_audit_events WHERE operation_id = p_operation_id;
  IF FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_applied', 'event_id', v_existing);
  END IF;

  SELECT string_agg(key, ', ' ORDER BY key) INTO v_bad_keys
  FROM jsonb_object_keys(COALESCE(p_patch, '{}'::jsonb)) key
  WHERE key <> ALL (ARRAY[
    'court_number', 'scheduled_at', 'status', 'reminder_sent', 'umpired_by',
    'player1_id', 'player2_id', 'player3_id', 'player4_id', 'team1_label', 'team2_label'
  ]::text[]);
  IF v_bad_keys IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported administrative match fields: ' || v_bad_keys;
  END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Tournament match not found';
  END IF;
  IF NOT (public.is_admin_or_umpire() OR public.is_tournament_official(v_match.tournament_id)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to update this tournament match';
  END IF;

  IF v_match.status IN ('completed', 'walkover') AND p_patch ? 'status'
     AND p_patch->>'status' IS DISTINCT FROM v_match.status THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'result_reset_requires_correction: use the audited correction or undo action';
  END IF;

  IF v_match.status NOT IN ('pending', 'scheduled')
     AND p_patch ?| ARRAY['player1_id','player2_id','player3_id','player4_id','team1_label','team2_label'] THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'participant_change_blocked: participants can only be replaced before a match starts';
  END IF;

  IF p_patch ? 'status' THEN
    v_status := p_patch->>'status';
    IF v_status <> ALL (ARRAY['pending','scheduled','ready','in_progress','playing','warming_up','paused','cancelled']) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported administrative match status';
    END IF;
  END IF;

  UPDATE public.tournament_matches SET
    court_number = CASE WHEN p_patch ? 'court_number' THEN NULLIF(btrim(p_patch->>'court_number'), '') ELSE court_number END,
    scheduled_at = CASE WHEN p_patch ? 'scheduled_at' THEN NULLIF(p_patch->>'scheduled_at', '')::timestamptz ELSE scheduled_at END,
    status = CASE WHEN p_patch ? 'status' THEN p_patch->>'status' ELSE status END,
    reminder_sent = CASE WHEN p_patch ? 'reminder_sent' THEN COALESCE((p_patch->>'reminder_sent')::boolean, false) ELSE reminder_sent END,
    umpired_by = CASE WHEN p_patch ? 'umpired_by' THEN NULLIF(p_patch->>'umpired_by', '')::uuid ELSE umpired_by END,
    player1_id = CASE WHEN p_patch ? 'player1_id' THEN NULLIF(p_patch->>'player1_id', '')::uuid ELSE player1_id END,
    player2_id = CASE WHEN p_patch ? 'player2_id' THEN NULLIF(p_patch->>'player2_id', '')::uuid ELSE player2_id END,
    player3_id = CASE WHEN p_patch ? 'player3_id' THEN NULLIF(p_patch->>'player3_id', '')::uuid ELSE player3_id END,
    player4_id = CASE WHEN p_patch ? 'player4_id' THEN NULLIF(p_patch->>'player4_id', '')::uuid ELSE player4_id END,
    team1_label = CASE WHEN p_patch ? 'team1_label' THEN NULLIF(btrim(p_patch->>'team1_label'), '') ELSE team1_label END,
    team2_label = CASE WHEN p_patch ? 'team2_label' THEN NULLIF(btrim(p_patch->>'team2_label'), '') ELSE team2_label END
  WHERE id = p_match_id
  RETURNING * INTO v_after;

  INSERT INTO public.tournament_audit_events
    (tournament_id, entity, entity_id, action, actor_id, actor_email, reason,
     before, after, operation_id, source)
  VALUES
    (v_match.tournament_id, 'match_schedule', p_match_id, 'admin_match_update',
     auth.uid(), NULLIF(auth.jwt()->>'email', ''), btrim(p_reason),
     to_jsonb(v_match), to_jsonb(v_after), p_operation_id, 'rpc')
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object('applied', true, 'event_id', v_existing);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_tournament_match(uuid, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_tournament_match(uuid, jsonb, text, uuid) TO authenticated;
