-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — In-app tournament registration
--
-- Players self-register for a tournament (one row per player per tournament),
-- picking the categories they want to enter. Organisers / officials / admins
-- review and approve or reject. Fields mirror the existing admin
-- RegistrationsManager (full_name, categories, partner_names, message,
-- transaction_id, receipt_path) so that UI works against a real table.
--
-- Only used when tournaments.require_app_registration = true; otherwise the
-- external form_url remains the registration path.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tournament_registrations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id      uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  full_name      text NOT NULL,
  email          text,
  phone          text,
  categories     text[] NOT NULL DEFAULT ARRAY[]::text[],
  partner_names  text,              -- free-text "category: partner" notes
  transaction_id text,              -- optional payment reference
  receipt_path   text,              -- optional uploaded receipt (storage path)
  message        text,              -- optional note to organisers
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by    uuid REFERENCES public.players(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_registrations_unique UNIQUE (tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament
  ON public.tournament_registrations (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_player
  ON public.tournament_registrations (player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_status
  ON public.tournament_registrations (tournament_id, status);

ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;

-- Read: your own registration, or an admin / organiser / official of the event.
DROP POLICY IF EXISTS "tournament_registrations_read" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_read" ON public.tournament_registrations
  FOR SELECT TO authenticated
  USING (
    player_id = auth.uid()
    OR is_admin_or_master()
    OR is_tournament_official(tournament_id)
  );

-- Insert: only register yourself.
DROP POLICY IF EXISTS "tournament_registrations_self_insert" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_self_insert" ON public.tournament_registrations
  FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid());

-- Update: organisers/admins review; a registrant may edit their own row while
-- it is still pending (e.g. change categories or withdraw).
DROP POLICY IF EXISTS "tournament_registrations_update" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_update" ON public.tournament_registrations
  FOR UPDATE TO authenticated
  USING (
    is_admin_or_master()
    OR is_tournament_official(tournament_id)
    OR (player_id = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    is_admin_or_master()
    OR is_tournament_official(tournament_id)
    OR (player_id = auth.uid())
  );

-- Delete: organisers/admins, or the registrant withdrawing their own row.
DROP POLICY IF EXISTS "tournament_registrations_delete" ON public.tournament_registrations;
CREATE POLICY "tournament_registrations_delete" ON public.tournament_registrations
  FOR DELETE TO authenticated
  USING (
    is_admin_or_master()
    OR is_tournament_official(tournament_id)
    OR player_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_registrations TO authenticated;
GRANT ALL ON public.tournament_registrations TO service_role;
