-- Migration: 20261114090000_restrict_participant_email_and_claim_contact.sql
-- Privacy follow-up to 20261113170000 (audit 14 Nov 2026, signed-out reads):
--   * tournament_participants.email was readable by anyone (11 of 285 rows filled);
--   * find_lost_posts.claim_contact (a claimant's phone/email) was readable by anyone.
-- Both become column-restricted. Access goes through checked RPCs:
--   * get_participant_emails(tournament)  — admins, the organiser, tournament officials;
--   * get_find_lost_claim_contacts(ids)   — the post's author, the claimant, admins.
-- DEPLOY AFTER the client that stops selecting "*" on these tables, or old
-- clients' reads of these tables will fail (see docs/release-checklist.md).

-- ── Preflight: no caller-rights SQL may read the restricted columns ─────────
DO $$
DECLARE v_bad TEXT;
BEGIN
  SELECT string_agg(format('policy %s on %s', policyname, tablename), '; ') INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'tournament_participants' AND (coalesce(qual,'') || coalesce(with_check,'')) ~* '\memail\M')
      OR (tablename = 'find_lost_posts' AND (coalesce(qual,'') || coalesce(with_check,'')) ~* '\mclaim_contact\M')
      OR ((coalesce(qual,'') || coalesce(with_check,'')) ~* 'tournament_participants' AND (coalesce(qual,'') || coalesce(with_check,'')) ~* '\memail\M')
    );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Caller-rights policies read restricted columns: ' || v_bad;
  END IF;
END $$;

-- ── Column-level SELECT ─────────────────────────────────────────────────────
DO $$
DECLARE v_cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tournament_participants' AND column_name <> 'email';
  REVOKE SELECT ON public.tournament_participants FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.tournament_participants TO anon, authenticated', v_cols);

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'find_lost_posts' AND column_name <> 'claim_contact';
  REVOKE SELECT ON public.find_lost_posts FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.find_lost_posts TO anon, authenticated', v_cols);
END $$;

-- ── Checked access ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_participant_emails(p_tournament_id UUID)
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.is_tournament_official(p_tournament_id), false) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only organisers and officials can read entry emails';
  END IF;
  RETURN QUERY
    SELECT tp.id, tp.email FROM public.tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id AND tp.email IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.get_participant_emails(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_participant_emails(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_find_lost_claim_contacts(p_ids UUID[])
RETURNS TABLE (id UUID, claim_contact TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.claim_contact
  FROM public.find_lost_posts f
  WHERE auth.uid() IS NOT NULL
    AND f.id = ANY (p_ids)
    AND f.claim_contact IS NOT NULL
    AND (
      f.author_id = auth.uid()
      OR f.claimed_by_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.players p WHERE p.id = auth.uid() AND p.role IN ('admin', 'master_admin'))
    );
$$;
REVOKE ALL ON FUNCTION public.get_find_lost_claim_contacts(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_find_lost_claim_contacts(UUID[]) TO authenticated;
