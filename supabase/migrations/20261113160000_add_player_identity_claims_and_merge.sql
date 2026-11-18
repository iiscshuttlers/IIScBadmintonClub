-- Migration: 20261113160000_add_player_identity_claims_and_merge.sql
-- WP8 identity — request-based ownership claims and previewed, history-preserving merges.
--
-- * player_claim_requests: a signed-in member can ask to own a guest record,
--   with evidence. Requesting never changes ownership; only an administrator
--   decision does. Names alone never claim or merge anything.
-- * preview_player_merge: read-only impact (rows per table/column that will
--   move, and conflicts that would corrupt history, e.g. the guest and the
--   member on opposite sides of the same match).
-- * merge_player_identity: admin-only, reasoned, idempotent by operation ID.
--   Re-checks conflicts in the transaction, moves every reference (all FKs to
--   players plus known un-constrained player columns), records an alias so
--   saved links to the old ID still resolve, and appends an audit row.
-- * The legacy claim_guest_player / merge_guest_player RPCs (which skipped
--   tournament history in one case and referenced non-existent columns in the
--   other) are no longer executable by clients.

-- ── Aliases (old ID → surviving ID) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_aliases (
  old_player_id UUID PRIMARY KEY,
  player_id UUID NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  merged_by UUID,
  reason TEXT,
  operation_id UUID UNIQUE,
  summary JSONB
);
CREATE INDEX IF NOT EXISTS player_aliases_player_idx ON public.player_aliases (player_id);

ALTER TABLE public.player_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_aliases FROM PUBLIC, anon, authenticated;
-- Only the redirect mapping is public; reasons/summaries are admin-only via RPC.
GRANT SELECT (old_player_id, player_id, merged_at) ON public.player_aliases TO anon, authenticated;
DROP POLICY IF EXISTS player_aliases_read ON public.player_aliases;
CREATE POLICY player_aliases_read ON public.player_aliases FOR SELECT TO anon, authenticated USING (true);

-- ── Claim requests ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_claim_requests (
  id BIGSERIAL PRIMARY KEY,
  guest_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  evidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS player_claim_requests_one_pending
  ON public.player_claim_requests (guest_id, requester_id) WHERE status = 'pending';

ALTER TABLE public.player_claim_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_claim_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.player_claim_requests TO authenticated;
DROP POLICY IF EXISTS player_claim_requests_read ON public.player_claim_requests;
CREATE POLICY player_claim_requests_read ON public.player_claim_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  );

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._is_site_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
    ), false);
$$;
REVOKE ALL ON FUNCTION public._is_site_admin() FROM PUBLIC, anon, authenticated;

