-- Tournament contact visibility, enforced by the server.
--
-- 1. A finished tournament (completed, archived or deleted) releases no phone
--    numbers to anyone through get_tournament_contacts: not players, officials,
--    organisers or site admins. Until now only the browser hid them, and its
--    status check never matched (it compared against upper-case values).
-- 2. The organiser's contacts setting gains a "hidden" mode that blocks
--    everyone, officials and admins included. site_data
--    'tournament_contacts_<id>' now holds {"mode": "..."}:
--      hidden    - nobody;
--      officials - officials, the organiser and site admins (default);
--      everyone  - also players: people they share a match with, plus officials.
--    Older values keep their meaning: true or {"enabled": true} is "everyone";
--    false, {"enabled": false} or no row is "officials".
--
-- Site admins still manage player records (and their numbers) through
-- admin_get_player_private; that general admin tool is unchanged.

CREATE OR REPLACE FUNCTION public._tournament_contacts_mode(p_tournament_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v JSONB;
BEGIN
  IF to_regclass('public.site_data') IS NULL THEN RETURN 'officials'; END IF;
  EXECUTE 'SELECT to_jsonb(value) FROM public.site_data WHERE key = $1'
    INTO v USING 'tournament_contacts_' || p_tournament_id::text;
  IF v IS NULL THEN RETURN 'officials'; END IF;
  IF jsonb_typeof(v) = 'object' AND v->>'mode' IN ('hidden', 'officials', 'everyone') THEN
    RETURN v->>'mode';
  END IF;
  IF v = 'true'::jsonb OR (jsonb_typeof(v) = 'object' AND (v->>'enabled')::boolean) THEN
    RETURN 'everyone';
  END IF;
  RETURN 'officials';
EXCEPTION WHEN OTHERS THEN
  RETURN 'officials';
END;
$$;
REVOKE ALL ON FUNCTION public._tournament_contacts_mode(UUID) FROM PUBLIC, anon, authenticated;

-- Kept for anything still calling it: true only when players may see contacts.
CREATE OR REPLACE FUNCTION public._tournament_contacts_enabled(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public._tournament_contacts_mode(p_tournament_id) = 'everyone';
$$;
REVOKE ALL ON FUNCTION public._tournament_contacts_enabled(UUID) FROM PUBLIC, anon, authenticated;

-- Phone numbers for a tournament that is still running, by role and setting:
--   * hidden: nobody;
--   * officials (default): site admins and the tournament's officials/organiser
--     see any player in that tournament (entries or matches) and its officials;
--   * everyone: as above, and other players see the people they share a match
--     with in that tournament, plus its officials.
CREATE OR REPLACE FUNCTION public.get_tournament_contacts(p_tournament_id UUID, p_player_ids UUID[])
RETURNS TABLE (id UUID, full_name TEXT, contact_number TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me UUID := public.resolve_my_player_id();
  v_status TEXT;
  v_mode TEXT;
  v_staff BOOLEAN;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sign in to see contact details';
  END IF;

  SELECT lower(t.status) INTO v_status FROM public.tournaments t WHERE t.id = p_tournament_id;
  -- Unknown or finished tournaments never release numbers, to anyone.
  IF NOT FOUND OR v_status IN ('completed', 'archived', 'deleted') THEN
    RETURN;
  END IF;

  v_mode := public._tournament_contacts_mode(p_tournament_id);
  IF v_mode = 'hidden' THEN
    RETURN;
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
    SELECT pid FROM shared WHERE v_mode = 'everyone'
    UNION
    SELECT pid FROM officials
      WHERE v_mode = 'everyone' AND EXISTS (SELECT 1 FROM shared)
  )
  SELECT p.id, p.full_name, p.contact_number
  FROM public.players p
  WHERE p.id = ANY (p_player_ids)
    AND p.id IN (SELECT pid FROM allowed WHERE pid IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.get_tournament_contacts(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tournament_contacts(UUID, UUID[]) TO authenticated;
