-- ============================================================
-- Guest Players ("Shadow Accounts")
-- Lets admins create player profiles that are NOT tied to an
-- auth.users login, so matches against casual / visiting players
-- can be logged and ELO-tracked.
-- Run in Supabase Dashboard → SQL Editor.
-- Safe to re-run (idempotent).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Remove the FK that forces every players.id to exist in
--    auth.users. Guests have a random UUID with no auth account.
--    Drop by catalog lookup so we don't depend on the constraint name.
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.players'::regclass
      AND contype  = 'f'
      AND confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.players DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2. Flag + provenance columns.
--    Existing rows become is_guest = false automatically.
-- ------------------------------------------------------------
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_guest   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID;

CREATE INDEX IF NOT EXISTS idx_players_is_guest ON public.players (is_guest);

-- ------------------------------------------------------------
-- 3. create_guest_player — admin-only, SECURITY DEFINER so it
--    bypasses the "auth.uid() = id" insert policy. ELO/role/etc.
--    fall back to their column defaults (1200 / 'player' / 0).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_guest_player(
  p_full_name TEXT,
  p_gender    TEXT DEFAULT NULL
) RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_row    public.players;
  v_name   TEXT := btrim(p_full_name);
  v_gender TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = v_caller AND role IN ('master_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can create guest players';
  END IF;

  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Guest name is required';
  END IF;

  -- Normalise gender to the casing the ELO engine expects ('Male'/'Female').
  v_gender := CASE lower(coalesce(p_gender, ''))
                WHEN 'male'   THEN 'Male'
                WHEN 'female' THEN 'Female'
                ELSE NULL
              END;

  INSERT INTO public.players (id, full_name, gender, is_guest, created_by, is_approved)
  VALUES (gen_random_uuid(), v_name, v_gender, true, v_caller, true)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_guest_player(TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4. delete_guest_player — admin-only. Refuses to delete a guest
--    that already has match history (those should be claimed,
--    not deleted). SECURITY DEFINER to bypass RLS.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_guest_player(
  p_guest_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_is_guest BOOLEAN;
  v_matches  INTEGER;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = v_caller AND role IN ('master_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can delete guest players';
  END IF;

  SELECT is_guest INTO v_is_guest FROM public.players WHERE id = p_guest_id;
  IF v_is_guest IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;
  IF v_is_guest IS NOT TRUE THEN
    RAISE EXCEPTION 'Only guest players can be deleted here';
  END IF;

  SELECT count(*) INTO v_matches
  FROM public.matches
  WHERE player1_id = p_guest_id OR player2_id = p_guest_id
     OR team1_partner_id = p_guest_id OR team2_partner_id = p_guest_id;

  IF v_matches > 0 THEN
    RAISE EXCEPTION 'Guest has % match(es) on record — claim the profile instead of deleting.', v_matches;
  END IF;

  DELETE FROM public.players WHERE id = p_guest_id AND is_guest = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_guest_player(UUID) TO authenticated;

COMMIT;

-- ============================================================
-- NOTE: Admin approval of a pending guest match reuses the
-- existing bypass:  confirm_friendly_match(match_uuid, 'umpire_bypass')
-- (a guest can never log in to accept, so an admin finalises it).
-- No new ELO code is required.
-- ============================================================
