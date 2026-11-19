-- Rollback for 20261120110000_private_team_invite_tokens_and_team_player_draft_read.sql
-- Puts each team's token back on tournament_teams, restores the exact previous
-- text of the three invite RPCs (pg_get_functiondef, 2026-11-20), and drops
-- the new table, triggers, function and policy. The restored
-- join_team_by_token again cannot add a new player (its IF FOUND bug).

DROP POLICY IF EXISTS "tournaments_team_player_read" ON public.tournaments;

DROP TRIGGER IF EXISTS trg_tournament_teams_invite_token_private ON public.tournament_teams;
DROP TRIGGER IF EXISTS trg_tournament_teams_create_invite_token ON public.tournament_teams;
DROP FUNCTION IF EXISTS public.tournament_teams_keep_invite_token_private();
DROP FUNCTION IF EXISTS public.tournament_teams_create_invite_token();

UPDATE public.tournament_teams t
   SET invite_token = k.token, invite_token_enabled = k.enabled
  FROM public.team_invite_tokens k WHERE k.team_id = t.id;
ALTER TABLE public.tournament_teams ALTER COLUMN invite_token SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.generate_new_team_invite_token(p_team_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_token uuid := gen_random_uuid();
BEGIN
  IF NOT is_team_staff(p_team_id) AND NOT is_tournament_manager((SELECT tournament_id FROM tournament_teams WHERE id = p_team_id)) THEN
    RAISE EXCEPTION 'Only team captain or managers can regenerate invite links.';
  END IF;

  UPDATE tournament_teams
  SET invite_token = v_new_token,
      invite_token_enabled = true
  WHERE id = p_team_id;

  RETURN v_new_token;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_team_by_invite_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    t.invite_token_enabled,
    tour.name as tournament_name,
    tour.status as tournament_status,
    tour.team_roster_max,
    p.full_name as captain_name,
    p.avatar_url as captain_avatar
  INTO v_team
  FROM tournament_teams t
  JOIN tournaments tour ON tour.id = t.tournament_id
  LEFT JOIN players p ON p.id = t.captain_id
  WHERE t.invite_token = p_token;

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
$function$
;

CREATE OR REPLACE FUNCTION public.join_team_by_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  SELECT * INTO v_team 
  FROM tournament_teams 
  WHERE invite_token = p_token AND invite_token_enabled = true;

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
  IF FOUND THEN
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
$function$
;

DROP FUNCTION IF EXISTS public.get_team_invite_token(uuid);
DROP TABLE IF EXISTS public.team_invite_tokens;
