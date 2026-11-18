-- Migration: 20261113180000_restrict_player_contact_columns.sql
-- Privacy: player contact details (email, iisc_email, contact_number,
-- sr_number) were readable by anyone, including signed-out visitors, because
-- `players` had table-wide SELECT. This migration:
--   1. stops if any caller-rights policy/function on the database still reads
--      those columns (they would break), listing them;
--   2. rewrites the one known caller-rights policy that read players.email;
--   3. replaces table-wide SELECT with column-level SELECT on every other
--      column (anon + authenticated);
--   4. exposes contact details only through checked SECURITY DEFINER RPCs:
--      own details, admin lookups, tournament contacts by role, and account
--      linking/lookup by the caller's own verified email.
-- INSERT/UPDATE privileges are unchanged (profile editing keeps working).
-- New columns added to `players` later must be granted explicitly.

-- ── 0. Private column set ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._player_private_columns()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
AS $$ SELECT ARRAY['email', 'iisc_email', 'contact_number', 'sr_number']::TEXT[] $$;
REVOKE ALL ON FUNCTION public._player_private_columns() FROM PUBLIC, anon, authenticated;

-- ── 1. Known caller-rights policies: rewrite to SECURITY DEFINER helpers ──

CREATE OR REPLACE FUNCTION public.is_my_player_id(p_player_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND (
      p_player_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.players
        WHERE id = p_player_id
          AND NULLIF(auth.jwt()->>'email', '') IS NOT NULL
          AND (lower(email) = lower(auth.jwt()->>'email') OR lower(iisc_email) = lower(auth.jwt()->>'email'))
      )
    ), false);
$$;
REVOKE ALL ON FUNCTION public.is_my_player_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_player_id(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    current_user = 'service_role'
    OR (auth.jwt()->>'role') = 'service_role'
    OR (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com')
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE (
        p.id = auth.uid()
        OR (
          NULLIF(auth.jwt()->>'email', '') IS NOT NULL
          AND (lower(p.email) = lower(auth.jwt()->>'email') OR lower(p.iisc_email) = lower(auth.jwt()->>'email'))
        )
      )
      AND p.role IN ('admin', 'master_admin')
    ), false);
$$;
REVOKE ALL ON FUNCTION public.is_admin_or_master() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_master() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.is_admin_or_umpire()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.is_admin_or_master()
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE (
        p.id = auth.uid()
        OR (
          NULLIF(auth.jwt()->>'email', '') IS NOT NULL
          AND (lower(p.email) = lower(auth.jwt()->>'email') OR lower(p.iisc_email) = lower(auth.jwt()->>'email'))
        )
      )
      AND p.role = 'umpire'
    ), false);
$$;
REVOKE ALL ON FUNCTION public.is_admin_or_umpire() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_umpire() TO authenticated, anon, service_role;

