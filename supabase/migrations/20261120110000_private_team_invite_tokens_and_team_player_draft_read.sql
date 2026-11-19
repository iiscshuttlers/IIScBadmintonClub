-- 1. Keep team invite tokens private.
-- 2. Let a team tournament's players open it while it is a draft.
--
-- 1. tournament_teams.invite_token is the secret behind /join-team/<token>:
--    join_team_by_token adds whoever holds it to the roster. It sat on the
--    team row, so anyone who could read the team (everyone, for a public
--    tournament) could read every token and join any team. Revoking the
--    column is not an option: older apps select "*" from tournament_teams
--    and would fail. So the token moves to team_invite_tokens, which no
--    client role can read, and tournament_teams.invite_token stays as an
--    always-NULL column:
--      - team_invite_tokens(team_id, token, enabled): RLS on, no policies,
--        no grants to anon/authenticated. Existing tokens are copied over.
--      - A BEFORE trigger keeps tournament_teams.invite_token NULL; an AFTER
--        INSERT trigger gives every new team a token. The column default
--        (gen_random_uuid()) is dropped.
--      - get_team_invite_token(team) (new): the token, for team staff, the
--        tournament's managers and officials, and admins; NULL for anyone else.
--      - generate_new_team_invite_token, get_team_by_invite_token and
--        join_team_by_token use the new table; their checks and messages are
--        unchanged.
--    Older apps show no invite link (they read the NULL column) until updated;
--    joining with an existing link keeps working.
--
-- 2. A tournament is 'draft' until start_play, but tournaments_public_read
--    hides drafts, so a team's captain and players could not open their own
--    tournament (team hub, lineups) before play started. New policy
--    tournaments_team_player_read: signed-in users with an ACTIVE or INVITED
--    roster row in it, or captaining one of its teams
--    (is_tournament_team_player, from 20261120100000), can read it unless it
--    is in the trash.
--
-- On 2026-11-20 tournament_teams was empty on production.
--
-- Rollback: supabase/rollbacks/20261120110000_private_team_invite_tokens_and_team_player_draft_read.rollback.sql

