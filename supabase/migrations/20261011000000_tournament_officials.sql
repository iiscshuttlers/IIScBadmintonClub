-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 — Tournament officials (hybrid per-tournament roles)
--
-- Organiser is already modelled by tournaments.created_by (see
-- is_tournament_manager). This adds per-tournament UMPIRE / REFEREE assignment
-- that layers on top of the global players.role so either path grants access
-- (the "hybrid" model). Per-match court assignments continue to live in
-- umpire_assignments; this table is tournament-wide.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tournament_officials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('ORGANIZER', 'UMPIRE', 'REFEREE')),
  assigned_by   uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_tournament_officials_tournament
  ON public.tournament_officials (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_officials_user
  ON public.tournament_officials (user_id);

ALTER TABLE public.tournament_officials ENABLE ROW LEVEL SECURITY;

-- ── Helper: is the current user an official of this tournament? ──────────────
-- p_role NULL  → any official role (or organiser/admin) counts.
-- p_role given → must hold that specific role (admins & the organiser always pass).
CREATE OR REPLACE FUNCTION public.is_tournament_official(t_id uuid, p_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    is_admin_or_master()
    OR EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = t_id AND t.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tournament_officials o
      WHERE o.tournament_id = t_id
        AND o.user_id = auth.uid()
        AND (p_role IS NULL OR o.role = p_role)
    );
$$;

ALTER FUNCTION public.is_tournament_official(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_tournament_official(uuid, text) TO authenticated, service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Readable by any signed-in user (officials lists are shown in the UI).
DROP POLICY IF EXISTS "tournament_officials_read" ON public.tournament_officials;
CREATE POLICY "tournament_officials_read" ON public.tournament_officials
  FOR SELECT TO authenticated
  USING (true);

-- Only admins or the tournament organiser may assign/remove officials.
DROP POLICY IF EXISTS "tournament_officials_manage" ON public.tournament_officials;
CREATE POLICY "tournament_officials_manage" ON public.tournament_officials
  FOR ALL TO authenticated
  USING (is_admin_or_master() OR is_tournament_manager(tournament_id))
  WITH CHECK (is_admin_or_master() OR is_tournament_manager(tournament_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_officials TO authenticated;
GRANT ALL ON public.tournament_officials TO service_role;

-- ── Wire officials into match scoring authorisation ──────────────────────────
-- Extend the shared "may umpire this match" check so a tournament-wide UMPIRE or
-- REFEREE official can score any match in their tournament, in addition to the
-- existing admin / umpired_by / per-match-assignment paths. Logic below is the
-- original definition (20260819000003) plus the officials clause.
CREATE OR REPLACE FUNCTION public.can_umpire_match(p_match_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM players
      WHERE id = p_uid AND role IN ('admin', 'master_admin')
    )
    OR EXISTS (
      SELECT 1 FROM tournament_matches
      WHERE id = p_match_id AND umpired_by = p_uid
    )
    OR EXISTS (
      SELECT 1 FROM umpire_assignments a
      WHERE a.user_id = p_uid
        AND (
          a.tournament_match_id = p_match_id
          OR (a.start_time IS NOT NULL AND a.end_time IS NOT NULL
              AND now() BETWEEN a.start_time AND a.end_time)
        )
    )
    -- Tournament-wide umpire / referee official for this match's tournament.
    OR EXISTS (
      SELECT 1
      FROM tournament_matches tm
      JOIN tournament_officials o ON o.tournament_id = tm.tournament_id
      WHERE tm.id = p_match_id
        AND o.user_id = p_uid
        AND o.role IN ('UMPIRE', 'REFEREE')
    );
$$;

ALTER FUNCTION public.can_umpire_match(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.can_umpire_match(uuid, uuid) TO authenticated, service_role;