DO $$
BEGIN
  IF to_regclass('public.venue_presence_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can log their own presence events" ON public.venue_presence_events;
    CREATE POLICY "Users can log their own presence events"
      ON public.venue_presence_events FOR INSERT
      WITH CHECK (public.is_my_player_id(player_id));
  END IF;

  IF to_regclass('public.umpire_assignments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can manage umpire assignments strictly" ON public.umpire_assignments;
    CREATE POLICY "Admins can manage umpire assignments strictly" ON public.umpire_assignments
      FOR ALL
      USING (public.is_admin_or_master())
      WITH CHECK (public.is_admin_or_master());
  END IF;

  IF to_regclass('public.tournament_matches') IS NOT NULL THEN
    DROP POLICY IF EXISTS "tm_admin_write" ON public.tournament_matches;
    CREATE POLICY "tm_admin_write" ON public.tournament_matches
      FOR ALL
      USING (public.is_admin_or_umpire())
      WITH CHECK (public.is_admin_or_umpire());

    DROP POLICY IF EXISTS "tm_admin_read" ON public.tournament_matches;
    CREATE POLICY "tm_admin_read" ON public.tournament_matches
      FOR SELECT
      USING (public.is_admin_or_umpire());
  END IF;

  IF to_regclass('public.matches') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins and Umpires can update matches" ON public.matches;
    CREATE POLICY "Admins and Umpires can update matches" ON public.matches
      FOR UPDATE
      USING (public.is_admin_or_umpire())
      WITH CHECK (public.is_admin_or_umpire());

    DROP POLICY IF EXISTS "Admins and Umpires can insert matches" ON public.matches;
    CREATE POLICY "Admins and Umpires can insert matches" ON public.matches
      FOR INSERT
      WITH CHECK (public.is_admin_or_umpire());

    DROP POLICY IF EXISTS "Admins can delete matches" ON public.matches;
    CREATE POLICY "Admins can delete matches" ON public.matches
      FOR DELETE
      USING (public.is_admin_or_master());
  END IF;
END $$;

-- ── 2. Preflight: nothing running with caller rights may read the columns ──

DO $$
DECLARE
  v_bad TEXT;
  v_rx TEXT := '\m(email|iisc_email|contact_number|sr_number)\M';
BEGIN
  SELECT string_agg(format('policy %s on %s.%s', policyname, schemaname, tablename), '; ')
  INTO v_bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* v_rx
    AND (tablename = 'players' OR (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '\mplayers\M');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Caller-rights policies read private player columns; rewrite them with a SECURITY DEFINER helper first: ' || v_bad;
  END IF;

  SELECT string_agg(p.proname, ', ')
  INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
  WHERE NOT p.prosecdef
    AND p.prokind IN ('f', 'p')
    AND p.prosrc ~* '\mplayers\M'
    AND p.prosrc ~* v_rx
    AND p.proname NOT IN ('_player_private_columns');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Caller-rights functions read private player columns; make them SECURITY DEFINER or use the contact RPCs first: ' || v_bad;
  END IF;

  SELECT string_agg(c.relname, ', ')
  INTO v_bad
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind = 'v'
    AND coalesce(c.reloptions::text, '') ~* 'security_invoker=(true|on)'
    AND pg_get_viewdef(c.oid) ~* '\mplayers\M'
    AND pg_get_viewdef(c.oid) ~* v_rx;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Security-invoker views read private player columns: ' || v_bad;
  END IF;
END $$;

-- ── 3. Column-level SELECT ──────────────────────────────────────────────────

DO $$
DECLARE
  v_cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'players'
    AND column_name <> ALL (public._player_private_columns());

  REVOKE SELECT ON public.players FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.players TO anon, authenticated', v_cols);
END $$;

-- ── 4. Checked access to contact details ────────────────────────────────────

-- Own details (profile editing, account screens).
CREATE OR REPLACE FUNCTION public.get_my_player_private()
RETURNS TABLE (id UUID, email TEXT, iisc_email TEXT, contact_number TEXT, sr_number TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.email, p.iisc_email, p.contact_number, p.sr_number::TEXT
  FROM public.players p
  WHERE auth.uid() IS NOT NULL AND public.is_my_player_id(p.id)
  ORDER BY (p.id = auth.uid()) DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_player_private() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_player_private() TO authenticated;

-- Which player record belongs to the signed-in account (by ID, else by the
-- caller's own verified email). Replaces client-side `players?email=eq.…`.
CREATE OR REPLACE FUNCTION public.resolve_my_player_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id FROM public.players p
  WHERE auth.uid() IS NOT NULL AND public.is_my_player_id(p.id)
  ORDER BY (p.id = auth.uid()) DESC, p.is_guest NULLS LAST, p.created_at
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_my_player_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_my_player_id() TO authenticated;

-- Site administrators: private columns for given players.
CREATE OR REPLACE FUNCTION public.admin_get_player_private(p_ids UUID[])
RETURNS TABLE (id UUID, email TEXT, iisc_email TEXT, contact_number TEXT, sr_number TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE(auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.players WHERE players.id = auth.uid() AND role IN ('admin', 'master_admin')), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can read player contact details';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.iisc_email, p.contact_number, p.sr_number::TEXT
    FROM public.players p WHERE p.id = ANY (p_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_player_private(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_player_private(UUID[]) TO authenticated;

-- Admin search/lookup by email text (registrations, guest resolution).
CREATE OR REPLACE FUNCTION public.admin_search_players_by_email(p_query TEXT)
RETURNS TABLE (id UUID, full_name TEXT, email TEXT, iisc_email TEXT, is_guest BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE(auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.players WHERE players.id = auth.uid() AND role IN ('admin', 'master_admin')), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can search by email';
  END IF;
  IF length(btrim(coalesce(p_query, ''))) < 3 THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.iisc_email, p.is_guest
    FROM public.players p
    WHERE p.deleted_at IS NULL
      AND (p.email ILIKE '%' || btrim(p_query) || '%' OR p.iisc_email ILIKE '%' || btrim(p_query) || '%')
    LIMIT 25;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_search_players_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_players_by_email(TEXT) TO authenticated;

-- Exact-address lookup for invitations: a signed-in member who already
-- knows someone's email can find that player's public identity. Returns no
-- contact data, and nothing for partial input.
CREATE OR REPLACE FUNCTION public.find_player_by_email(p_email TEXT)
RETURNS TABLE (id UUID, full_name TEXT, gender TEXT, is_guest BOOLEAN, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.full_name, p.gender::TEXT, p.is_guest, p.avatar_url
  FROM public.players p
  WHERE auth.uid() IS NOT NULL
    AND p.deleted_at IS NULL
    AND position('@' IN coalesce(p_email, '')) > 1
    AND (lower(p.email) = lower(btrim(p_email)) OR lower(p.iisc_email) = lower(btrim(p_email)))
  ORDER BY p.is_guest NULLS LAST
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_player_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_player_by_email(TEXT) TO authenticated;

-- Is this address already used by another player? (profile setup)
CREATE OR REPLACE FUNCTION public.player_email_in_use(p_email TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id FROM public.players p
  WHERE auth.uid() IS NOT NULL
    AND position('@' IN coalesce(p_email, '')) > 1
    AND (lower(p.email) = lower(btrim(p_email)) OR lower(p.iisc_email) = lower(btrim(p_email)))
    AND p.id <> auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.player_email_in_use(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_email_in_use(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public._tournament_contacts_enabled(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v JSONB;
BEGIN
  IF to_regclass('public.site_data') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT to_jsonb(value) FROM public.site_data WHERE key = $1'
    INTO v USING 'tournament_contacts_' || p_tournament_id::text;
  RETURN COALESCE(v = 'true'::jsonb OR (jsonb_typeof(v) = 'object' AND (v->>'enabled')::boolean), false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public._tournament_contacts_enabled(UUID) FROM PUBLIC, anon, authenticated;

-- Phone numbers for a tournament, by role:
--   * site admins and the tournament's officials/organiser: any player in that
--     tournament (entries or matches) and its officials;
--   * other players, only while the organiser has enabled contacts: people
--     they share a match with in that tournament, plus its officials.
CREATE OR REPLACE FUNCTION public.get_tournament_contacts(p_tournament_id UUID, p_player_ids UUID[])
RETURNS TABLE (id UUID, full_name TEXT, contact_number TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me UUID := public.resolve_my_player_id();
  v_staff BOOLEAN;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sign in to see contact details';
  END IF;
  v_staff := COALESCE(public.is_tournament_official(p_tournament_id), false);

  RETURN QUERY
  WITH in_event AS (
    SELECT unnest(ARRAY[m.player1_id, m.player2_id, m.player3_id, m.player4_id]) AS pid
    FROM public.tournament_matches m WHERE m.tournament_id = p_tournament_id
    UNION
    SELECT o.user_id FROM public.tournament_officials o WHERE o.tournament_id = p_tournament_id
  ),
  officials AS (
    SELECT o.user_id AS pid FROM public.tournament_officials o WHERE o.tournament_id = p_tournament_id
  ),
  shared AS (
    SELECT unnest(ARRAY[m.player1_id, m.player2_id, m.player3_id, m.player4_id]) AS pid
    FROM public.tournament_matches m
    WHERE m.tournament_id = p_tournament_id
      AND v_me IN (m.player1_id, m.player2_id, m.player3_id, m.player4_id)
  ),
  allowed AS (
    SELECT pid FROM in_event WHERE v_staff
    UNION
    SELECT pid FROM shared WHERE public._tournament_contacts_enabled(p_tournament_id)
    UNION
    SELECT pid FROM officials
      WHERE public._tournament_contacts_enabled(p_tournament_id) AND EXISTS (SELECT 1 FROM shared)
  )
  SELECT p.id, p.full_name, p.contact_number
  FROM public.players p
  WHERE p.id = ANY (p_player_ids)
    AND p.id IN (SELECT pid FROM allowed WHERE pid IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.get_tournament_contacts(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tournament_contacts(UUID, UUID[]) TO authenticated;

-- Participant import: fill a missing phone number without reading others'.
-- (A client UPDATE … WHERE contact_number IS NULL needs SELECT on the column.)
CREATE OR REPLACE FUNCTION public.admin_fill_player_contact(p_player_id UUID, p_contact TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n INT;
BEGIN
  IF NOT COALESCE(auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Only administrators can set player contact numbers';
  END IF;
  UPDATE public.players SET contact_number = NULLIF(btrim(p_contact), '')
  WHERE id = p_player_id AND contact_number IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_fill_player_contact(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fill_player_contact(UUID, TEXT) TO authenticated;
