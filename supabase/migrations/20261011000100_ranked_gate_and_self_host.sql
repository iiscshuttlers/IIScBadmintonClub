-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 — Ranked gate + self-hosted tournaments
--
-- Goal:
--   * Any signed-in user may host their own tournament.
--   * Self-hosted (non-admin) tournaments are ALWAYS unranked — they must never
--     affect player ELO. Only admins / master_admins may create ranked events.
--   * Enforced in the database (not just the UI) so the ELO leaderboard is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Ranked gate trigger ───────────────────────────────────────────────────
-- Non-admin writers can never set counts_for_elo = true. Admins and the backend
-- (service_role, e.g. bracket/scoring jobs) are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_ranked_gate()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Backend / privileged writers bypass the gate.
  IF auth.role() = 'service_role' OR is_admin_or_master() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A tournament hosted by a non-admin is always casual / unranked.
    NEW.counts_for_elo := false;
  ELSIF TG_OP = 'UPDATE' AND NEW.counts_for_elo IS DISTINCT FROM OLD.counts_for_elo THEN
    -- Non-admins cannot flip the ranked flag after creation.
    NEW.counts_for_elo := OLD.counts_for_elo;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_ranked_gate() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_enforce_ranked_gate ON public.tournaments;
CREATE TRIGGER trg_enforce_ranked_gate
  BEFORE INSERT OR UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ranked_gate();

-- ── 2. Self-host RLS on tournaments ──────────────────────────────────────────
-- Existing policies (tournaments_public_read, tournaments_admin_read,
-- tournaments_admin_write) remain. These add host-scoped access so a regular
-- user can create and manage the tournaments they own, including their drafts.

DROP POLICY IF EXISTS "tournaments_self_host_read" ON public.tournaments;
CREATE POLICY "tournaments_self_host_read" ON public.tournaments
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "tournaments_self_host_insert" ON public.tournaments;
CREATE POLICY "tournaments_self_host_insert" ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tournaments_self_host_update" ON public.tournaments;
CREATE POLICY "tournaments_self_host_update" ON public.tournaments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Hosts may delete only their own drafts (safety: no deleting live/completed events).
DROP POLICY IF EXISTS "tournaments_self_host_delete" ON public.tournaments;
CREATE POLICY "tournaments_self_host_delete" ON public.tournaments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND status = 'draft');
