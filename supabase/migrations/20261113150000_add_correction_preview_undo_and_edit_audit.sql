-- Migration: 20261113150000_add_correction_preview_undo_and_edit_audit.sql
-- WP7 — controlled corrections and attributable edits.
--
-- 1. tournament_audit_events: an append-only audit table that only database
--    functions can write. (admin_logs stays as the human-readable activity
--    feed, but authenticated clients may insert into it, so it cannot be the
--    authoritative history.)
-- 2. preview_tournament_match_correction: read-only impact preview (revision,
--    downstream bracket matches, Elo/team effects, blockers).
-- 3. apply_tournament_match_correction is re-expressed on a shared internal
--    helper (same contract and error codes) that also records an audit event.
-- 4. undo_tournament_match_correction: undo is a new audited action that
--    restores the pre-correction values under the same guards; it never
--    edits or deletes the original event.
-- 5. Guard + audit for direct table edits (admin screens): a decided result
--    cannot be rewritten while a downstream match is in play, any direct
--    result edit bumps result_revision (so stale previews/umpire submissions
--    cannot commit over it), and result, court/schedule and seed edits are
--    recorded with before/after values and the acting user.

-- ── 1. Audit table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tournament_audit_events (
  id BIGSERIAL PRIMARY KEY,
  tournament_id UUID NOT NULL,
  entity TEXT NOT NULL CHECK (entity IN ('match_result', 'match_schedule', 'participant_seed')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  reason TEXT,
  before JSONB,
  after JSONB,
  operation_id UUID,
  undoes_event_id BIGINT REFERENCES public.tournament_audit_events(id),
  source TEXT NOT NULL CHECK (source IN ('rpc', 'direct_edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tournament_audit_events_operation_key
  ON public.tournament_audit_events (operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tournament_audit_events_entity_idx
  ON public.tournament_audit_events (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tournament_audit_events_tournament_idx
  ON public.tournament_audit_events (tournament_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reject_tournament_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'tournament_audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS tournament_audit_events_append_only ON public.tournament_audit_events;
CREATE TRIGGER tournament_audit_events_append_only
BEFORE UPDATE OR DELETE ON public.tournament_audit_events
FOR EACH ROW EXECUTE FUNCTION public.reject_tournament_audit_mutation();

DROP TRIGGER IF EXISTS tournament_audit_events_no_truncate ON public.tournament_audit_events;
CREATE TRIGGER tournament_audit_events_no_truncate
BEFORE TRUNCATE ON public.tournament_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_tournament_audit_mutation();

ALTER TABLE public.tournament_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tournament_audit_events TO authenticated;

DROP POLICY IF EXISTS tournament_audit_events_read ON public.tournament_audit_events;
CREATE POLICY tournament_audit_events_read ON public.tournament_audit_events
  FOR SELECT TO authenticated
  USING (public.is_tournament_official(tournament_id));

-- Internal writer. Not executable by clients.
CREATE OR REPLACE FUNCTION public._record_tournament_audit_event(
  p_tournament_id UUID,
  p_entity TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_before JSONB,
  p_after JSONB,
  p_operation_id UUID,
  p_undoes_event_id BIGINT,
  p_source TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id BIGINT;
  v_email TEXT := NULLIF(auth.jwt()->>'email', '');
BEGIN
  IF v_email IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT email INTO v_email FROM public.players WHERE id = auth.uid();
  END IF;
  INSERT INTO public.tournament_audit_events (
    tournament_id, entity, entity_id, action, actor_id, actor_email, reason,
    before, after, operation_id, undoes_event_id, source
  ) VALUES (
    p_tournament_id, p_entity, p_entity_id, p_action, auth.uid(),
    COALESCE(v_email, CASE WHEN auth.uid() IS NULL THEN 'system' END),
    NULLIF(btrim(p_reason), ''), p_before, p_after, p_operation_id,
    p_undoes_event_id, p_source
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._record_tournament_audit_event(
  UUID, TEXT, UUID, TEXT, TEXT, JSONB, JSONB, UUID, BIGINT, TEXT
) FROM PUBLIC, anon, authenticated;

-- ── 2. Preview ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.preview_tournament_match_correction(
  p_match_id UUID,
  p_winner_side SMALLINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match tournament_matches%ROWTYPE;
  v_counts_for_elo BOOLEAN;
  v_downstream JSONB;
  v_blockers TEXT[] := ARRAY[]::TEXT[];
  v_winner_change BOOLEAN;
  v_last_event public.tournament_audit_events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Match not found';
  END IF;

  IF public.can_umpire_match(p_match_id, auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to correct this tournament match result';
  END IF;

  SELECT COALESCE(counts_for_elo, false) INTO v_counts_for_elo
  FROM public.tournaments WHERE id = v_match.tournament_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'match_id', d.id,
      'match_code', d.match_code,
      'path', CASE WHEN d.match_code = v_match.advances_to_match THEN 'winner' ELSE 'loser' END,
      'position', CASE WHEN d.match_code = v_match.advances_to_match
                       THEN v_match.advances_to_position ELSE v_match.advances_to_position_loser END,
      'status', d.status,
      'team1_label', d.team1_label,
      'team2_label', d.team2_label,
      'started', (d.status IN ('in_progress', 'live', 'completed', 'walkover')
                  OR d.score IS NOT NULL OR d.started_at IS NOT NULL)
    ) ORDER BY d.match_code), '[]'::jsonb)
  INTO v_downstream
  FROM public.tournament_matches d
  WHERE d.tournament_id = v_match.tournament_id
    AND d.match_code IN (v_match.advances_to_match, v_match.advances_to_match_loser);

  IF v_match.status <> 'completed' OR v_match.winner_side IS NULL THEN
    v_blockers := array_append(v_blockers, 'not_completed');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_downstream) e WHERE (e->>'started')::boolean) THEN
    v_blockers := array_append(v_blockers, 'downstream_started');
  END IF;

  v_winner_change := p_winner_side IS NOT NULL AND p_winner_side IS DISTINCT FROM v_match.winner_side;
  IF v_winner_change AND v_counts_for_elo THEN
    v_blockers := array_append(v_blockers, 'ranked_winner_change');
  END IF;
  IF v_winner_change AND v_match.tie_id IS NOT NULL THEN
    v_blockers := array_append(v_blockers, 'team_winner_change');
  END IF;

  -- The latest correction can be undone only while it is still the current result.
  SELECT * INTO v_last_event
  FROM public.tournament_audit_events
  WHERE entity = 'match_result' AND entity_id = p_match_id
    AND action = 'result_correction'
    AND operation_id = v_match.result_operation_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'match_id', v_match.id,
    'tournament_id', v_match.tournament_id,
    'match_code', v_match.match_code,
    'status', v_match.status,
    'revision', v_match.result_revision,
    'winner_side', v_match.winner_side,
    'score', v_match.score,
    'sets', to_jsonb(v_match.sets_history),
    'counts_for_elo', v_counts_for_elo,
    'is_team_rubber', v_match.tie_id IS NOT NULL,
    'winner_change', v_winner_change,
    'elo_effect', CASE
      WHEN NOT v_counts_for_elo THEN 'not_ranked'
      WHEN v_winner_change THEN 'requires_recalculation'
      ELSE 'unchanged' END,
    'downstream', v_downstream,
    'blockers', to_jsonb(v_blockers),
    'undoable_event_id', v_last_event.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_tournament_match_correction(UUID, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_tournament_match_correction(UUID, SMALLINT) TO authenticated;

-- ── 3. Shared correction core ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._change_tournament_match_result(
  p_match_id UUID,
  p_winner_side SMALLINT,
  p_score TEXT,
  p_sets TEXT[],
  p_expected_revision BIGINT,
  p_reason TEXT,
  p_operation_id UUID,
  p_scored_by UUID,
  p_action TEXT,
  p_undoes_event_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match tournament_matches%ROWTYPE;
  v_winner_id UUID;
  v_actor_player_id UUID;
  v_user_email TEXT;
  v_downstream_active BOOLEAN;
  v_counts_for_elo BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A non-empty reason is required to correct a tournament match result';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'operation_id is required';
  END IF;
  IF p_winner_side NOT IN (1, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'winner_side must be 1 or 2';
  END IF;
  IF NULLIF(trim(p_score), '') IS NULL OR COALESCE(cardinality(p_sets), 0) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'score and at least one set are required';
  END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Match not found';
  END IF;

  IF public.can_umpire_match(p_match_id, auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to correct this tournament match result';
  END IF;

  IF v_match.status <> 'completed' OR v_match.winner_side IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Only a completed match result can be corrected';
  END IF;

  SELECT id INTO v_actor_player_id
  FROM public.players
  WHERE id = auth.uid()
     OR email = (auth.jwt()->>'email')
     OR iisc_email = (auth.jwt()->>'email')
  ORDER BY (id = auth.uid()) DESC
  LIMIT 1;

  IF p_scored_by IS NOT NULL AND p_scored_by IS DISTINCT FROM v_actor_player_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'scored_by must identify the authenticated official';
  END IF;

  -- Retry after an uncertain response: no second update, audit or progression.
  IF v_match.result_operation_id = p_operation_id THEN
    IF v_match.winner_side = p_winner_side
      AND v_match.score IS NOT DISTINCT FROM p_score
      AND v_match.sets_history IS NOT DISTINCT FROM p_sets THEN
      RETURN jsonb_build_object(
        'applied', false, 'revision', v_match.result_revision,
        'operation_id', p_operation_id, 'reason', 'already_applied');
    END IF;
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'operation_id was already used with a different correction';
  END IF;

  -- A preview taken before any other result change cannot commit.
  IF v_match.result_revision <> p_expected_revision THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = format('result_revision_conflict: expected %s, current %s', p_expected_revision, v_match.result_revision);
  END IF;

  SELECT COALESCE(counts_for_elo, false) INTO v_counts_for_elo
  FROM public.tournaments WHERE id = v_match.tournament_id;

  IF p_winner_side IS DISTINCT FROM v_match.winner_side
     AND (v_counts_for_elo OR v_match.tie_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '0A000',
      MESSAGE = 'winner_change_requires_coordinated_correction: ranked and team-event winner changes require an administrator recalculation';
  END IF;

  -- Dependency state is re-read under the row lock, not trusted from the preview.
  IF v_match.advances_to_match IS NOT NULL OR v_match.advances_to_match_loser IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tournament_matches
      WHERE tournament_id = v_match.tournament_id
        AND match_code IN (v_match.advances_to_match, v_match.advances_to_match_loser)
        AND (status IN ('in_progress', 'live', 'completed', 'walkover')
             OR score IS NOT NULL OR started_at IS NOT NULL)
    ) INTO v_downstream_active;
    IF v_downstream_active THEN
      RAISE EXCEPTION USING ERRCODE = '42501',
        MESSAGE = 'downstream_match_started: A downstream match has already started or completed. Please use controlled administrator correction.';
    END IF;
  END IF;

  v_winner_id := CASE WHEN p_winner_side = 1 THEN v_match.player1_id ELSE v_match.player2_id END;

  -- Tell the direct-edit guard this change is the audited RPC path.
  PERFORM set_config('app.tournament_result_rpc', 'on', true);

  UPDATE public.tournament_matches
  SET winner_side = p_winner_side,
      winner_id = v_winner_id,
      score = p_score,
      sets_history = p_sets,
      status = 'completed',
      scored_by = COALESCE(v_actor_player_id, v_match.scored_by),
      scored_at = NOW(),
      result_revision = v_match.result_revision + 1,
      result_operation_id = p_operation_id
  WHERE id = p_match_id;

  PERFORM public.advance_tournament_winner(p_match_id);

  PERFORM set_config('app.tournament_result_rpc', 'off', true);

  PERFORM public._record_tournament_audit_event(
    v_match.tournament_id, 'match_result', p_match_id, p_action, p_reason,
    jsonb_build_object('revision', v_match.result_revision, 'winner_side', v_match.winner_side,
                       'score', v_match.score, 'sets', to_jsonb(v_match.sets_history)),
    jsonb_build_object('revision', v_match.result_revision + 1, 'winner_side', p_winner_side,
                       'score', p_score, 'sets', to_jsonb(p_sets)),
    p_operation_id, p_undoes_event_id, 'rpc');

  -- Human-readable activity feed (unchanged shape for existing readers).
  v_user_email := auth.jwt()->>'email';
  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM public.players WHERE id = v_actor_player_id;
  END IF;
  INSERT INTO public.admin_logs (admin_email, action, details, created_at)
  VALUES (
    COALESCE(v_user_email, 'official'),
    CASE WHEN p_action = 'result_correction_undo' THEN 'tournament_score_correction_undo'
         ELSE 'tournament_score_correction' END,
    jsonb_build_object(
      'match_id', p_match_id,
      'tournament_id', v_match.tournament_id,
      'reason', trim(p_reason),
      'previous_revision', v_match.result_revision,
      'new_revision', v_match.result_revision + 1,
      'previous_winner_side', v_match.winner_side,
      'previous_score', v_match.score,
      'previous_sets', v_match.sets_history,
      'new_winner_side', p_winner_side,
      'new_score', p_score,
      'new_sets', p_sets,
      'operation_id', p_operation_id,
      'undoes_event_id', p_undoes_event_id,
      'actor_id', auth.uid()),
    NOW());

  RETURN jsonb_build_object(
    'applied', true, 'revision', v_match.result_revision + 1, 'operation_id', p_operation_id);
END;
$$;

REVOKE ALL ON FUNCTION public._change_tournament_match_result(
  UUID, SMALLINT, TEXT, TEXT[], BIGINT, TEXT, UUID, UUID, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated;

-- Public contract unchanged (signature, receipts, error codes).
CREATE OR REPLACE FUNCTION public.apply_tournament_match_correction(
  p_match_id UUID,
  p_winner_side SMALLINT,
  p_score TEXT,
  p_sets TEXT[],
  p_expected_revision BIGINT,
  p_reason TEXT,
  p_operation_id UUID,
  p_scored_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public._change_tournament_match_result(
    p_match_id, p_winner_side, p_score, p_sets, p_expected_revision,
    p_reason, p_operation_id, p_scored_by, 'result_correction', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tournament_match_correction(
  UUID, SMALLINT, TEXT, TEXT[], BIGINT, TEXT, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_tournament_match_correction(
  UUID, SMALLINT, TEXT, TEXT[], BIGINT, TEXT, UUID, UUID
) TO authenticated;

-- ── 4. Undo ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.undo_tournament_match_correction(
  p_event_id BIGINT,
  p_expected_revision BIGINT,
  p_reason TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.tournament_audit_events%ROWTYPE;
  v_match tournament_matches%ROWTYPE;
  v_sets TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT * INTO v_event FROM public.tournament_audit_events WHERE id = p_event_id;
  IF NOT FOUND OR v_event.action <> 'result_correction' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Correction not found';
  END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = v_event.entity_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Match not found';
  END IF;

  IF public.can_umpire_match(v_match.id, auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized to correct this tournament match result';
  END IF;

  -- Only the correction that is still the current result can be undone.
  -- (A retry of this same undo is handled as idempotent by the core.)
  IF v_match.result_operation_id IS DISTINCT FROM v_event.operation_id
     AND v_match.result_operation_id IS DISTINCT FROM p_operation_id THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'correction_superseded: the result has changed since this correction; review the current result instead';
  END IF;

  SELECT COALESCE(array_agg(x), ARRAY[]::TEXT[]) INTO v_sets
  FROM jsonb_array_elements_text(COALESCE(v_event.before->'sets', '[]'::jsonb)) AS x;

  RETURN public._change_tournament_match_result(
    v_match.id,
    (v_event.before->>'winner_side')::SMALLINT,
    v_event.before->>'score',
    v_sets,
    p_expected_revision,
    p_reason,
    p_operation_id,
    NULL,
    'result_correction_undo',
    v_event.id);
END;
$$;

REVOKE ALL ON FUNCTION public.undo_tournament_match_correction(BIGINT, BIGINT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_tournament_match_correction(BIGINT, BIGINT, TEXT, UUID) TO authenticated;

-- ── 5. Direct-edit guard and audit ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_tournament_match_direct_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_flag TEXT := 'app.tm_decided_' || replace(NEW.id::text, '-', '');
  v_result_changed BOOLEAN;
BEGIN
  v_result_changed := OLD.winner_side IS DISTINCT FROM NEW.winner_side
    OR OLD.score IS DISTINCT FROM NEW.score
    OR OLD.sets_history IS DISTINCT FROM NEW.sets_history
    OR OLD.status IS DISTINCT FROM NEW.status;

  -- Remember rows that became decided in this transaction (normal scoring
  -- RPCs complete a match in several statements; those follow-ups are not edits).
  IF OLD.status NOT IN ('completed', 'walkover') AND NEW.status IN ('completed', 'walkover') THEN
    PERFORM set_config(v_flag, 'on', true);
    RETURN NEW;
  END IF;

  IF NOT v_result_changed
     OR OLD.status NOT IN ('completed', 'walkover')
     OR COALESCE(current_setting('app.tournament_result_rpc', true), '') = 'on'
     OR COALESCE(current_setting(v_flag, true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- A decided result feeding a match already in play must not be silently rewritten.
  IF EXISTS (
    SELECT 1 FROM public.tournament_matches d
    WHERE d.tournament_id = OLD.tournament_id
      AND d.match_code IN (OLD.advances_to_match, OLD.advances_to_match_loser)
      AND (d.status IN ('in_progress', 'live', 'completed', 'walkover')
           OR d.score IS NOT NULL OR d.started_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'downstream_match_started: A downstream match has already started or completed. Please use controlled administrator correction.';
  END IF;

  -- Any other result rewrite invalidates earlier previews and submissions.
  IF NEW.result_revision IS NOT DISTINCT FROM OLD.result_revision THEN
    NEW.result_revision := OLD.result_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_matches_guard_direct_edit ON public.tournament_matches;
CREATE TRIGGER tournament_matches_guard_direct_edit
BEFORE UPDATE ON public.tournament_matches
FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_match_direct_edit();

CREATE OR REPLACE FUNCTION public.audit_tournament_match_direct_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_flag TEXT := 'app.tm_decided_' || replace(NEW.id::text, '-', '');
BEGIN
  -- Result rewrites of a decided match outside the correction RPC.
  IF OLD.status IN ('completed', 'walkover')
     AND COALESCE(current_setting('app.tournament_result_rpc', true), '') <> 'on'
     AND COALESCE(current_setting(v_flag, true), '') <> 'on'
     AND (OLD.winner_side IS DISTINCT FROM NEW.winner_side
          OR OLD.score IS DISTINCT FROM NEW.score
          OR OLD.sets_history IS DISTINCT FROM NEW.sets_history
          OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public._record_tournament_audit_event(
      NEW.tournament_id, 'match_result', NEW.id, 'result_direct_edit', NULL,
      jsonb_build_object('revision', OLD.result_revision, 'status', OLD.status,
                         'winner_side', OLD.winner_side, 'score', OLD.score,
                         'sets', to_jsonb(OLD.sets_history)),
      jsonb_build_object('revision', NEW.result_revision, 'status', NEW.status,
                         'winner_side', NEW.winner_side, 'score', NEW.score,
                         'sets', to_jsonb(NEW.sets_history)),
      NULL, NULL, 'direct_edit');
  END IF;

  -- Court / schedule changes. Overrides carry their own reason (WP3 RPC).
  IF OLD.court_number IS DISTINCT FROM NEW.court_number
     OR OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    PERFORM public._record_tournament_audit_event(
      NEW.tournament_id, 'match_schedule', NEW.id,
      CASE WHEN OLD.schedule_override_at IS DISTINCT FROM NEW.schedule_override_at
           THEN 'schedule_override' ELSE 'schedule_edit' END,
      CASE WHEN OLD.schedule_override_at IS DISTINCT FROM NEW.schedule_override_at
           THEN NEW.schedule_override_reason END,
      jsonb_build_object('court', OLD.court_number, 'scheduled_at', OLD.scheduled_at),
      jsonb_build_object('court', NEW.court_number, 'scheduled_at', NEW.scheduled_at),
      NULL, NULL,
      CASE WHEN OLD.schedule_override_at IS DISTINCT FROM NEW.schedule_override_at
           THEN 'rpc' ELSE 'direct_edit' END);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tournament_matches_audit_direct_edit ON public.tournament_matches;
CREATE TRIGGER tournament_matches_audit_direct_edit
AFTER UPDATE ON public.tournament_matches
FOR EACH ROW EXECUTE FUNCTION public.audit_tournament_match_direct_edit();

CREATE OR REPLACE FUNCTION public.audit_tournament_participant_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.seed IS DISTINCT FROM NEW.seed THEN
    PERFORM public._record_tournament_audit_event(
      NEW.tournament_id, 'participant_seed', NEW.id, 'seed_edit', NULL,
      jsonb_build_object('seed', OLD.seed, 'category', OLD.category),
      jsonb_build_object('seed', NEW.seed, 'category', NEW.category),
      NULL, NULL, 'direct_edit');
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tournament_participants_audit_seed ON public.tournament_participants;
CREATE TRIGGER tournament_participants_audit_seed
AFTER UPDATE OF seed ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.audit_tournament_participant_seed();

REVOKE ALL ON FUNCTION public.guard_tournament_match_direct_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_tournament_match_direct_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_tournament_participant_seed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_tournament_audit_mutation() FROM PUBLIC, anon, authenticated;