-- ---------- 1. private invite tokens ----------
CREATE TABLE IF NOT EXISTS public.team_invite_tokens (
  team_id    uuid PRIMARY KEY REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
  token      uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_invite_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_invite_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.team_invite_tokens TO service_role;

INSERT INTO public.team_invite_tokens (team_id, token, enabled)
SELECT id, invite_token, coalesce(invite_token_enabled, true)
  FROM public.tournament_teams WHERE invite_token IS NOT NULL
ON CONFLICT (team_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tournament_teams_keep_invite_token_private()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.invite_token := NULL;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tournament_teams_create_invite_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.team_invite_tokens (team_id) VALUES (NEW.id) ON CONFLICT (team_id) DO NOTHING;
  RETURN NULL;
END;
$function$;

ALTER TABLE public.tournament_teams ALTER COLUMN invite_token DROP DEFAULT;
UPDATE public.tournament_teams SET invite_token = NULL WHERE invite_token IS NOT NULL;

DROP TRIGGER IF EXISTS trg_tournament_teams_invite_token_private ON public.tournament_teams;
CREATE TRIGGER trg_tournament_teams_invite_token_private
  BEFORE INSERT OR UPDATE OF invite_token ON public.tournament_teams
  FOR EACH ROW EXECUTE FUNCTION public.tournament_teams_keep_invite_token_private();

DROP TRIGGER IF EXISTS trg_tournament_teams_create_invite_token ON public.tournament_teams;
CREATE TRIGGER trg_tournament_teams_create_invite_token
  AFTER INSERT ON public.tournament_teams
  FOR EACH ROW EXECUTE FUNCTION public.tournament_teams_create_invite_token();

-- Teams created before this migration without a token get one.
INSERT INTO public.team_invite_tokens (team_id)
SELECT id FROM public.tournament_teams ON CONFLICT (team_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_team_invite_token(p_team_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tournament uuid;
  v_token uuid;
BEGIN
  SELECT tournament_id INTO v_tournament FROM public.tournament_teams WHERE id = p_team_id;
  IF v_tournament IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT (public.is_team_staff(p_team_id)
          OR public.is_tournament_manager(v_tournament)
          OR public.is_tournament_official(v_tournament)
          OR public.is_admin_or_master()) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.team_invite_tokens (team_id) VALUES (p_team_id) ON CONFLICT (team_id) DO NOTHING;
  SELECT token INTO v_token FROM public.team_invite_tokens WHERE team_id = p_team_id;
  RETURN v_token;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_team_invite_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_invite_token(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_new_team_invite_token(p_team_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_token uuid := gen_random_uuid();
BEGIN
  IF NOT is_team_staff(p_team_id) AND NOT is_tournament_manager((SELECT tournament_id FROM tournament_teams WHERE id = p_team_id)) THEN
    RAISE EXCEPTION 'Only team captain or managers can regenerate invite links.';
  END IF;

  INSERT INTO public.team_invite_tokens (team_id, token, enabled, updated_at)
  VALUES (p_team_id, v_new_token, true, now())
  ON CONFLICT (team_id) DO UPDATE SET token = EXCLUDED.token, enabled = true, updated_at = now();

  UPDATE tournament_teams SET invite_token_enabled = true WHERE id = p_team_id;

  RETURN v_new_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_team_by_invite_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_team record;
  v_result jsonb;
  v_member_count int;
  v_max_roster int;
BEGIN
  SELECT
    t.id,
    t.name,
    t.short_name,
    t.tournament_id,
    t.captain_id,
    k.enabled as invite_token_enabled,
    tour.name as tournament_name,
    tour.status as tournament_status,
    tour.team_roster_max,
    p.full_name as captain_name,
    p.avatar_url as captain_avatar
  INTO v_team
  FROM team_invite_tokens k
  JOIN tournament_teams t ON t.id = k.team_id
  JOIN tournaments tour ON tour.id = t.tournament_id
  LEFT JOIN players p ON p.id = t.captain_id
  WHERE k.token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite link is invalid or does not exist.';
  END IF;

  IF NOT v_team.invite_token_enabled THEN
    RAISE EXCEPTION 'This invite link has been disabled by the team captain.';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM tournament_team_members
  WHERE team_id = v_team.id AND status = 'ACTIVE';

  v_max_roster := COALESCE(v_team.team_roster_max, 20);

  v_result := jsonb_build_object(
    'team_id', v_team.id,
    'team_name', v_team.name,
    'short_name', v_team.short_name,
    'tournament_id', v_team.tournament_id,
    'tournament_name', v_team.tournament_name,
    'captain_name', v_team.captain_name,
    'captain_avatar', v_team.captain_avatar,
    'active_members', v_member_count,
    'max_roster', v_max_roster,
    'is_full', (v_member_count >= v_max_roster)
  );

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_team_by_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_team tournament_teams%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
  v_current_count int;
  v_existing_member tournament_team_members%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to join a team.';
  END IF;

  SELECT t.* INTO v_team
  FROM tournament_teams t
  JOIN team_invite_tokens k ON k.team_id = t.id
  WHERE k.token = p_token AND k.enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite link.';
  END IF;

  SELECT * INTO v_tournament
  FROM tournaments
  WHERE id = v_team.tournament_id;

  -- Check if user is already an ACTIVE member in any team in the same tournament
  IF EXISTS (
    SELECT 1 FROM tournament_team_members m
    JOIN tournament_teams tt ON tt.id = m.team_id
    WHERE tt.tournament_id = v_team.tournament_id
      AND m.player_id = v_user_id
      AND m.status = 'ACTIVE'
      AND m.team_id != v_team.id
  ) THEN
    RAISE EXCEPTION 'You are already registered with another team in this tournament.';
  END IF;

  -- Check current team membership status
  SELECT * INTO v_existing_member
  FROM tournament_team_members
  WHERE team_id = v_team.id AND player_id = v_user_id;

  IF FOUND AND v_existing_member.status = 'ACTIVE' THEN
    RAISE EXCEPTION 'You are already an active member of this team.';
  END IF;

  -- Check roster capacity
  SELECT count(*) INTO v_current_count
  FROM tournament_team_members
  WHERE team_id = v_team.id AND status = 'ACTIVE';

  IF v_tournament.team_roster_max IS NOT NULL AND v_current_count >= v_tournament.team_roster_max THEN
    RAISE EXCEPTION 'Team roster is full (maximum % players reached).', v_tournament.team_roster_max;
  END IF;

  -- Insert or update member status to ACTIVE
  IF v_existing_member.id IS NOT NULL THEN
    UPDATE tournament_team_members
    SET status = 'ACTIVE',
        role = COALESCE(role, 'PLAYER'),
        responded_at = now()
    WHERE id = v_existing_member.id;
  ELSE
    INSERT INTO tournament_team_members (
      team_id,
      tournament_id,
      player_id,
      role,
      status,
      invited_by,
      responded_at
    ) VALUES (
      v_team.id,
      v_team.tournament_id,
      v_user_id,
      'PLAYER',
      'ACTIVE',
      v_team.captain_id,
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'team_id', v_team.id,
    'team_name', v_team.name,
    'message', 'Successfully joined ' || v_team.name
  );
END;
$function$;

-- ---------- 2. team players open their draft tournament ----------
DROP POLICY IF EXISTS "tournaments_team_player_read" ON public.tournaments;
CREATE POLICY "tournaments_team_player_read" ON public.tournaments
  FOR SELECT TO authenticated
  USING (status <> 'deleted' AND public.is_tournament_team_player(id));