-- Every (table, column) in public that holds a player ID: all FKs to
-- players(id) plus known player columns that lack a constraint. Only UUID
-- columns that actually exist are returned.
CREATE OR REPLACE FUNCTION public._player_reference_columns()
RETURNS TABLE (table_name TEXT, column_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH fk AS (
    SELECT c.relname::text AS table_name, a.attname::text AS column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN unnest(con.conkey) AS k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE con.contype = 'f' AND con.confrelid = 'public.players'::regclass
      AND array_length(con.conkey, 1) = 1
  ),
  known(table_name, column_name) AS (
    VALUES
      ('matches', 'player1_id'), ('matches', 'player2_id'), ('matches', 'player3_id'), ('matches', 'player4_id'),
      ('matches', 'team1_partner_id'), ('matches', 'team2_partner_id'), ('matches', 'winner_id'),
      ('matches', 'submitted_by'), ('matches', 'umpired_by'), ('matches', 'recorded_by'),
      ('tournament_matches', 'player1_id'), ('tournament_matches', 'player2_id'),
      ('tournament_matches', 'player3_id'), ('tournament_matches', 'player4_id'),
      ('tournament_matches', 'winner_id'), ('tournament_matches', 'umpired_by'),
      ('tournament_matches', 'recorded_by'), ('tournament_matches', 'scored_by'),
      ('tournament_participants', 'player_id'), ('tournament_participants', 'partner_id'),
      ('tournament_teams', 'captain_id'),
      ('tournament_team_members', 'player_id'), ('tournament_team_members', 'invited_by'),
      ('tie_lineups', 'player1_id'), ('tie_lineups', 'player2_id'), ('tie_lineups', 'submitted_by'),
      ('elo_calculation_logs', 'player_id')
  )
  SELECT DISTINCT x.table_name, x.column_name
  FROM (SELECT * FROM fk UNION SELECT * FROM known) x
  JOIN information_schema.columns ic
    ON ic.table_schema = 'public' AND ic.table_name = x.table_name AND ic.column_name = x.column_name
   AND ic.data_type = 'uuid'
  WHERE x.table_name NOT IN ('players', 'player_aliases', 'player_claim_requests')
  ORDER BY 1, 2;
$$;
REVOKE ALL ON FUNCTION public._player_reference_columns() FROM PUBLIC, anon, authenticated;

-- Rows per table/column referencing p_id, and rows referencing both IDs.
CREATE OR REPLACE FUNCTION public._player_merge_impact(p_guest UUID, p_real UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_count BIGINT;
  v_refs JSONB := '[]'::jsonb;
  v_conflicts JSONB := '[]'::jsonb;
  v_cols TEXT[];
  v_any_guest TEXT;
  v_any_real TEXT;
BEGIN
  FOR r IN SELECT * FROM public._player_reference_columns() LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.table_name, r.column_name)
      INTO v_count USING p_guest;
    IF v_count > 0 THEN
      v_refs := v_refs || jsonb_build_object('table', r.table_name, 'column', r.column_name, 'rows', v_count);
    END IF;
  END LOOP;

  -- Same row naming both identities (e.g. opposite sides of one match):
  -- merging would make a player play themself, so it is a hard conflict.
  FOR r IN
    SELECT c.table_name, array_agg(c.column_name ORDER BY c.column_name) AS cols
    FROM public._player_reference_columns() c
    GROUP BY c.table_name HAVING count(*) > 1
  LOOP
    v_cols := r.cols;
    SELECT string_agg(format('%I = $1', col), ' OR '), string_agg(format('%I = $2', col), ' OR ')
      INTO v_any_guest, v_any_real FROM unnest(v_cols) col;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE (%s) AND (%s)', r.table_name, v_any_guest, v_any_real)
      INTO v_count USING p_guest, p_real;
    IF v_count > 0 THEN
      v_conflicts := v_conflicts || jsonb_build_object('table', r.table_name, 'rows', v_count,
        'kind', 'same_row');
    END IF;
  END LOOP;

  -- Both entered in the same tournament event.
  IF to_regclass('public.tournament_participants') IS NOT NULL THEN
    EXECUTE $q$
      SELECT count(*) FROM public.tournament_participants g
      JOIN public.tournament_participants m
        ON m.tournament_id = g.tournament_id AND m.category IS NOT DISTINCT FROM g.category AND m.id <> g.id
      WHERE (g.player_id = $1 OR g.partner_id = $1) AND (m.player_id = $2 OR m.partner_id = $2)
    $q$ INTO v_count USING p_guest, p_real;
    IF v_count > 0 THEN
      v_conflicts := v_conflicts || jsonb_build_object('table', 'tournament_participants', 'rows', v_count,
        'kind', 'same_event_entry');
    END IF;
  END IF;

  RETURN jsonb_build_object('references', v_refs, 'conflicts', v_conflicts);
END;
$$;
REVOKE ALL ON FUNCTION public._player_merge_impact(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ── Preview ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.preview_player_merge(p_guest_id UUID, p_real_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guest public.players%ROWTYPE;
  v_real public.players%ROWTYPE;
  v_impact JSONB;
  v_blockers TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF public._is_site_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can preview identity merges';
  END IF;
  SELECT * INTO v_guest FROM public.players WHERE id = p_guest_id;
  SELECT * INTO v_real FROM public.players WHERE id = p_real_id;
  IF v_guest.id IS NULL OR v_real.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Player not found';
  END IF;
  IF p_guest_id = p_real_id THEN v_blockers := array_append(v_blockers, 'same_player'); END IF;
  IF v_guest.is_guest IS NOT TRUE THEN v_blockers := array_append(v_blockers, 'source_not_guest'); END IF;
  IF v_real.is_guest IS TRUE THEN v_blockers := array_append(v_blockers, 'target_is_guest'); END IF;
  IF v_real.deleted_at IS NOT NULL THEN v_blockers := array_append(v_blockers, 'target_deleted'); END IF;

  v_impact := public._player_merge_impact(p_guest_id, p_real_id);
  IF jsonb_array_length(v_impact->'conflicts') > 0 THEN
    v_blockers := array_append(v_blockers, 'history_conflict');
  END IF;

  RETURN jsonb_build_object(
    'guest', jsonb_build_object('id', v_guest.id, 'name', v_guest.full_name),
    'target', jsonb_build_object('id', v_real.id, 'name', v_real.full_name),
    'references', v_impact->'references',
    'conflicts', v_impact->'conflicts',
    'blockers', to_jsonb(v_blockers),
    'alias_redirects', (SELECT count(*) FROM public.player_aliases WHERE player_id = p_guest_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.preview_player_merge(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_player_merge(UUID, UUID) TO authenticated;

-- ── Merge ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.merge_player_identity(
  p_guest_id UUID,
  p_real_id UUID,
  p_reason TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.player_aliases%ROWTYPE;
  v_preview JSONB;
  r RECORD;
  v_moved JSONB := '[]'::jsonb;
  v_count BIGINT;
  v_email TEXT := NULLIF(auth.jwt()->>'email', '');
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

  -- Idempotent retry.
  SELECT * INTO v_existing FROM public.player_aliases WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.old_player_id = p_guest_id AND v_existing.player_id = p_real_id THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'already_applied', 'summary', v_existing.summary);
    END IF;
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'operation_id was already used for a different merge';
  END IF;

  -- Serialize merges touching either identity.
  PERFORM 1 FROM public.players WHERE id IN (p_guest_id, p_real_id) ORDER BY id FOR UPDATE;

  v_preview := public.preview_player_merge(p_guest_id, p_real_id);
  IF jsonb_array_length(v_preview->'blockers') > 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'merge_blocked: ' || (SELECT string_agg(b, ', ') FROM jsonb_array_elements_text(v_preview->'blockers') b),
      DETAIL = (v_preview->'conflicts')::text;
  END IF;

  FOR r IN SELECT * FROM public._player_reference_columns() LOOP
    EXECUTE format('UPDATE public.%I SET %I = $2 WHERE %I = $1', r.table_name, r.column_name, r.column_name)
      USING p_guest_id, p_real_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_moved := v_moved || jsonb_build_object('table', r.table_name, 'column', r.column_name, 'rows', v_count);
    END IF;
  END LOOP;

  -- Keep every saved link one hop from the surviving identity.
  UPDATE public.player_aliases SET player_id = p_real_id WHERE player_id = p_guest_id;
  INSERT INTO public.player_aliases (old_player_id, player_id, merged_by, reason, operation_id, summary)
  VALUES (p_guest_id, p_real_id, auth.uid(), btrim(p_reason), p_operation_id,
          jsonb_build_object('moved', v_moved, 'guest_name', v_preview->'guest'->>'name',
                             'target_name', v_preview->'target'->>'name'));

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
                             'operation_id', p_operation_id, 'moved', v_moved, 'actor_id', auth.uid()),
          now());

  RETURN jsonb_build_object('applied', true, 'moved', v_moved);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_player_identity(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_player_identity(UUID, UUID, TEXT, UUID) TO authenticated;

-- Alias history is append-only except the one-hop repointing done by merges.
CREATE OR REPLACE FUNCTION public.protect_player_aliases()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.old_player_id <> OLD.old_player_id OR NEW.operation_id IS DISTINCT FROM OLD.operation_id
     OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.merged_at <> OLD.merged_at THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'player_aliases history is append-only';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS player_aliases_protect ON public.player_aliases;
CREATE TRIGGER player_aliases_protect BEFORE UPDATE OR DELETE ON public.player_aliases
FOR EACH ROW EXECUTE FUNCTION public.protect_player_aliases();

-- ── Claims ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.request_player_claim(p_guest_id UUID, p_evidence TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sign in to claim a player record';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND is_guest IS NOT TRUE AND deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Finish setting up your own profile before claiming a record';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = p_guest_id AND is_guest IS TRUE AND deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Only guest records can be claimed';
  END IF;
  IF p_evidence IS NULL OR length(btrim(p_evidence)) < 10 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Explain how an administrator can verify this record is yours (at least 10 characters)';
  END IF;

  INSERT INTO public.player_claim_requests (guest_id, requester_id, evidence)
  VALUES (p_guest_id, auth.uid(), btrim(p_evidence))
  ON CONFLICT (guest_id, requester_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.player_claim_requests
    WHERE guest_id = p_guest_id AND requester_id = auth.uid() AND status = 'pending';
    RETURN jsonb_build_object('request_id', v_id, 'status', 'pending', 'created', false);
  END IF;
  RETURN jsonb_build_object('request_id', v_id, 'status', 'pending', 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.request_player_claim(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_player_claim(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_player_claim(
  p_request_id BIGINT,
  p_approve BOOLEAN,
  p_note TEXT,
  p_operation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.player_claim_requests%ROWTYPE;
BEGIN
  IF public._is_site_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can decide claims';
  END IF;
  SELECT * INTO v_req FROM public.player_claim_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Claim request not found';
  END IF;
  IF v_req.status <> 'pending' THEN
    -- Retried approval whose merge already ran.
    IF p_approve AND v_req.status = 'approved' THEN
      RETURN jsonb_build_object('status', 'approved', 'applied', false, 'reason', 'already_decided');
    END IF;
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = format('Claim is already %s', v_req.status);
  END IF;
  IF p_note IS NULL OR length(btrim(p_note)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A decision note is required';
  END IF;

  IF p_approve THEN
    UPDATE public.player_claim_requests SET decision_note = btrim(p_note) WHERE id = p_request_id;
    PERFORM public.merge_player_identity(v_req.guest_id, v_req.requester_id,
      'Approved claim #' || p_request_id || ': ' || btrim(p_note), p_operation_id);
    RETURN jsonb_build_object('status', 'approved', 'applied', true);
  END IF;

  UPDATE public.player_claim_requests
  SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = btrim(p_note)
  WHERE id = p_request_id;
  RETURN jsonb_build_object('status', 'rejected', 'applied', true);
END;
$$;
REVOKE ALL ON FUNCTION public.decide_player_claim(BIGINT, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_player_claim(BIGINT, BOOLEAN, TEXT, UUID) TO authenticated;

-- ── Retire the unsafe legacy merge paths for clients ────────────────────────

DO $$
BEGIN
  IF to_regprocedure('public.claim_guest_player(uuid, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.claim_guest_player(UUID, UUID) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.merge_guest_player(uuid, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.merge_guest_player(UUID, UUID) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
