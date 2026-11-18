-- Migration: 20261115110000_correction_and_merge_followups.sql
-- Follow-ups found in the 14 Nov review:
--   1. Result corrections overwrote scored_at with the correction time. Elo
--      replays (recalculate_tournament_elo) order by scored_at, so a corrected
--      match jumped to the end of history. Keep the original time.
--   2. Identity merges left the guest's name in free-text team labels.
--      Relabel on merge (recorded), restore on merge reversal.
--   3. Lost-and-found claim RPCs: the uuid overloads trusted caller-supplied
--      claimer/user IDs and were executable by anon (anyone could claim in
--      another's name or undo any claim). Same signatures, safe bodies.

-- ── 1. Corrections keep the original scored_at ─────────────────────────────

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
      -- Keep the original scoring time: Elo replays order by scored_at, so a
      -- correction must not move the match to the end of history. The
      -- correction time is recorded in tournament_audit_events.
      scored_at = COALESCE(v_match.scored_at, NOW()),
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

-- ── 2. Team labels follow identity merges ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_merge_label_changes (
  id BIGSERIAL PRIMARY KEY,
  old_player_id UUID NOT NULL,
  match_id UUID NOT NULL,
  column_name TEXT NOT NULL CHECK (column_name IN ('team1_label', 'team2_label')),
  old_label TEXT NOT NULL,
  new_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_merge_label_changes_old_idx ON public.player_merge_label_changes (old_player_id);
ALTER TABLE public.player_merge_label_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_merge_label_changes FROM PUBLIC, anon, authenticated;

-- Replace whole "&"-separated name parts equal to the guest's name (never
-- substrings: "Asha" must not touch "Ashank").
CREATE OR REPLACE FUNCTION public._swap_label_name(p_label TEXT, p_from TEXT, p_to TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_label IS NULL OR p_from IS NULL OR p_to IS NULL OR btrim(p_from) = '' THEN p_label
    WHEN NOT EXISTS (
      SELECT 1 FROM unnest(string_to_array(p_label, '&')) AS part
      WHERE lower(btrim(part)) = lower(btrim(p_from))
    ) THEN p_label
    ELSE array_to_string(ARRAY(
      SELECT CASE WHEN lower(btrim(t.part)) = lower(btrim(p_from)) THEN p_to ELSE btrim(t.part) END
      FROM unnest(string_to_array(p_label, '&')) WITH ORDINALITY AS t(part, n)
      ORDER BY t.n), ' & ')
  END;
$$;
REVOKE ALL ON FUNCTION public._swap_label_name(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.relabel_after_player_merge()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guest_name TEXT;
  v_target_name TEXT;
  r RECORD;
  v_new TEXT;
BEGIN
  v_guest_name := NEW.summary->>'guest_name';
  IF v_guest_name IS NULL AND to_regclass('public.player_identity_merge_operations') IS NOT NULL THEN
    EXECUTE 'SELECT guest_snapshot->>''full_name'' FROM public.player_identity_merge_operations WHERE operation_id = $1'
      INTO v_guest_name USING NEW.operation_id;
  END IF;
  SELECT full_name INTO v_target_name FROM public.players WHERE id = NEW.player_id;
  IF v_guest_name IS NULL OR v_target_name IS NULL OR v_guest_name = v_target_name THEN
    RETURN NEW;
  END IF;

  -- Only sides the surviving member now occupies (moved there by the merge).
  FOR r IN
    SELECT id, team1_label, team2_label,
           NEW.player_id IN (player1_id, player3_id) AS on1,
           NEW.player_id IN (player2_id, player4_id) AS on2
    FROM public.tournament_matches
    WHERE NEW.player_id IN (player1_id, player2_id, player3_id, player4_id)
  LOOP
    IF r.on1 THEN
      v_new := public._swap_label_name(r.team1_label, v_guest_name, v_target_name);
      IF v_new IS DISTINCT FROM r.team1_label THEN
        INSERT INTO public.player_merge_label_changes (old_player_id, match_id, column_name, old_label, new_label)
        VALUES (NEW.old_player_id, r.id, 'team1_label', r.team1_label, v_new);
        UPDATE public.tournament_matches SET team1_label = v_new WHERE id = r.id;
      END IF;
    END IF;
    IF r.on2 THEN
      v_new := public._swap_label_name(r.team2_label, v_guest_name, v_target_name);
      IF v_new IS DISTINCT FROM r.team2_label THEN
        INSERT INTO public.player_merge_label_changes (old_player_id, match_id, column_name, old_label, new_label)
        VALUES (NEW.old_player_id, r.id, 'team2_label', r.team2_label, v_new);
        UPDATE public.tournament_matches SET team2_label = v_new WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_labels_after_merge_reversal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT * FROM public.player_merge_label_changes WHERE old_player_id = OLD.old_player_id ORDER BY id DESC LOOP
    -- Restore only labels nobody has edited since the merge.
    EXECUTE format('UPDATE public.tournament_matches SET %I = $1 WHERE id = $2 AND %I = $3', c.column_name, c.column_name)
      USING c.old_label, c.match_id, c.new_label;
  END LOOP;
  DELETE FROM public.player_merge_label_changes WHERE old_player_id = OLD.old_player_id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.relabel_after_player_merge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_labels_after_merge_reversal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS player_aliases_relabel ON public.player_aliases;
CREATE TRIGGER player_aliases_relabel AFTER INSERT ON public.player_aliases
FOR EACH ROW EXECUTE FUNCTION public.relabel_after_player_merge();

DROP TRIGGER IF EXISTS player_aliases_restore_labels ON public.player_aliases;
CREATE TRIGGER player_aliases_restore_labels AFTER DELETE ON public.player_aliases
FOR EACH ROW EXECUTE FUNCTION public.restore_labels_after_merge_reversal();

-- ── 3. Lost-and-found claims: caller is always auth.uid() ──────────────────

CREATE OR REPLACE FUNCTION public._claim_find_lost(p_post UUID, p_claimed_as TEXT, p_msg TEXT, p_contact TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_post public.find_lost_posts%ROWTYPE;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sign in to claim an item';
  END IF;
  -- Callers still pass their own ID (legacy signature); it must be theirs.
  IF p_claimed_as IS NOT NULL AND p_claimed_as <> '' AND p_claimed_as <> v_uid::text THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'You can only claim items as yourself';
  END IF;
  SELECT * INTO v_post FROM public.find_lost_posts WHERE id = p_post FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Post not found';
  END IF;
  IF v_post.author_id = v_uid THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'You cannot claim your own post';
  END IF;
  IF v_post.resolved IS TRUE AND v_post.claimed_by_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'This item has already been claimed';
  END IF;
  SELECT full_name INTO v_name FROM public.players WHERE id = v_uid;
  UPDATE public.find_lost_posts
  SET resolved = true,
      claimed_by_id = v_uid,
      claimed_by_name = COALESCE(v_name, 'Member'),
      claimed_at = now(),
      claim_message = NULLIF(btrim(p_msg), ''),
      claim_msg = NULLIF(btrim(p_msg), ''),
      -- Contact goes to the column only author/claimant/admins can read.
      claim_contact = NULLIF(btrim(p_contact), '')
  WHERE id = p_post;
END;
$$;
REVOKE ALL ON FUNCTION public._claim_find_lost(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._unclaim_find_lost(p_post UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_post public.find_lost_posts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sign in first';
  END IF;
  SELECT * INTO v_post FROM public.find_lost_posts WHERE id = p_post FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Post not found';
  END IF;
  IF NOT (v_post.claimed_by_id = v_uid OR v_post.author_id = v_uid
          OR EXISTS (SELECT 1 FROM public.players WHERE id = v_uid AND role IN ('admin', 'master_admin'))) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only the claimant, the author or an admin can undo a claim';
  END IF;
  UPDATE public.find_lost_posts
  SET resolved = false, claimed_by_id = NULL, claimed_by_name = NULL, claimed_at = NULL,
      claim_message = NULL, claim_msg = NULL, claim_contact = NULL, claim_contact_info = NULL
  WHERE id = p_post;
END;
$$;
REVOKE ALL ON FUNCTION public._unclaim_find_lost(UUID) FROM PUBLIC, anon, authenticated;

-- Same public signatures as before (old and new clients keep working).
-- The UUID overloads were created outside migrations and carry parameter
-- defaults in production; CREATE OR REPLACE cannot drop a default (42P13), so
-- drop first. Same transaction, so callers never see them missing. Grants are
-- re-applied below.
DROP FUNCTION IF EXISTS public.claim_find_lost_item(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.claim_find_lost_item(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_find_lost_item(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_find_lost_item(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.unclaim_find_lost_item(UUID, UUID);
DROP FUNCTION IF EXISTS public.unclaim_find_lost_item(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.claim_find_lost_item(post_uuid UUID, claimer_id UUID, claimer_name TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public._claim_find_lost(post_uuid, claimer_id::text, NULL, NULL) $$;

CREATE OR REPLACE FUNCTION public.claim_find_lost_item(post_uuid UUID, claimer_id UUID, claimer_name TEXT, claim_msg TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public._claim_find_lost(post_uuid, claimer_id::text, claim_msg, NULL) $$;

CREATE OR REPLACE FUNCTION public.claim_find_lost_item(post_uuid UUID, claimer_id UUID, claimer_name TEXT, claim_msg TEXT, claim_contact_info TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public._claim_find_lost(post_uuid, claimer_id::text, claim_msg, claim_contact_info) $$;

CREATE OR REPLACE FUNCTION public.claim_find_lost_item(post_uuid UUID, claimer_id TEXT, claimer_name TEXT, claim_msg TEXT, claim_contact_info TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public._claim_find_lost(post_uuid, claimer_id, claim_msg, claim_contact_info) $$;

CREATE OR REPLACE FUNCTION public.unclaim_find_lost_item(post_uuid UUID, user_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public._unclaim_find_lost(post_uuid) $$;

CREATE OR REPLACE FUNCTION public.unclaim_find_lost_item(post_uuid UUID, user_id TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public._unclaim_find_lost(post_uuid) $$;

REVOKE ALL ON FUNCTION public.claim_find_lost_item(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_find_lost_item(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_find_lost_item(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_find_lost_item(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unclaim_find_lost_item(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unclaim_find_lost_item(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_find_lost_item(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_find_lost_item(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_find_lost_item(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_find_lost_item(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unclaim_find_lost_item(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unclaim_find_lost_item(UUID, TEXT) TO authenticated;
