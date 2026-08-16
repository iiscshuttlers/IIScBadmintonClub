


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Remove target from my buddy_requests and add to buddies
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), p_target_id::text),
      buddies        = array_append(COALESCE(buddies, ARRAY[]::TEXT[]), p_target_id::text)
  WHERE id = v_my_id
    AND NOT (p_target_id::text = ANY(COALESCE(buddies, ARRAY[]::TEXT[])));

  -- Add me to target's buddies and remove me from their buddy_requests
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text),
      buddies        = array_append(COALESCE(buddies, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id
    AND NOT (v_my_id::text = ANY(COALESCE(buddies, ARRAY[]::TEXT[])));
END;
$$;


ALTER FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m_record RECORD;
  is_doubles BOOLEAN;
  required INTEGER;
  new_confirmed TEXT[];
  agreed INTEGER;
BEGIN
  -- IDENTITY CHECK: Ensure the caller is actually the confirmer_id they claim to be
  IF confirmer_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only accept matches for yourself.';
  END IF;

  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;

  -- Must be a participant in the match
  IF confirmer_id IS DISTINCT FROM m_record.player1_id
     AND confirmer_id IS DISTINCT FROM m_record.player2_id
     AND confirmer_id IS DISTINCT FROM m_record.team1_partner_id
     AND confirmer_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  -- The submitter already implicitly agrees with the score they entered
  IF confirmer_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You submitted this match, so you have already agreed to the score.';
  END IF;

  -- Idempotent: a player can only accept once
  IF m_record.confirmed_by @> ARRAY[confirmer_id::text] THEN
    RAISE EXCEPTION 'You have already accepted this match.';
  END IF;

  new_confirmed := array_append(COALESCE(m_record.confirmed_by, '{}'), confirmer_id::text);

  is_doubles := m_record.team1_partner_id IS NOT NULL OR m_record.team2_partner_id IS NOT NULL;
  required := CASE WHEN is_doubles THEN 3 ELSE 2 END;

  -- submitter (1) + everyone who has now accepted
  agreed := 1 + COALESCE(array_length(new_confirmed, 1), 0);

  UPDATE matches SET confirmed_by = new_confirmed WHERE id = match_uuid;

  IF agreed >= required THEN
    -- Quorum reached -> finalize through the existing ELO routine.
    RETURN confirm_friendly_match(match_uuid, confirmer_id)
           || jsonb_build_object('confirmed', true, 'accepted', agreed, 'required', required);
  END IF;

  RETURN jsonb_build_object('confirmed', false, 'accepted', agreed, 'required', required);
END;
$$;


ALTER FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN RAISE EXCEPTION 'Unauthorized'; END IF; UPDATE players SET is_approved = true WHERE id = ANY(p_ids); END; $$;


ALTER FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[], "p_approved" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_is_authorized BOOLEAN := false;
BEGIN
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE players SET is_approved = p_approved WHERE id = ANY(p_ids);
END;
$$;


ALTER FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[], "p_approved" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid" DEFAULT NULL::"uuid", "p_start_time" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_time" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid UUID;
  v_count INTEGER := 0;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Check if calling user is admin
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_admin := true;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can assign umpires';
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids
  LOOP
    INSERT INTO umpire_assignments (user_id, tournament_match_id, start_time, end_time, created_by)
    VALUES (v_uid, p_tournament_match_id, p_start_time, p_end_time, auth.uid());
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN := false;
BEGIN
  -- Check if calling user is admin
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_admin := true;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete umpire assignments';
  END IF;

  DELETE FROM umpire_assignments WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_edit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_scored_by" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_winner_id UUID;
  v_match     tournament_matches%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND (role IN ('admin', 'master_admin') OR id = (SELECT umpired_by FROM tournament_matches WHERE id = p_match_id))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or assigned umpire can edit match score';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF p_winner_side = 1 THEN v_winner_id := v_match.player1_id;
  ELSE                       v_winner_id := v_match.player2_id;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    scored_by    = p_scored_by,
    scored_at    = NOW()
  WHERE id = p_match_id;

  IF v_winner_id IS NOT NULL THEN
    PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_edit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_scored_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role = 'master_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Only allowed when tournament is in draft status
  IF NOT EXISTS (
    SELECT 1 FROM tournaments t
    JOIN tournament_matches m ON m.tournament_id = t.id
    WHERE m.id = p_match_id AND t.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Bracket moves only allowed while tournament is in draft status';
  END IF;

  IF p_slot = 1 THEN
    UPDATE tournament_matches
    SET player1_id = p_player_id, player3_id = p_partner_id, team1_label = p_label
    WHERE id = p_match_id;
  ELSE
    UPDATE tournament_matches
    SET player2_id = p_player_id, player4_id = p_partner_id, team2_label = p_label
    WHERE id = p_match_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_tournament_winner"("p_match_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_match        tournament_matches%ROWTYPE;
  v_next         tournament_matches%ROWTYPE;
  v_winner_label TEXT;
  v_winner_p1    UUID;
  v_winner_p3    UUID;
  v_loser_label  TEXT;
  v_loser_p1     UUID;
  v_loser_p3     UUID;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- ── Advance winner ──────────────────────────────────────────────────────────
  IF v_match.advances_to_match IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_winner_p1    := v_match.player1_id;
        v_winner_p3    := v_match.player3_id;
        v_winner_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player1_id, v_match.player3_id));
        IF v_winner_label IS NULL OR trim(v_winner_label) = '' THEN
          v_winner_label := v_match.team1_label;
        END IF;
      ELSE
        v_winner_p1    := v_match.player2_id;
        v_winner_p3    := v_match.player4_id;
        v_winner_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player2_id, v_match.player4_id));
        IF v_winner_label IS NULL OR trim(v_winner_label) = '' THEN
          v_winner_label := v_match.team2_label;
        END IF;
      END IF;

      IF v_match.advances_to_position = 1 THEN
        UPDATE tournament_matches
        SET player1_id = COALESCE(v_winner_p1, player1_id),
            player3_id = COALESCE(v_winner_p3, player3_id),
            team1_label = COALESCE(v_winner_label, team1_label)
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = COALESCE(v_winner_p1, player2_id),
            player4_id = COALESCE(v_winner_p3, player4_id),
            team2_label = COALESCE(v_winner_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;

  -- ── Advance loser to 3rd place match (if configured) ──────────────────────
  IF v_match.advances_to_match_loser IS NOT NULL THEN
    SELECT * INTO v_next FROM tournament_matches
    WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match_loser;

    IF FOUND THEN
      IF v_match.winner_side = 1 THEN
        v_loser_p1    := v_match.player2_id;
        v_loser_p3    := v_match.player4_id;
        v_loser_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player2_id, v_match.player4_id));
        IF v_loser_label IS NULL OR trim(v_loser_label) = '' THEN
          v_loser_label := v_match.team2_label;
        END IF;
      ELSE
        v_loser_p1    := v_match.player1_id;
        v_loser_p3    := v_match.player3_id;
        v_loser_label := (SELECT string_agg(full_name, ' & ') FROM players WHERE id IN (v_match.player1_id, v_match.player3_id));
        IF v_loser_label IS NULL OR trim(v_loser_label) = '' THEN
          v_loser_label := v_match.team1_label;
        END IF;
      END IF;

      IF v_match.advances_to_position_loser = 1 THEN
        UPDATE tournament_matches
        SET player1_id = COALESCE(v_loser_p1, player1_id),
            player3_id = COALESCE(v_loser_p3, player3_id),
            team1_label = COALESCE(v_loser_label, team1_label)
        WHERE id = v_next.id;
      ELSE
        UPDATE tournament_matches
        SET player2_id = COALESCE(v_loser_p1, player2_id),
            player4_id = COALESCE(v_loser_p3, player4_id),
            team2_label = COALESCE(v_loser_label, team2_label)
        WHERE id = v_next.id;
      END IF;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."advance_tournament_winner"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Strict Admin check
  IF admin_email != 'iiscbadmintonclub@gmail.com' AND admin_email != 'janmejay@iisc.ac.in' THEN
    RAISE EXCEPTION 'Unauthorized: Only verified admins can approve players.';
  END IF;

  -- Verify player exists
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = player_id) THEN
    RAISE EXCEPTION 'Player not found.';
  END IF;

  -- Mark as approved
  UPDATE players SET is_approved = true WHERE id = player_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = admin_id AND role IN ('admin', 'master_admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can approve players.';
  END IF;

  -- Verify player is pending
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = player_id AND approval_status = 'pending') THEN
    RAISE EXCEPTION 'Player is not in pending state.';
  END IF;

  -- Update status
  UPDATE public.players SET approval_status = 'approved' WHERE id = player_id;
END;
$$;


ALTER FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_tournament"("p_tournament_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE tournaments
  SET status = 'archived', archived_at = NOW()
  WHERE id = p_tournament_id AND status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament must be in completed status to archive';
  END IF;
END;
$$;


ALTER FUNCTION "public"."archive_tournament"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_claim_duplicate_profile"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_auth_email TEXT;
  v_old_id UUID;
  v_new_id UUID;
BEGIN
  v_new_id := auth.uid();
  v_auth_email := (auth.jwt() ->> 'email');
  
  -- If user has no email in their auth token, we can't securely verify them.
  IF v_auth_email IS NULL THEN
    RETURN false;
  END IF;

  -- Find a player with this exact email that is NOT the current user
  -- (Prioritizing guest/shadow profiles that haven't been claimed yet)
  SELECT id INTO v_old_id 
  FROM players 
  WHERE (email = v_auth_email OR iisc_email = v_auth_email) 
    AND id != v_new_id
  ORDER BY is_guest DESC
  LIMIT 1;

  IF v_old_id IS NULL THEN
    RETURN false;
  END IF;

  -- Transfer all match references from the old ID to the new ID
  UPDATE matches SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE matches SET player2_id = v_new_id WHERE player2_id = v_old_id;
  UPDATE matches SET team1_partner_id = v_new_id WHERE team1_partner_id = v_old_id;
  UPDATE matches SET team2_partner_id = v_new_id WHERE team2_partner_id = v_old_id;
  UPDATE matches SET winner_id = v_new_id WHERE winner_id = v_old_id;
  UPDATE matches SET submitted_by = v_new_id WHERE submitted_by = v_old_id;
  
  -- Transfer tournament registrations
  UPDATE tournament_registrations SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE tournament_registrations SET player2_id = v_new_id WHERE player2_id = v_old_id;
  
  -- Transfer elo logs
  UPDATE elo_logs SET player_id = v_new_id WHERE player_id = v_old_id;

  -- Transfer venue presence
  UPDATE venue_presence_events SET player_id = v_new_id WHERE player_id = v_old_id;

  -- Transfer feedback
  UPDATE feedback SET user_id = v_new_id WHERE user_id = v_old_id;

  -- Delete the old row (zombie row)
  DELETE FROM players WHERE id = v_old_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."auto_claim_duplicate_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_overall_elo"("p_singles_elo" integer, "p_singles_matches" integer, "p_doubles_elo" integer, "p_doubles_matches" integer, "p_mixed_elo" integer, "p_mixed_matches" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_total_weight INTEGER;
  v_weighted_sum NUMERIC;
BEGIN
  v_total_weight := p_singles_matches + p_doubles_matches + p_mixed_matches;
  IF v_total_weight = 0 THEN
    RETURN p_singles_elo; -- Default fallback
  END IF;
  
  v_weighted_sum := (p_singles_elo * p_singles_matches) + (p_doubles_elo * p_doubles_matches) + (p_mixed_elo * p_mixed_matches);
  RETURN ROUND(v_weighted_sum / v_total_weight);
END;
$$;


ALTER FUNCTION "public"."calculate_overall_elo"("p_singles_elo" integer, "p_singles_matches" integer, "p_doubles_elo" integer, "p_doubles_matches" integer, "p_mixed_elo" integer, "p_mixed_matches" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id;
END;
$$;


ALTER FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("lookup_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    email_found BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE email = lookup_email
    ) INTO email_found;

    RETURN email_found;
END;
$$;


ALTER FUNCTION "public"."check_email_exists"("lookup_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.find_lost_posts
  SET resolved = true,
      claimed_by_id = claimer_id,
      claimed_by_name = claimer_name,
      claimed_at = now()
  WHERE id = post_uuid;
END;
$$;


ALTER FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.find_lost_posts
  SET resolved = true,
      claimed_by_id = claimer_id,
      claimed_by_name = claimer_name,
      claimed_at = now(),
      claim_message = claim_msg
  WHERE id = post_uuid;
END;
$$;


ALTER FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "text", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_true_name TEXT;
BEGIN
  -- Authenticate
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be logged in to claim an item.';
  END IF;

  -- Fetch true name to prevent name spoofing
  SELECT full_name INTO v_true_name FROM public.players WHERE id = v_uid;

  UPDATE public.find_lost_posts
  SET resolved = true,
      claimed_by_id = v_uid,
      claimed_by_name = COALESCE(v_true_name, claimer_name),
      claim_msg = claim_find_lost_item.claim_msg,
      claim_contact_info = claim_find_lost_item.claim_contact_info
  WHERE id = post_uuid;
END;
$$;


ALTER FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "text", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text" DEFAULT NULL::"text", "claim_contact_info" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.find_lost_posts
  SET resolved = true,
      claimed_by_id = claimer_id,
      claimed_by_name = claimer_name,
      claimed_at = now(),
      claim_message = claim_msg,
      claim_contact = claim_contact_info
  WHERE id = post_uuid;
END;
$$;


ALTER FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_guest_player"("p_guest_id" "uuid", "p_real_player_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can claim guest accounts';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_guest_id AND is_guest = true) THEN
    RAISE EXCEPTION 'Guest player not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_real_player_id AND (is_guest IS NULL OR is_guest = false)) THEN
    RAISE EXCEPTION 'Real player not found';
  END IF;

  -- Transfer all match references
  UPDATE matches SET player1_id      = p_real_player_id WHERE player1_id      = p_guest_id;
  UPDATE matches SET player2_id      = p_real_player_id WHERE player2_id      = p_guest_id;
  UPDATE matches SET team1_partner_id = p_real_player_id WHERE team1_partner_id = p_guest_id;
  UPDATE matches SET team2_partner_id = p_real_player_id WHERE team2_partner_id = p_guest_id;
  UPDATE matches SET winner_id       = p_real_player_id WHERE winner_id       = p_guest_id;
  UPDATE matches SET submitted_by    = p_real_player_id WHERE submitted_by    = p_guest_id;

  -- Delete the guest shadow profile
  DELETE FROM players WHERE id = p_guest_id AND is_guest = true;
END;
$$;


ALTER FUNCTION "public"."claim_guest_player"("p_guest_id" "uuid", "p_real_player_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_stale_push_tokens"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.user_push_tokens
  WHERE updated_at < NOW() - INTERVAL '7 days';

  RAISE NOTICE 'Cleaned up stale push tokens older than 7 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_stale_push_tokens"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m_record RECORD;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;
  
  -- Validation checks unless umpire_bypass is passed or system
  IF confirmer_id IS NULL OR (confirmer_id != 'umpire_bypass' AND confirmer_id != 'system') THEN
    IF (confirmer_id::uuid) = m_record.submitted_by THEN
      RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
    END IF;
    
    IF (confirmer_id::uuid) IS DISTINCT FROM m_record.player1_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.player2_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team1_partner_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team2_partner_id THEN
      RAISE EXCEPTION 'You were not a part of this match.';
    END IF;
  END IF;

  -- User feedback: Friendly matches DO NOT affect ELO.
  -- We just update the status to completed and return.
  
  -- Mark match as completed
  UPDATE matches 
  SET status = 'completed',
      elo_change_p1 = 0,
      elo_change_p2 = 0,
      elo_change_p3 = 0,
      elo_change_p4 = 0
  WHERE id = match_uuid;

  RETURN jsonb_build_object('success', true, 'match_id', match_uuid, 'status', 'completed');
END;
$$;


ALTER FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "nickname" "text",
    "avatar_url" "text",
    "department" "text",
    "joined_year" integer,
    "playing_level" "text",
    "dominant_hand" "text",
    "playing_style" "text",
    "favorite_shot" "text",
    "favorite_idol" "text",
    "quote" "text",
    "current_racket" "text",
    "nationality" "text",
    "home_state" "text",
    "height" "text",
    "started_playing_year" integer,
    "coach" "text",
    "bio" "text",
    "current_ranking" integer,
    "highest_ranking" integer,
    "shoes" "text",
    "apparel" "text",
    "instagram" "text",
    "email" "text",
    "racket_details" "jsonb",
    "tournament_history" "text"[],
    "achievements" "text"[],
    "stats" "jsonb",
    "recent_form" "text"[],
    "recent_matches" "jsonb",
    "frequent_partners" "jsonb",
    "career_highlights" "jsonb",
    "win_loss_record" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_approved" boolean DEFAULT false,
    "pref_notify_buddy_status" boolean DEFAULT true,
    "singles_elo" integer DEFAULT 1200,
    "doubles_elo" integer DEFAULT 1200,
    "mixed_elo" integer DEFAULT 1200,
    "deleted_at" timestamp with time zone,
    "iisc_email" "text",
    "contact_number" "text",
    "sr_number" "text",
    "elo_rating" integer DEFAULT 1200,
    "total_friendly_matches" integer DEFAULT 0,
    "favorite_format" "text",
    "gender" "text",
    "is_looking_to_play" boolean DEFAULT false,
    "followers" "text"[] DEFAULT '{}'::"text"[],
    "following" "text"[] DEFAULT '{}'::"text"[],
    "buddies" "text"[] DEFAULT '{}'::"text"[],
    "is_guest" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "is_retired" boolean DEFAULT false,
    "role" "text" DEFAULT 'player'::"text",
    "tournament_elo" integer DEFAULT 1200,
    "tournament_singles_elo" integer DEFAULT 1200,
    "tournament_doubles_elo" integer DEFAULT 1200,
    "tournament_mixed_elo" integer DEFAULT 1200,
    "singles_matches_played" integer DEFAULT 0,
    "doubles_matches_played" integer DEFAULT 0,
    "mixed_matches_played" integer DEFAULT 0
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_guest_player"("p_full_name" "text", "p_gender" "text" DEFAULT NULL::"text") RETURNS "public"."players"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_guest_player"("p_full_name" "text", "p_gender" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_recalc"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  m_record RECORD;
  v_config JSONB;
  p1_matches INTEGER;
  p1_d_e INTEGER; p1_d_m INTEGER;
  p3_d_e INTEGER;
  team1_elo NUMERIC; team2_elo NUMERIC;
  team1_expected NUMERIC;
  change_p1 INTEGER;
BEGIN
  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config';
  
  FOR m_record IN 
    SELECT tm.* FROM tournament_matches tm WHERE player1_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b' OR player2_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b'
  LOOP
    RAISE NOTICE 'Match ID: %, Category: %', m_record.id, m_record.category;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."debug_recalc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_guest_player"("p_guest_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."delete_guest_player"("p_guest_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_player_match_session"("p_match_id" "uuid", "p_match_source" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN DELETE FROM match_motion_stats WHERE match_id = p_match_id AND match_source = p_match_source AND recorded_by = auth.uid(); DELETE FROM match_sensor_analytics WHERE match_id = p_match_id AND match_source = p_match_source AND player_id = auth.uid(); DELETE FROM match_health_data WHERE match_id = p_match_id AND match_source = p_match_source AND player_id = auth.uid(); DELETE FROM match_stroke_analytics WHERE match_id = p_match_id AND match_source = p_match_source AND processed_by = auth.uid(); DELETE FROM match_rally_stats WHERE match_id = p_match_id AND match_source = p_match_source AND player_id = auth.uid(); END; $$;


ALTER FUNCTION "public"."delete_player_match_session"("p_match_id" "uuid", "p_match_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fulfill_marketplace_request"("listing_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_true_claimer_name TEXT;
BEGIN
  -- IDENTITY CHECK: Ensure you can only claim AS yourself
  IF claimer_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only claim marketplace listings for yourself.';
  END IF;

  -- SECURE RESOLUTION: Ignore client parameter, fetch the true name from DB
  SELECT full_name INTO v_true_claimer_name 
  FROM public.players 
  WHERE id = auth.uid();

  UPDATE public.marketplace_listings
  SET 
    fulfilled_by_id = claimer_id,
    fulfilled_by_name = v_true_claimer_name,
    status = 'sold'
  WHERE id = listing_uuid AND listing_type = 'buy' AND fulfilled_by_id IS NULL;
END;
$$;


ALTER FUNCTION "public"."fulfill_marketplace_request"("listing_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_court_popularity"() RETURNS TABLE("day_of_week" smallint, "hour" smallint, "visit_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT 
    day_of_week, 
    hour, 
    COUNT(*) AS visit_count 
  FROM public.court_visits 
  GROUP BY day_of_week, hour;
$$;


ALTER FUNCTION "public"."get_court_popularity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN 1.0 / (1.0 + POWER(10.0, (p_opponent_elo - p_team_elo) / 400.0));
END;
$$;


ALTER FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_k_factor"("p_matches" integer, "p_config" "jsonb") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_prov_thresh INTEGER := COALESCE((p_config->>'provisional_threshold')::INTEGER, 10);
  v_vet_thresh  INTEGER := COALESCE((p_config->>'veteran_threshold')::INTEGER, 30);
BEGIN
  IF p_matches < v_prov_thresh THEN RETURN COALESCE((p_config->>'k_factor_provisional')::NUMERIC, 40.0); END IF;
  IF p_matches > v_vet_thresh THEN RETURN COALESCE((p_config->>'k_factor_veteran')::NUMERIC, 24.0); END IF;
  RETURN COALESCE((p_config->>'k_factor_established')::NUMERIC, 32.0);
END;
$$;


ALTER FUNCTION "public"."get_k_factor"("p_matches" integer, "p_config" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_match_dominance"("p_sets" "text"[]) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
DECLARE
  set_str TEXT;
  scores TEXT[];
  score1 INTEGER;
  score2 INTEGER;
  margin INTEGER;
  avg_margin NUMERIC;
  total_margin INTEGER := 0;
  valid_sets INTEGER := 0;
BEGIN
  IF p_sets IS NULL OR array_length(p_sets, 1) = 0 THEN
    RETURN 1.0;
  END IF;

  FOREACH set_str IN ARRAY p_sets LOOP
    -- Validation: must match digits-digits
    IF set_str ~ '^\d+-\d+$' THEN
      scores := string_to_array(set_str, '-');
      BEGIN
        score1 := scores[1]::INTEGER;
        score2 := scores[2]::INTEGER;
        margin := abs(score1 - score2);
        total_margin := total_margin + margin;
        valid_sets := valid_sets + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Ignore parsing errors
      END;
    END IF;
  END LOOP;

  IF valid_sets = 0 THEN
    RETURN 1.0;
  END IF;

  avg_margin := total_margin::NUMERIC / valid_sets;

  IF avg_margin >= 10 THEN
    RETURN 1.15; -- Domination (e.g., 21-11 or worse)
  ELSIF avg_margin >= 6 THEN
    RETURN 1.05; -- Solid win (e.g., 21-15)
  ELSIF avg_margin <= 3 THEN
    RETURN 0.90; -- Grind/close match (e.g., 21-19, 21-18)
  ELSE
    RETURN 1.0;  -- Standard win (e.g., 21-17)
  END IF;
END;
$_$;


ALTER FUNCTION "public"."get_match_dominance"("p_sets" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_set_multiplier"("p_sets" "text"[]) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  num_sets INTEGER;
BEGIN
  IF p_sets IS NULL OR array_length(p_sets, 1) = 0 THEN
    RETURN 1.0; -- Default
  END IF;
  num_sets := array_length(p_sets, 1);
  IF num_sets = 1 THEN RETURN 0.75; END IF;
  IF num_sets = 2 THEN RETURN 1.15; END IF;
  RETURN 1.0;
END;
$$;


ALTER FUNCTION "public"."get_set_multiplier"("p_sets" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_venue_active_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ SELECT count(*)::integer FROM ( SELECT DISTINCT ON (player_id) player_id, event_type, created_at FROM public.venue_presence_events ORDER BY player_id, created_at DESC ) latest WHERE latest.event_type = 'enter' AND latest.created_at > now() - interval '3 hours'; $$;


ALTER FUNCTION "public"."get_venue_active_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_venue_hourly_pattern"("days_back" integer DEFAULT 7) RETURNS TABLE("hour_of_day" integer, "avg_checkins" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    h.hour_of_day,
    coalesce(round(avg(daily.checkins), 1), 0) AS avg_checkins
  FROM generate_series(0, 23) AS h(hour_of_day)
  LEFT JOIN (
    SELECT
      extract(hour FROM created_at)::integer AS hour_of_day,
      date_trunc('day', created_at) AS day,
      count(*) AS checkins
    FROM public.venue_presence_events
    WHERE event_type = 'enter'
      AND created_at > now() - (LEAST(days_back, 14) || ' days')::interval
    GROUP BY 1, 2
  ) daily ON daily.hour_of_day = h.hour_of_day
  GROUP BY h.hour_of_day
  ORDER BY h.hour_of_day;
$$;


ALTER FUNCTION "public"."get_venue_hourly_pattern"("days_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_deleted_tournament"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.status = 'deleted' AND OLD.status != 'deleted' THEN
    DELETE FROM tournament_matches WHERE tournament_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_deleted_tournament"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- RBAC CHECK: Only Admins and Umpires can manipulate live match scores
  IF NOT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can manipulate match scores.';
  END IF;

  UPDATE matches
  SET score = jsonb_set(
                jsonb_set(COALESCE(score, '{"p1":0, "p2":0}'::jsonb), '{p1}', (COALESCE((score->>'p1')::int, 0) + p1_increment)::text::jsonb),
                '{p2}', (COALESCE((score->>'p2')::int, 0) + p2_increment)::text::jsonb
              )
  WHERE id = match_id;
END;
$$;


ALTER FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT 
    (p_auth_uid = p_target_player) AND (
      (p_match_source = 'practice') OR
      (p_match_source = 'tournament' AND EXISTS (
        SELECT 1 FROM tournament_matches tm
        WHERE tm.id = p_match_id
        AND p_auth_uid IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
      )) OR
      (p_match_source = 'friendly' AND EXISTS (
        SELECT 1 FROM matches m
        WHERE m.id = p_match_id
        AND p_auth_uid IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id)
      )) OR
      EXISTS (SELECT 1 FROM public.players WHERE id = p_auth_uid AND role IN ('admin', 'master_admin', 'umpire'))
    );
$$;


ALTER FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_label_to_player"("p_label" "text", "p_player_id" "uuid", "p_partner_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_updated INT := 0;
  v_tmp     INT;
BEGIN
  -- Only admins
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Link team1 slots that have the label but no player
  UPDATE tournament_matches
  SET player1_id  = p_player_id,
      player3_id  = COALESCE(p_partner_id, player3_id),
      team1_label = NULL
  WHERE team1_label ILIKE p_label
    AND player1_id IS NULL;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_updated := v_updated + v_tmp;

  -- Link team2 slots
  UPDATE tournament_matches
  SET player2_id  = p_player_id,
      player4_id  = COALESCE(p_partner_id, player4_id),
      team2_label = NULL
  WHERE team2_label ILIKE p_label
    AND player2_id IS NULL;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_updated := v_updated + v_tmp;

  -- Link tournament_participants with matching display_name
  UPDATE tournament_participants
  SET player_id    = p_player_id,
      partner_id   = COALESCE(p_partner_id, partner_id),
      display_name = NULL
  WHERE display_name ILIKE p_label
    AND player_id IS NULL;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_updated := v_updated + v_tmp;

  RETURN v_updated;
END;
$$;


ALTER FUNCTION "public"."link_label_to_player"("p_label" "text", "p_player_id" "uuid", "p_partner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_players_on_match_confirm"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  notif_title    TEXT;
  notif_message  TEXT;
  recipient      UUID;
  recipients     UUID[];
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    notif_title   := CASE WHEN NEW.is_friendly THEN '🏸 Friendly Match Accepted' ELSE '🏸 Tournament Match Accepted' END;
    notif_message := 'Your match was confirmed! ELO and Stats updated.';

    recipients := ARRAY(
      SELECT DISTINCT pid
      FROM unnest(ARRAY[
        NEW.player1_id,
        NEW.player2_id,
        NEW.team1_partner_id,
        NEW.team2_partner_id
      ]) AS pid
      WHERE pid IS NOT NULL
    );

    FOREACH recipient IN ARRAY recipients LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link, is_read)
      VALUES (recipient, notif_title, notif_message, 'match_confirmation', '/my-matches', false);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_players_on_match_confirm"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_players_on_match_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  submitter_name TEXT;
  is_friendly    BOOLEAN;
  notif_title    TEXT;
  notif_message  TEXT;
  recipient      UUID;
  recipients     UUID[];
BEGIN
  SELECT full_name INTO submitter_name
  FROM public.players
  WHERE id = NEW.submitted_by;

  submitter_name := COALESCE(submitter_name, 'Someone');
  is_friendly    := COALESCE(NEW.is_friendly, true);

  notif_title   := CASE WHEN is_friendly THEN '🏸 Friendly Match Logged' ELSE '🏸 Tournament Match Logged' END;
  notif_message := submitter_name || ' logged a '
                   || CASE WHEN is_friendly THEN 'friendly' ELSE 'tournament' END
                   || ' match against you. Tap to confirm.';

  recipients := ARRAY(
    SELECT DISTINCT pid
    FROM unnest(ARRAY[
      NEW.player1_id,
      NEW.player2_id,
      NEW.team1_partner_id,
      NEW.team2_partner_id
    ]) AS pid
    WHERE pid IS NOT NULL
      AND pid <> NEW.submitted_by
  );

  FOREACH recipient IN ARRAY recipients LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link, is_read)
    VALUES (recipient, notif_title, notif_message, 'match_logged', '/my-matches', false);
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_players_on_match_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_tournament_bracket_progression"("p_match_id" "uuid", "p_winner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- We just delegate to the newer function which only requires the match_id
  PERFORM advance_tournament_winner(p_match_id);
END;
$$;


ALTER FUNCTION "public"."process_tournament_bracket_progression"("p_match_id" "uuid", "p_winner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_player_sensitive_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- If any sensitive columns have been modified
  IF NEW.role IS DISTINCT FROM OLD.role OR
     NEW.is_guest IS DISTINCT FROM OLD.is_guest OR
     NEW.is_approved IS DISTINCT FROM OLD.is_approved OR
     NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
     
     -- Check if current user is an admin or master_admin, or if it's the service role
     IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
       v_email := current_setting('request.jwt.claims', true)::json->>'email';
       
       IF v_email IN ('admin@iisc.ac.in', 'iiscbadmintonclub@gmail.com', 'janmejayraja@iisc.ac.in', 'janmejay@iisc.ac.in', 'raja79sharma@gmail.com') THEN
         -- It's a hardcoded master admin email, allow it!
         NULL;
       ELSIF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
         -- Revert the sensitive changes silently instead of throwing an error,
         -- so standard users can still update their bio/nickname in the same REST call if their client sends the full object.
         NEW.role = OLD.role;
         NEW.is_guest = OLD.is_guest;
         NEW.is_approved = OLD.is_approved;
         NEW.deleted_at = OLD.deleted_at;
       END IF;
     END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_player_sensitive_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."push_match_alert"("p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('match_alert', jsonb_build_object('message', p_message, 'time', extract(epoch from now()) * 1000))
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('message', p_message, 'time', extract(epoch from now()) * 1000);
END;
$$;


ALTER FUNCTION "public"."push_match_alert"("p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."push_match_alert"("p_message" "text", "p_title" "text" DEFAULT '🏸 Live Match Score'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('match_alert', jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000))
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('title', p_title, 'message', p_message, 'time', extract(epoch from now()) * 1000);
END;
$$;


ALTER FUNCTION "public"."push_match_alert"("p_message" "text", "p_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_all_elo"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m_record RECORD;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Reset all ELOs to base 1200 and matches played to 0
  UPDATE players SET 
    singles_matches_played = 0,
    doubles_matches_played = 0,
    mixed_matches_played = 0,
    singles_elo = 1200, 
    doubles_elo = 1200, 
    mixed_elo = 1200,
    tournament_singles_elo = 1200,
    tournament_doubles_elo = 1200,
    tournament_mixed_elo = 1200,
    elo_rating = 1200,
    tournament_elo = 1200
  WHERE id IS NOT NULL;

  -- Clear all calculation logs (satisfy safeupdate extension)
  DELETE FROM elo_calculation_logs WHERE id IS NOT NULL;

  -- Reset matches table ELO changes (friendly matches give 0 ELO)
  UPDATE matches SET elo_change_p1 = 0, elo_change_p2 = 0, elo_change_p3 = 0, elo_change_p4 = 0 WHERE status = 'completed';

  -- Process Tournament Matches
  PERFORM recalculate_tournament_elo();

END;
$$;


ALTER FUNCTION "public"."recalculate_all_elo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_category_records"("player_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  s_wins  INT := 0; s_losses  INT := 0;
  d_wins  INT := 0; d_losses  INT := 0;
  xd_wins INT := 0; xd_losses INT := 0;
BEGIN
  -- ADMIN CHECK
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admins can trigger system-wide recalculations';
    END IF;
  END IF;

  -- Singles
  SELECT
    COUNT(*) FILTER (WHERE
      (player1_id = player_uuid AND winner_id = player1_id) OR
      (player2_id = player_uuid AND winner_id = player2_id)
    ),
    COUNT(*) FILTER (WHERE
      (player1_id = player_uuid AND winner_id <> player1_id) OR
      (player2_id = player_uuid AND winner_id <> player2_id)
    )
  INTO s_wins, s_losses
  FROM matches m
  WHERE m.status = 'confirmed'
    AND m.team1_partner_id IS NULL AND m.team2_partner_id IS NULL
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid);

  -- Doubles (Same Gender)
  SELECT
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) = (SELECT gender FROM players WHERE id = m.team1_partner_id))
        AND ((SELECT gender FROM players WHERE id = m.player2_id) = (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) = (SELECT gender FROM players WHERE id = m.team1_partner_id))
        AND ((SELECT gender FROM players WHERE id = m.player2_id) = (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO d_wins, d_losses
  FROM matches m
  WHERE m.status = 'confirmed'
    AND m.team1_partner_id IS NOT NULL AND m.team2_partner_id IS NOT NULL
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid);

  -- Mixed Doubles
  SELECT
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) <> (SELECT gender FROM players WHERE id = m.team1_partner_id))
        OR ((SELECT gender FROM players WHERE id = m.player2_id) <> (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id))
    ),
    COUNT(*) FILTER (WHERE
      (
        ((SELECT gender FROM players WHERE id = m.player1_id) <> (SELECT gender FROM players WHERE id = m.team1_partner_id))
        OR ((SELECT gender FROM players WHERE id = m.player2_id) <> (SELECT gender FROM players WHERE id = m.team2_partner_id))
      )
      AND (
        (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid)
        AND m.winner_id <> m.player1_id
        AND m.winner_id <> COALESCE(m.team1_partner_id, '00000000-0000-0000-0000-000000000000'::UUID)) OR
        ((m.player2_id = player_uuid OR m.team2_partner_id = player_uuid)
        AND m.winner_id <> m.player2_id
        AND m.winner_id <> COALESCE(m.team2_partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
    )
  INTO xd_wins, xd_losses
  FROM matches m
  WHERE m.status = 'confirmed'
    AND m.team1_partner_id IS NOT NULL AND m.team2_partner_id IS NOT NULL
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid);

  UPDATE players
  SET
    singles_record = COALESCE(s_wins, 0) || 'W - ' || COALESCE(s_losses, 0) || 'L',
    doubles_record = COALESCE(d_wins, 0) || 'W - ' || COALESCE(d_losses, 0) || 'L',
    mixed_record   = COALESCE(xd_wins, 0) || 'W - ' || COALESCE(xd_losses, 0) || 'L'
  WHERE id = player_uuid;
END;
$$;


ALTER FUNCTION "public"."recalculate_category_records"("player_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_player_all_records"("player_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  overall_wins INT := 0;
  overall_losses INT := 0;
BEGIN
  -- ADMIN CHECK
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admins can trigger system-wide recalculations';
    END IF;
  END IF;

  SELECT 
    COUNT(*) FILTER (
      WHERE ( (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
         OR ( (m.player2_id = player_uuid OR m.team2_partner_id = player_uuid) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
    ),
    COUNT(*) FILTER (
      WHERE ( (m.player1_id = player_uuid OR m.team1_partner_id = player_uuid) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
         OR ( (m.player2_id = player_uuid OR m.team2_partner_id = player_uuid) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
    )
  INTO overall_wins, overall_losses
  FROM matches m
  WHERE m.status = 'confirmed' 
    AND (m.player1_id = player_uuid OR m.player2_id = player_uuid OR m.team1_partner_id = player_uuid OR m.team2_partner_id = player_uuid);

  UPDATE players
  SET 
    win_loss_record = COALESCE(overall_wins, 0) || 'W - ' || COALESCE(overall_losses, 0) || 'L',
    total_friendly_matches = COALESCE(overall_wins, 0) + COALESCE(overall_losses, 0)
  WHERE id = player_uuid;

  PERFORM recalculate_category_records(player_uuid);
END;
$$;


ALTER FUNCTION "public"."recalculate_player_all_records"("player_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_tournament_elo"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m_record RECORD;
  v_config JSONB;
  
  p1_matches INTEGER; p2_matches INTEGER; p3_matches INTEGER; p4_matches INTEGER;
  p1_elo INTEGER; p2_elo INTEGER; p3_elo INTEGER; p4_elo INTEGER;
  p1_s_m INTEGER; p2_s_m INTEGER; p3_s_m INTEGER; p4_s_m INTEGER;
  p1_d_m INTEGER; p2_d_m INTEGER; p3_d_m INTEGER; p4_d_m INTEGER;
  p1_m_m INTEGER; p2_m_m INTEGER; p3_m_m INTEGER; p4_m_m INTEGER;
  p1_s_e INTEGER; p2_s_e INTEGER; p3_s_e INTEGER; p4_s_e INTEGER;
  p1_d_e INTEGER; p2_d_e INTEGER; p3_d_e INTEGER; p4_d_e INTEGER;
  p1_m_e INTEGER; p2_m_e INTEGER; p3_m_e INTEGER; p4_m_e INTEGER;
  
  -- Track previous category ELO for the log
  prev_p1_cat_elo INTEGER; prev_p2_cat_elo INTEGER;
  prev_p3_cat_elo INTEGER; prev_p4_cat_elo INTEGER;
  
  change_p1 INTEGER; change_p2 INTEGER; change_p3 INTEGER; change_p4 INTEGER;

  team1_elo NUMERIC; team2_elo NUMERIC;
  team1_expected NUMERIC; team2_expected NUMERIC;
  team1_actual NUMERIC; team2_actual NUMERIC;

  v_is_singles BOOLEAN; v_is_doubles BOOLEAN; v_is_mixed BOOLEAN;
  v_category TEXT;
  
  v_t_mult NUMERIC;
  v_s_mult NUMERIC;
  v_d_mult NUMERIC;
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config' LIMIT 1;
  IF v_config IS NULL THEN v_config := '{}'::jsonb; END IF;

  FOR m_record IN 
    SELECT tm.* FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    WHERE tm.status = 'completed' AND t.status != 'deleted'
      -- Skip BYE matches - both players must exist for a real match
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
      -- Skip matches without a definitive winner
      AND tm.winner_id IS NOT NULL
    ORDER BY tm.scored_at ASC 
  LOOP
    v_category := COALESCE(m_record.category, 'Singles');
    v_is_singles := v_category ILIKE '%MS%' OR v_category ILIKE '%WS%' OR v_category ILIKE '%Singles%';
    v_is_doubles := v_category ILIKE '%MD%' OR v_category ILIKE '%WD%' OR v_category ILIKE '%Doubles%';
    v_is_mixed := v_category ILIKE '%XD%' OR v_category ILIKE '%Mixed%';

    -- Fetch P1
    SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
           singles_elo, doubles_elo, mixed_elo, elo_rating 
    INTO p1_s_m, p1_d_m, p1_m_m, p1_s_e, p1_d_e, p1_m_e, p1_elo
    FROM players WHERE id = m_record.player1_id;
    -- Coalesce in case player data is missing
    p1_s_m := COALESCE(p1_s_m, 0); p1_d_m := COALESCE(p1_d_m, 0); p1_m_m := COALESCE(p1_m_m, 0);
    p1_s_e := COALESCE(p1_s_e, 1200); p1_d_e := COALESCE(p1_d_e, 1200); p1_m_e := COALESCE(p1_m_e, 1200); p1_elo := COALESCE(p1_elo, 1200);

    -- Fetch P2
    SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
           singles_elo, doubles_elo, mixed_elo, elo_rating 
    INTO p2_s_m, p2_d_m, p2_m_m, p2_s_e, p2_d_e, p2_m_e, p2_elo
    FROM players WHERE id = m_record.player2_id;
    p2_s_m := COALESCE(p2_s_m, 0); p2_d_m := COALESCE(p2_d_m, 0); p2_m_m := COALESCE(p2_m_m, 0);
    p2_s_e := COALESCE(p2_s_e, 1200); p2_d_e := COALESCE(p2_d_e, 1200); p2_m_e := COALESCE(p2_m_e, 1200); p2_elo := COALESCE(p2_elo, 1200);

    -- Fetch P3 (team1 partner in doubles/mixed)
    p3_s_m := 0; p3_d_m := 0; p3_m_m := 0;
    p3_s_e := 1200; p3_d_e := 1200; p3_m_e := 1200; p3_elo := 1200;
    IF m_record.player3_id IS NOT NULL THEN
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
             singles_elo, doubles_elo, mixed_elo, elo_rating 
      INTO p3_s_m, p3_d_m, p3_m_m, p3_s_e, p3_d_e, p3_m_e, p3_elo
      FROM players WHERE id = m_record.player3_id;
      p3_s_m := COALESCE(p3_s_m, 0); p3_d_m := COALESCE(p3_d_m, 0); p3_m_m := COALESCE(p3_m_m, 0);
      p3_s_e := COALESCE(p3_s_e, 1200); p3_d_e := COALESCE(p3_d_e, 1200); p3_m_e := COALESCE(p3_m_e, 1200); p3_elo := COALESCE(p3_elo, 1200);
    END IF;

    -- Fetch P4 (team2 partner in doubles/mixed)
    p4_s_m := 0; p4_d_m := 0; p4_m_m := 0;
    p4_s_e := 1200; p4_d_e := 1200; p4_m_e := 1200; p4_elo := 1200;
    IF m_record.player4_id IS NOT NULL THEN
      SELECT singles_matches_played, doubles_matches_played, mixed_matches_played,
             singles_elo, doubles_elo, mixed_elo, elo_rating 
      INTO p4_s_m, p4_d_m, p4_m_m, p4_s_e, p4_d_e, p4_m_e, p4_elo
      FROM players WHERE id = m_record.player4_id;
      p4_s_m := COALESCE(p4_s_m, 0); p4_d_m := COALESCE(p4_d_m, 0); p4_m_m := COALESCE(p4_m_m, 0);
      p4_s_e := COALESCE(p4_s_e, 1200); p4_d_e := COALESCE(p4_d_e, 1200); p4_m_e := COALESCE(p4_m_e, 1200); p4_elo := COALESCE(p4_elo, 1200);
    END IF;

    -- Snapshot category ELOs BEFORE the change for accurate log entries
    IF v_is_singles THEN
      prev_p1_cat_elo := p1_s_e; prev_p2_cat_elo := p2_s_e;
      team1_elo := p1_s_e; team2_elo := p2_s_e;
      p1_matches := p1_s_m; p2_matches := p2_s_m;
    ELSIF v_is_doubles THEN
      prev_p1_cat_elo := p1_d_e; prev_p2_cat_elo := p2_d_e;
      prev_p3_cat_elo := p3_d_e; prev_p4_cat_elo := p4_d_e;
      team1_elo := (p1_d_e + p3_d_e) / 2.0; team2_elo := (p2_d_e + p4_d_e) / 2.0;
      p1_matches := p1_d_m; p2_matches := p2_d_m;
    ELSE -- Mixed
      prev_p1_cat_elo := p1_m_e; prev_p2_cat_elo := p2_m_e;
      prev_p3_cat_elo := p3_m_e; prev_p4_cat_elo := p4_m_e;
      team1_elo := (p1_m_e + p3_m_e) / 2.0; team2_elo := (p2_m_e + p4_m_e) / 2.0;
      p1_matches := p1_m_m; p2_matches := p2_m_m;
    END IF;

    -- Expected and actual scores
    team1_expected := 1.0 / (1.0 + POWER(10, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + POWER(10, (team1_elo - team2_elo) / 400.0));
    team1_actual := CASE WHEN m_record.winner_id = m_record.player1_id OR m_record.winner_id = m_record.player3_id THEN 1.0 ELSE 0.0 END;
    team2_actual := CASE WHEN m_record.winner_id = m_record.player2_id OR m_record.winner_id = m_record.player4_id THEN 1.0 ELSE 0.0 END;

    -- Multipliers
    v_t_mult := COALESCE((v_config->>'tournament_multiplier_club')::NUMERIC, 1.3);
    v_s_mult := COALESCE(get_set_multiplier(m_record.sets_history), 1.0);
    v_d_mult := COALESCE(get_match_dominance(m_record.sets_history), 1.0);

    -- Update P1
    change_p1 := ROUND(COALESCE(get_k_factor(p1_matches, v_config), 40) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p1_s_m := p1_s_m + 1; p1_s_e := GREATEST(100, p1_s_e + change_p1);
    ELSIF v_is_doubles THEN p1_d_m := p1_d_m + 1; p1_d_e := GREATEST(100, p1_d_e + change_p1);
    ELSE p1_m_m := p1_m_m + 1; p1_m_e := GREATEST(100, p1_m_e + change_p1); END IF;
    p1_elo := COALESCE(calculate_overall_elo(p1_s_e, p1_s_m, p1_d_e, p1_d_m, p1_m_e, p1_m_m), 1200);
    UPDATE players SET 
      singles_matches_played = p1_s_m, doubles_matches_played = p1_d_m, mixed_matches_played = p1_m_m,
      singles_elo = p1_s_e, doubles_elo = p1_d_e, mixed_elo = p1_m_e, elo_rating = p1_elo
    WHERE id = m_record.player1_id;
    -- Log the CATEGORY ELO change (not overall)
    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (m_record.id, m_record.player1_id, 
      prev_p1_cat_elo, 
      CASE WHEN v_is_singles THEN p1_s_e WHEN v_is_doubles THEN p1_d_e ELSE p1_m_e END,
      change_p1, team1_expected, team1_actual, v_category);

    -- Update P2
    change_p2 := ROUND(COALESCE(get_k_factor(p2_matches, v_config), 40) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p2_s_m := p2_s_m + 1; p2_s_e := GREATEST(100, p2_s_e + change_p2);
    ELSIF v_is_doubles THEN p2_d_m := p2_d_m + 1; p2_d_e := GREATEST(100, p2_d_e + change_p2);
    ELSE p2_m_m := p2_m_m + 1; p2_m_e := GREATEST(100, p2_m_e + change_p2); END IF;
    p2_elo := COALESCE(calculate_overall_elo(p2_s_e, p2_s_m, p2_d_e, p2_d_m, p2_m_e, p2_m_m), 1200);
    UPDATE players SET 
      singles_matches_played = p2_s_m, doubles_matches_played = p2_d_m, mixed_matches_played = p2_m_m,
      singles_elo = p2_s_e, doubles_elo = p2_d_e, mixed_elo = p2_m_e, elo_rating = p2_elo
    WHERE id = m_record.player2_id;
    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (m_record.id, m_record.player2_id, 
      prev_p2_cat_elo,
      CASE WHEN v_is_singles THEN p2_s_e WHEN v_is_doubles THEN p2_d_e ELSE p2_m_e END,
      change_p2, team2_expected, team2_actual, v_category);

    -- Update P3 (if it's a doubles/mixed match)
    IF m_record.player3_id IS NOT NULL THEN
      p3_matches := COALESCE(CASE WHEN v_is_doubles THEN p3_d_m ELSE p3_m_m END, 0);
      change_p3 := ROUND(COALESCE(get_k_factor(p3_matches, v_config), 40) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
      IF v_is_doubles THEN p3_d_m := p3_d_m + 1; p3_d_e := GREATEST(100, p3_d_e + change_p3);
      ELSE p3_m_m := p3_m_m + 1; p3_m_e := GREATEST(100, p3_m_e + change_p3); END IF;
      p3_elo := COALESCE(calculate_overall_elo(p3_s_e, p3_s_m, p3_d_e, p3_d_m, p3_m_e, p3_m_m), 1200);
      UPDATE players SET 
        singles_matches_played = p3_s_m, doubles_matches_played = p3_d_m, mixed_matches_played = p3_m_m,
        singles_elo = p3_s_e, doubles_elo = p3_d_e, mixed_elo = p3_m_e, elo_rating = p3_elo
      WHERE id = m_record.player3_id;
      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player3_id,
        prev_p3_cat_elo,
        CASE WHEN v_is_doubles THEN p3_d_e ELSE p3_m_e END,
        change_p3, team1_expected, team1_actual, v_category);
    END IF;

    -- Update P4 (if it's a doubles/mixed match)
    IF m_record.player4_id IS NOT NULL THEN
      p4_matches := COALESCE(CASE WHEN v_is_doubles THEN p4_d_m ELSE p4_m_m END, 0);
      change_p4 := ROUND(COALESCE(get_k_factor(p4_matches, v_config), 40) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
      IF v_is_doubles THEN p4_d_m := p4_d_m + 1; p4_d_e := GREATEST(100, p4_d_e + change_p4);
      ELSE p4_m_m := p4_m_m + 1; p4_m_e := GREATEST(100, p4_m_e + change_p4); END IF;
      p4_elo := COALESCE(calculate_overall_elo(p4_s_e, p4_s_m, p4_d_e, p4_d_m, p4_m_e, p4_m_m), 1200);
      UPDATE players SET 
        singles_matches_played = p4_s_m, doubles_matches_played = p4_d_m, mixed_matches_played = p4_m_m,
        singles_elo = p4_s_e, doubles_elo = p4_d_e, mixed_elo = p4_m_e, elo_rating = p4_elo
      WHERE id = m_record.player4_id;
      INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
      VALUES (m_record.id, m_record.player4_id,
        prev_p4_cat_elo,
        CASE WHEN v_is_doubles THEN p4_d_e ELSE p4_m_e END,
        change_p4, team2_expected, team2_actual, v_category);
    END IF;

  END LOOP;
END;
$$;


ALTER FUNCTION "public"."recalculate_tournament_elo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m_record RECORD;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF rejecter_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You cannot reject your own submission.';
  END IF;
  
  IF rejecter_id IS DISTINCT FROM m_record.player1_id
    AND rejecter_id IS DISTINCT FROM m_record.player2_id
    AND rejecter_id IS DISTINCT FROM m_record.team1_partner_id
    AND rejecter_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  UPDATE matches SET status = 'rejected' WHERE id = match_uuid;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  m_record RECORD;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF rejecter_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You cannot reject your own submission.';
  END IF;
  
  IF rejecter_id IS DISTINCT FROM m_record.player1_id
    AND rejecter_id IS DISTINCT FROM m_record.player2_id
    AND rejecter_id IS DISTINCT FROM m_record.team1_partner_id
    AND rejecter_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  UPDATE matches SET status = 'rejected' WHERE id = match_uuid;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_buddy"("p_target_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), p_target_id::text) WHERE id = v_my_id;
  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), v_my_id::text)     WHERE id = p_target_id;
END;
$$;


ALTER FUNCTION "public"."remove_buddy"("p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_live_match_by_id"("p_match_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  -- Any authenticated user can remove a live match entry (they can only clean up their own friendly sessions)
  -- Admins and Umpires can remove any match
  UPDATE site_data
  SET value = value - p_match_id
  WHERE key = 'live_matches';
END;
$$;


ALTER FUNCTION "public"."remove_live_match_by_id"("p_match_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollback_elo_on_match_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- We only roll back ELO if the match was confirmed (meaning ELO was actually applied)
  IF OLD.status = 'confirmed' AND OLD.is_friendly = true THEN
    
    -- Roll back Player 1
    IF OLD.player1_id IS NOT NULL AND OLD.elo_change_p1 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p1,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p1 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p1 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p1 ELSE mixed_elo END
      WHERE id = OLD.player1_id;
    END IF;

    -- Roll back Player 2
    IF OLD.player2_id IS NOT NULL AND OLD.elo_change_p2 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p2,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p2 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p2 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p2 ELSE mixed_elo END
      WHERE id = OLD.player2_id;
    END IF;

    -- Roll back Player 3 (Team 1 Partner)
    IF OLD.team1_partner_id IS NOT NULL AND OLD.elo_change_p3 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p3,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p3 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p3 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p3 ELSE mixed_elo END
      WHERE id = OLD.team1_partner_id;
    END IF;

    -- Roll back Player 4 (Team 2 Partner)
    IF OLD.team2_partner_id IS NOT NULL AND OLD.elo_change_p4 IS NOT NULL THEN
      UPDATE players 
      SET elo_rating = elo_rating - OLD.elo_change_p4,
          singles_elo = CASE WHEN OLD.category IN ('Singles', 'Men''s Singles', 'Women''s Singles', 'MS', 'WS') THEN singles_elo - OLD.elo_change_p4 ELSE singles_elo END,
          doubles_elo = CASE WHEN OLD.category IN ('Doubles', 'Men''s Doubles', 'Women''s Doubles', 'MD', 'WD', 'Mixed Doubles', 'XD') THEN doubles_elo - OLD.elo_change_p4 ELSE doubles_elo END,
          mixed_elo = CASE WHEN OLD.category IN ('Mixed Doubles', 'Mixed Singles', 'XD') THEN mixed_elo - OLD.elo_change_p4 ELSE mixed_elo END
      WHERE id = OLD.team2_partner_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."rollback_elo_on_match_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_append(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id
    AND NOT (v_my_id::text = ANY(COALESCE(buddy_requests, ARRAY[]::TEXT[])));
END;
$$;


ALTER FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_ping_notification"("p_target_id" "uuid", "p_sender_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF auth.uid() = p_target_id THEN RAISE EXCEPTION 'Cannot ping yourself'; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    p_target_id,
    'Match Request (Ping)!',
    p_sender_name || ' is looking to play a match with you!',
    'ping',
    '/player/' || auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."send_ping_notification"("p_target_id" "uuid", "p_sender_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_player_role"("p_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Authenticate and strictly authorize ONLY master_admin
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'master_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only master_admin can change user roles.';
  END IF;

  -- Validate role input
  IF p_role NOT IN ('user', 'umpire', 'admin', 'master_admin') THEN
    RAISE EXCEPTION 'Invalid role specified. Must be user, umpire, admin, or master_admin.';
  END IF;

  -- Prevent removing the last master_admin (safety check)
  IF p_role != 'master_admin' AND (SELECT role FROM public.players WHERE id = p_id) = 'master_admin' THEN
    IF (SELECT COUNT(*) FROM public.players WHERE role = 'master_admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last master_admin in the system.';
    END IF;
  END IF;

  -- Update the player's role
  UPDATE public.players SET role = p_role WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."set_player_role"("p_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tournament_match_times"("p_match_id" "uuid", "p_started_at" timestamp with time zone, "p_ended_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_umpired_by UUID;
  v_is_authorized BOOLEAN := false;
BEGIN
  SELECT umpired_by INTO v_umpired_by FROM tournament_matches WHERE id = p_match_id;
  
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin','master_admin','umpire')
  ) THEN
    v_is_authorized := true;
  ELSIF auth.uid() = v_umpired_by THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE tournament_matches
  SET started_at = COALESCE(started_at, p_started_at),
      ended_at = COALESCE(ended_at, p_ended_at)
  WHERE id = p_match_id;
END;
$$;


ALTER FUNCTION "public"."set_tournament_match_times"("p_match_id" "uuid", "p_started_at" timestamp with time zone, "p_ended_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Verify auth.uid() is an admin
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can delete players.';
  END IF;

  -- Ensure not deleting master_admin unless you are one
  IF EXISTS (SELECT 1 FROM public.players WHERE id = target_player_id AND role = 'master_admin') THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'master_admin') THEN
      RAISE EXCEPTION 'Unauthorized: only master_admin can delete another master_admin.';
    END IF;
  END IF;

  -- Soft delete by setting deleted_at
  UPDATE public.players SET deleted_at = NOW() WHERE id = target_player_id;

  -- Clean up active relationships to prevent showing up in feeds
  -- Withdraw any pending matches
  UPDATE public.matches SET status = 'rejected' 
  WHERE status = 'pending' AND (player1_id = target_player_id OR player2_id = target_player_id OR team1_partner_id = target_player_id OR team2_partner_id = target_player_id);

  -- Remove buddy relationships
  UPDATE public.players SET buddies = array_remove(buddies, target_player_id::text) WHERE target_player_id::text = ANY(buddies);
  UPDATE public.players SET buddies = '{}' WHERE id = target_player_id;
  
  -- Clear buddy requests
  UPDATE public.players SET buddy_requests = array_remove(buddy_requests, target_player_id::text) WHERE target_player_id::text = ANY(buddy_requests);
  UPDATE public.players SET buddy_requests = '{}' WHERE id = target_player_id;

END;
$$;


ALTER FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Strict Admin check
  IF admin_email != 'iiscbadmintonclub@gmail.com' AND admin_email != 'janmejayraja@iisc.ac.in' AND admin_email != 'raja79sharma@' THEN
    RAISE EXCEPTION 'Unauthorized: Only verified admins can delete players.';
  END IF;

  -- Verify player exists
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = player_id) THEN
    RAISE EXCEPTION 'Player not found.';
  END IF;

  -- Mark as deleted
  UPDATE players SET deleted_at = NOW() WHERE id = player_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text" DEFAULT NULL::"text", "opponent_partner_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_match_id UUID;
  existing_match_id UUID;
BEGIN
  IF match_winner_id != submitter_id AND match_winner_id != opponent_id THEN
    RAISE EXCEPTION 'Winner must be one of the two players.';
  END IF;

  -- ── Dedup: return existing pending match if submitted in the last 2 hours ──
  SELECT id INTO existing_match_id
  FROM matches
  WHERE status = 'pending'
    AND created_at > now() - INTERVAL '2 hours'
    AND (
      (player1_id = submitter_id AND player2_id = opponent_id)
      OR (player1_id = opponent_id AND player2_id = submitter_id)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_match_id IS NOT NULL THEN
    RETURN existing_match_id;
  END IF;

  INSERT INTO matches (
    category,
    round,
    player1_id,
    player2_id,
    team1_partner_id,
    team2_partner_id,
    winner_id,
    score,
    date,
    is_friendly,
    status,
    submitted_by
  ) VALUES (
    CASE WHEN submitter_partner_id IS NULL AND opponent_partner_id IS NULL THEN 'Singles' ELSE 'Doubles' END,
    'Friendly',
    submitter_id,
    opponent_id,
    submitter_partner_id,
    opponent_partner_id,
    match_winner_id,
    match_score,
    CURRENT_DATE,
    true,
    'pending',
    submitter_id
  ) RETURNING id INTO new_match_id;
  
  RETURN new_match_id;
END;
$$;


ALTER FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text" DEFAULT NULL::"text", "opponent_partner_id" "text" DEFAULT NULL::"text", "is_cross_gender_singles" boolean DEFAULT false, "is_hybrid" boolean DEFAULT false, "is_mixed_category_doubles" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_match_id      UUID;
  existing_match_id UUID;
  derived_category  TEXT;
  submitter_uuid    UUID;
  opponent_uuid     UUID;
  winner_uuid       UUID;
  partner_uuid      UUID;
  opp_partner_uuid  UUID;
BEGIN
  -- Cast TEXT parameters to UUID
  submitter_uuid := submitter_id::UUID;
  opponent_uuid := opponent_id::UUID;
  winner_uuid := match_winner_id::UUID;
  partner_uuid := CASE WHEN submitter_partner_id IS NOT NULL THEN submitter_partner_id::UUID ELSE NULL END;
  opp_partner_uuid := CASE WHEN opponent_partner_id IS NOT NULL THEN opponent_partner_id::UUID ELSE NULL END;

  IF winner_uuid != submitter_uuid AND winner_uuid != opponent_uuid THEN
    RAISE EXCEPTION 'Winner must be one of the two players.';
  END IF;

  -- Dedup: return existing pending match if submitted in the last 2 hours
  SELECT id INTO existing_match_id
  FROM matches
  WHERE status = 'pending'
    AND created_at > now() - INTERVAL '2 hours'
    AND (
      (player1_id = submitter_uuid AND player2_id = opponent_uuid)
      OR (player1_id = opponent_uuid AND player2_id = submitter_uuid)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_match_id IS NOT NULL THEN
    RETURN existing_match_id;
  END IF;

  derived_category :=
    CASE
      WHEN is_hybrid THEN 'Hybrid'
      WHEN is_mixed_category_doubles THEN 'Mixed Doubles'
      WHEN partner_uuid IS NOT NULL OR opp_partner_uuid IS NOT NULL THEN 'Doubles'
      ELSE 'Singles'
    END;

  INSERT INTO matches (
    category,
    round,
    player1_id,
    player2_id,
    team1_partner_id,
    team2_partner_id,
    winner_id,
    score,
    date,
    is_friendly,
    status,
    submitted_by
  ) VALUES (
    derived_category,
    'Friendly',
    submitter_uuid,
    opponent_uuid,
    partner_uuid,
    opp_partner_uuid,
    winner_uuid,
    match_score,
    CURRENT_DATE,
    true,
    'pending',
    submitter_uuid
  ) RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$;


ALTER FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_umpire_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_winner_id   UUID; v_loser_id    UUID;
  v_match       tournament_matches%ROWTYPE;
  v_config JSONB;
  
  p1_matches INTEGER; p2_matches INTEGER; p3_matches INTEGER; p4_matches INTEGER;
  p1_elo INTEGER; p2_elo INTEGER; p3_elo INTEGER; p4_elo INTEGER;
  p1_s_m INTEGER; p2_s_m INTEGER; p3_s_m INTEGER; p4_s_m INTEGER;
  p1_d_m INTEGER; p2_d_m INTEGER; p3_d_m INTEGER; p4_d_m INTEGER;
  p1_m_m INTEGER; p2_m_m INTEGER; p3_m_m INTEGER; p4_m_m INTEGER;
  p1_s_e INTEGER; p2_s_e INTEGER; p3_s_e INTEGER; p4_s_e INTEGER;
  p1_d_e INTEGER; p2_d_e INTEGER; p3_d_e INTEGER; p4_d_e INTEGER;
  p1_m_e INTEGER; p2_m_e INTEGER; p3_m_e INTEGER; p4_m_e INTEGER;
  
  change_p1 INTEGER; change_p2 INTEGER; change_p3 INTEGER; change_p4 INTEGER;

  team1_elo NUMERIC; team2_elo NUMERIC;
  team1_expected NUMERIC; team2_expected NUMERIC;
  team1_actual NUMERIC; team2_actual NUMERIC;

  v_is_singles BOOLEAN; v_is_doubles BOOLEAN; v_is_mixed BOOLEAN;
  v_t_mult NUMERIC; v_s_mult NUMERIC; v_d_mult NUMERIC;
  v_is_authorized BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_submitter_player_id UUID;
  v_true_umpire_id UUID;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament match not found'; END IF;

  -- Resolve submitter player ID to avoid foreign key violations if auth.uid() is not in players
  SELECT id INTO v_submitter_player_id FROM players WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email')) LIMIT 1;

  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin')
  ) THEN
    v_is_authorized := true;
    v_is_admin := true;
  ELSIF EXISTS (
    SELECT 1 FROM players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role = 'umpire'
  ) THEN
    v_is_authorized := true;
  ELSIF auth.uid() = v_match.umpired_by THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Resolve true umpire ID for the same reason
  SELECT id INTO v_true_umpire_id FROM players WHERE id = p_umpire_id LIMIT 1;
  IF NOT FOUND THEN
    v_true_umpire_id := v_submitter_player_id;
  END IF;

  IF NOT v_is_admin AND v_match.locked THEN
    RAISE EXCEPTION 'Match results are locked. Contact an admin to modify.';
  END IF;

  IF NOT v_is_admin AND v_match.status = 'completed' AND v_match.scored_at IS NOT NULL AND v_match.scored_at < NOW() - INTERVAL '10 minutes' THEN
    RAISE EXCEPTION 'Match results can only be edited within 10 minutes of completion. Contact an admin.';
  END IF;

  SELECT value INTO v_config FROM site_data WHERE key = 'elo_config';
  v_t_mult := COALESCE((v_config->>'tournament_multiplier_club')::NUMERIC, 1.3);

  IF p_winner_side = 1 THEN
    v_winner_id := v_match.player1_id; v_loser_id  := v_match.player2_id;
    team1_actual := 1.0; team2_actual := 0.0;
  ELSE
    v_winner_id := v_match.player2_id; v_loser_id  := v_match.player1_id;
    team1_actual := 0.0; team2_actual := 1.0;
  END IF;

  v_is_singles := (v_match.category ILIKE '%Singles%' OR v_match.category IN ('MS','WS','BS','GS','S','SINGLES'));
  v_is_doubles := (v_match.category ILIKE '%Doubles%' OR v_match.category IN ('MD','WD','BD','GD','D','DOUBLES'));
  v_is_mixed   := (v_match.category ILIKE '%Mixed%'   OR v_match.category IN ('XD','MXD','M','MIXED'));
  
  v_s_mult := get_set_multiplier(p_sets);
  v_d_mult := get_match_dominance(p_sets);

  IF v_match.player1_id IS NOT NULL AND v_match.player2_id IS NOT NULL THEN
    SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
    INTO p1_s_m, p1_d_m, p1_m_m, p1_s_e, p1_d_e, p1_m_e FROM players WHERE id = v_match.player1_id;
    
    SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
    INTO p2_s_m, p2_d_m, p2_m_m, p2_s_e, p2_d_e, p2_m_e FROM players WHERE id = v_match.player2_id;

    IF v_is_singles THEN team1_elo := p1_s_e; team2_elo := p2_s_e; p1_matches := p1_s_m; p2_matches := p2_s_m;
    ELSIF v_is_doubles THEN team1_elo := p1_d_e; team2_elo := p2_d_e; p1_matches := p1_d_m; p2_matches := p2_d_m;
    ELSE team1_elo := p1_m_e; team2_elo := p2_m_e; p1_matches := p1_m_m; p2_matches := p2_m_m; END IF;

    IF v_is_doubles OR v_is_mixed THEN
      IF v_match.player3_id IS NOT NULL THEN
        SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
        INTO p3_s_m, p3_d_m, p3_m_m, p3_s_e, p3_d_e, p3_m_e FROM players WHERE id = v_match.player3_id;
        IF v_is_doubles THEN team1_elo := (team1_elo + p3_d_e) / 2.0; p3_matches := p3_d_m; ELSE team1_elo := (team1_elo + p3_m_e) / 2.0; p3_matches := p3_m_m; END IF;
      END IF;
      IF v_match.player4_id IS NOT NULL THEN
        SELECT COALESCE(singles_matches_played, 0), COALESCE(doubles_matches_played, 0), COALESCE(mixed_matches_played, 0), COALESCE(singles_elo, 1200), COALESCE(doubles_elo, 1200), COALESCE(mixed_elo, 1200) 
        INTO p4_s_m, p4_d_m, p4_m_m, p4_s_e, p4_d_e, p4_m_e FROM players WHERE id = v_match.player4_id;
        IF v_is_doubles THEN team2_elo := (team2_elo + p4_d_e) / 2.0; p4_matches := p4_d_m; ELSE team2_elo := (team2_elo + p4_m_e) / 2.0; p4_matches := p4_m_m; END IF;
      END IF;
    END IF;

    team1_expected := 1.0 / (1.0 + POWER(10.0, (team2_elo - team1_elo) / 400.0));
    team2_expected := 1.0 / (1.0 + POWER(10.0, (team1_elo - team2_elo) / 400.0));

    change_p1 := ROUND(get_k_factor(p1_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p1_s_m := p1_s_m + 1; p1_s_e := GREATEST(100, p1_s_e + change_p1);
    ELSIF v_is_doubles THEN p1_d_m := p1_d_m + 1; p1_d_e := GREATEST(100, p1_d_e + change_p1);
    ELSE p1_m_m := p1_m_m + 1; p1_m_e := GREATEST(100, p1_m_e + change_p1); END IF;
    p1_elo := calculate_overall_elo(p1_s_e, p1_s_m, p1_d_e, p1_d_m, p1_m_e, p1_m_m);
    
    UPDATE players SET 
      singles_matches_played = p1_s_m, doubles_matches_played = p1_d_m, mixed_matches_played = p1_m_m,
      singles_elo = p1_s_e, doubles_elo = p1_d_e, mixed_elo = p1_m_e,
      tournament_singles_elo = p1_s_e, tournament_doubles_elo = p1_d_e, tournament_mixed_elo = p1_m_e,
      elo_rating = p1_elo, tournament_elo = p1_elo
    WHERE id = v_match.player1_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (p_match_id, v_match.player1_id, p1_elo - change_p1, p1_elo, change_p1, team1_expected, team1_actual, COALESCE(v_match.category, 'Singles'));

    change_p2 := ROUND(get_k_factor(p2_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
    IF v_is_singles THEN p2_s_m := p2_s_m + 1; p2_s_e := GREATEST(100, p2_s_e + change_p2);
    ELSIF v_is_doubles THEN p2_d_m := p2_d_m + 1; p2_d_e := GREATEST(100, p2_d_e + change_p2);
    ELSE p2_m_m := p2_m_m + 1; p2_m_e := GREATEST(100, p2_m_e + change_p2); END IF;
    p2_elo := calculate_overall_elo(p2_s_e, p2_s_m, p2_d_e, p2_d_m, p2_m_e, p2_m_m);
    
    UPDATE players SET 
      singles_matches_played = p2_s_m, doubles_matches_played = p2_d_m, mixed_matches_played = p2_m_m,
      singles_elo = p2_s_e, doubles_elo = p2_d_e, mixed_elo = p2_m_e,
      tournament_singles_elo = p2_s_e, tournament_doubles_elo = p2_d_e, tournament_mixed_elo = p2_m_e,
      elo_rating = p2_elo, tournament_elo = p2_elo
    WHERE id = v_match.player2_id;

    INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
    VALUES (p_match_id, v_match.player2_id, p2_elo - change_p2, p2_elo, change_p2, team2_expected, team2_actual, COALESCE(v_match.category, 'Singles'));

    -- Player 3 & 4
    IF v_is_doubles OR v_is_mixed THEN
      IF v_match.player3_id IS NOT NULL THEN
        change_p3 := ROUND(get_k_factor(p3_matches, v_config) * (team1_actual - team1_expected) * v_t_mult * v_s_mult * v_d_mult);
        IF v_is_doubles THEN p3_d_m := p3_d_m + 1; p3_d_e := GREATEST(100, p3_d_e + change_p3);
        ELSE p3_m_m := p3_m_m + 1; p3_m_e := GREATEST(100, p3_m_e + change_p3); END IF;
        p3_elo := calculate_overall_elo(p3_s_e, p3_s_m, p3_d_e, p3_d_m, p3_m_e, p3_m_m);
        
        UPDATE players SET 
          doubles_matches_played = p3_d_m, mixed_matches_played = p3_m_m,
          doubles_elo = p3_d_e, mixed_elo = p3_m_e,
          tournament_doubles_elo = p3_d_e, tournament_mixed_elo = p3_m_e,
          elo_rating = p3_elo, tournament_elo = p3_elo
        WHERE id = v_match.player3_id;
        INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
        VALUES (p_match_id, v_match.player3_id, p3_elo - change_p3, p3_elo, change_p3, team1_expected, team1_actual, COALESCE(v_match.category, 'Doubles'));
      END IF;

      IF v_match.player4_id IS NOT NULL THEN
        change_p4 := ROUND(get_k_factor(p4_matches, v_config) * (team2_actual - team2_expected) * v_t_mult * v_s_mult * v_d_mult);
        IF v_is_doubles THEN p4_d_m := p4_d_m + 1; p4_d_e := GREATEST(100, p4_d_e + change_p4);
        ELSE p4_m_m := p4_m_m + 1; p4_m_e := GREATEST(100, p4_m_e + change_p4); END IF;
        p4_elo := calculate_overall_elo(p4_s_e, p4_s_m, p4_d_e, p4_d_m, p4_m_e, p4_m_m);
        
        UPDATE players SET 
          doubles_matches_played = p4_d_m, mixed_matches_played = p4_m_m,
          doubles_elo = p4_d_e, mixed_elo = p4_m_e,
          tournament_doubles_elo = p4_d_e, tournament_mixed_elo = p4_m_e,
          elo_rating = p4_elo, tournament_elo = p4_elo
        WHERE id = v_match.player4_id;
        INSERT INTO elo_calculation_logs (match_uuid, player_id, previous_elo, new_elo, elo_change, expected_score, actual_score, category)
        VALUES (p_match_id, v_match.player4_id, p4_elo - change_p4, p4_elo, change_p4, team2_expected, team2_actual, COALESCE(v_match.category, 'Doubles'));
      END IF;
    END IF;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    locked       = TRUE,
    umpired_by   = COALESCE(umpired_by, v_true_umpire_id),
    scored_by    = COALESCE(scored_by, v_submitter_player_id),
    scored_at    = COALESCE(scored_at, NOW())
  WHERE id = p_match_id;

  PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
END;
$$;


ALTER FUNCTION "public"."submit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_umpire_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_buddy BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_user_id = p_target_id THEN RAISE EXCEPTION 'Cannot be buddy with yourself'; END IF;

  SELECT p_target_id::text = ANY(buddies) INTO v_is_buddy
  FROM players WHERE id = v_user_id;

  IF v_is_buddy THEN
    UPDATE players SET buddies = array_remove(buddies, p_target_id::text) WHERE id = v_user_id;
  ELSE
    UPDATE players SET buddies = array_append(buddies, p_target_id::text) WHERE id = v_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_follow"("p_target_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_following BOOLEAN;
  v_follower_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_user_id = p_target_id THEN RAISE EXCEPTION 'Cannot follow yourself'; END IF;

  SELECT p_target_id::text = ANY(following) INTO v_is_following
  FROM players WHERE id = v_user_id;

  IF v_is_following THEN
    UPDATE players SET following = array_remove(following, p_target_id::text) WHERE id = v_user_id;
    UPDATE players SET followers = array_remove(followers, v_user_id::text)   WHERE id = p_target_id;
  ELSE
    UPDATE players SET following = array_append(following, p_target_id::text) WHERE id = v_user_id;
    UPDATE players SET followers = array_append(followers, v_user_id::text)   WHERE id = p_target_id;

    SELECT full_name INTO v_follower_name FROM public.players WHERE id = v_user_id;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      p_target_id,
      'New Follower',
      v_follower_name || ' started following you.',
      'new_follower',
      '/player/' || v_user_id
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_follow"("p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_player_id UUID    := auth.uid();
  v_is_liked  BOOLEAN;
BEGIN
  IF v_player_id IS NULL THEN RAISE EXCEPTION 'Not authenticated or no player profile'; END IF;

  IF EXISTS (SELECT 1 FROM matches WHERE id = p_match_id) THEN
    SELECT v_player_id::text = ANY(COALESCE(kudos_users, ARRAY[]::TEXT[])) INTO v_is_liked FROM matches WHERE id = p_match_id;
    IF v_is_liked THEN
      UPDATE matches SET kudos_users = array_remove(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text), kudos_count = GREATEST(0, COALESCE(kudos_count, 0) - 1) WHERE id = p_match_id;
    ELSE
      UPDATE matches SET kudos_users = array_append(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text), kudos_count = COALESCE(kudos_count, 0) + 1 WHERE id = p_match_id;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM tournament_matches WHERE id = p_match_id) THEN
    SELECT v_player_id::text = ANY(COALESCE(kudos_users, ARRAY[]::TEXT[])) INTO v_is_liked FROM tournament_matches WHERE id = p_match_id;
    IF v_is_liked THEN
      UPDATE tournament_matches SET kudos_users = array_remove(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text), kudos_count = GREATEST(0, COALESCE(kudos_count, 0) - 1) WHERE id = p_match_id;
    ELSE
      UPDATE tournament_matches SET kudos_users = array_append(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text), kudos_count = COALESCE(kudos_count, 0) + 1 WHERE id = p_match_id;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_match tournament_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  -- Only admins or the currently assigned umpire can transfer
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE id = auth.uid() 
      AND (role IN ('admin', 'master_admin') OR id = v_match.umpired_by)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or currently assigned umpire can transfer duty';
  END IF;

  UPDATE tournament_matches
  SET umpired_by = p_new_umpire_id
  WHERE id = p_match_id;
END;
$$;


ALTER FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_buddy_request_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE sender_name TEXT;
BEGIN
  SELECT full_name INTO sender_name FROM public.players WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.receiver_id,
    'Buddy Request',
    sender_name || ' sent you a buddy request.',
    'buddy_request',
    '/player/' || NEW.sender_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_buddy_request_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_challenge_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE challenger_name TEXT;
BEGIN
  SELECT full_name INTO challenger_name FROM public.players WHERE id = NEW.challenger_id;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.challenged_id,
    'New Challenge!',
    challenger_name || ' challenged you to a ' || NEW.format || ' match.',
    'challenge_received',
    '/my-matches'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_challenge_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_category_records"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only fire when status transitions to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    -- Skip Hybrid — no ELO, no category record
    IF NEW.category <> 'Hybrid' THEN
      PERFORM recalculate_category_records(NEW.player1_id);
      PERFORM recalculate_category_records(NEW.player2_id);
      IF NEW.team1_partner_id IS NOT NULL THEN
        PERFORM recalculate_category_records(NEW.team1_partner_id);
      END IF;
      IF NEW.team2_partner_id IS NOT NULL THEN
        PERFORM recalculate_category_records(NEW.team2_partner_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_category_records"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_venue_presence_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.event_type = 'enter' THEN
    -- Prevent notification spam by ensuring they haven't received one in the last 4 hours
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE user_id = NEW.player_id 
        AND title = 'Welcome to Gymkhana!'
        AND created_at > now() - interval '4 hours'
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.player_id,
        'Welcome to Gymkhana!',
        'Tap to see today''s matches and log your games.',
        'info',
        '/hub'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_venue_presence_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[] DEFAULT '{}'::"text"[], "started_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "ended_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_match_id UUID;
  inferred_category TEXT;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- RBAC CHECK: Only Admins and Umpires can submit umpire-driven matches
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can submit matches as an umpire.';
  END IF;

  IF (team1_partner_id IS NULL OR team1_partner_id = '') AND (team2_partner_id IS NULL OR team2_partner_id = '') THEN
    inferred_category := 'Singles';
  ELSIF (team1_partner_id IS NOT NULL AND team1_partner_id != '') AND (team2_partner_id IS NOT NULL AND team2_partner_id != '') THEN
    inferred_category := 'Doubles';
  ELSE
    inferred_category := 'Hybrid';
  END IF;

  INSERT INTO matches (
    category, round, player1_id, player2_id,
    team1_partner_id, team2_partner_id, winner_id,
    score, sets_history, date, is_friendly, status, submitted_by,
    started_at, ended_at
  ) VALUES (
    inferred_category, match_round, player1_id::uuid, player2_id::uuid,
    NULLIF(team1_partner_id, '')::uuid, NULLIF(team2_partner_id, '')::uuid,
    NULLIF(winner_id, '')::uuid, match_score, sets_history,
    CURRENT_DATE, is_friendly, 'pending', NULLIF(umpire_id, '')::uuid,
    started_at, ended_at
  ) RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$;


ALTER FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE matches
  SET
    winner_id = umpire_update_match.winner_id,
    score = umpire_update_match.match_score,
    category = umpire_update_match.match_category,
    sets_history = umpire_update_match.sets_history
  WHERE id = umpire_update_match.match_uuid;
END;
$$;


ALTER FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE matches
  SET
    winner_id = umpire_update_match.winner_id,
    match_score = umpire_update_match.match_score,
    category = umpire_update_match.match_category
  WHERE id = umpire_update_match.match_uuid;
END;
$$;


ALTER FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- Authenticate
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be logged in to unclaim an item.';
  END IF;

  -- Ensure the user is either the one who claimed it OR an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.find_lost_posts 
    WHERE id = post_uuid AND claimed_by_id = v_uid
  ) AND NOT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = v_uid AND role IN ('admin', 'master_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only unclaim items you have claimed.';
  END IF;

  UPDATE public.find_lost_posts
  SET resolved = false,
      claimed_by_id = NULL,
      claimed_by_name = NULL,
      claim_msg = NULL,
      claim_contact_info = NULL
  WHERE id = post_uuid;
END;
$$;


ALTER FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only allow unclaiming if the person unclaiming is the one who claimed it (or an admin, but for now we'll just check if it matches)
  UPDATE public.find_lost_posts
  SET resolved = false,
      claimed_by_id = null,
      claimed_by_name = null,
      claimed_at = null
  WHERE id = post_uuid AND (claimed_by_id = user_id OR author_id = user_id);
END;
$$;


ALTER FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_doubles_teams_elo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_team1_id UUID;
  v_team2_id UUID;
  v_team1_elo INTEGER;
  v_team2_elo INTEGER;
  v_expected_t1 NUMERIC;
  v_k INTEGER := 32;
  v_t1_new INTEGER;
  v_t2_new INTEGER;
BEGIN
  -- Only proceed if the match is confirmed and it just changed to confirmed
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    
    -- Ensure it's a doubles match (partners are not null)
    IF NEW.team1_partner_id IS NOT NULL AND NEW.team2_partner_id IS NOT NULL THEN
      
      -- Attempt to find Team 1 in doubles_teams
      SELECT id, elo_rating INTO v_team1_id, v_team1_elo
      FROM doubles_teams
      WHERE (player1_id = NEW.player1_id AND player2_id = NEW.team1_partner_id)
         OR (player1_id = NEW.team1_partner_id AND player2_id = NEW.player1_id);

      -- Attempt to find Team 2 in doubles_teams
      SELECT id, elo_rating INTO v_team2_id, v_team2_elo
      FROM doubles_teams
      WHERE (player1_id = NEW.player2_id AND player2_id = NEW.team2_partner_id)
         OR (player1_id = NEW.team2_partner_id AND player2_id = NEW.player2_id);

      -- If neither team is an official registered team, exit early.
      IF v_team1_id IS NULL AND v_team2_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Use default baseline 1200 for unregistered teams
      v_team1_elo := COALESCE(v_team1_elo, 1200);
      v_team2_elo := COALESCE(v_team2_elo, 1200);

      -- Calculate expected outcome for Team 1
      v_expected_t1 := 1.0 / (1.0 + POWER(10.0, (v_team2_elo - v_team1_elo) / 400.0));

      -- Determine changes based on winner
      IF NEW.winner_id = NEW.player1_id OR NEW.winner_id = NEW.team1_partner_id THEN
        -- Team 1 won
        v_t1_new := v_team1_elo + ROUND(v_k * (1 - v_expected_t1));
        v_t2_new := v_team2_elo + ROUND(v_k * (0 - (1 - v_expected_t1)));
        
        IF v_team1_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t1_new, 100),
              matches_played = matches_played + 1,
              matches_won = matches_won + 1
          WHERE id = v_team1_id;
        END IF;

        IF v_team2_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t2_new, 100),
              matches_played = matches_played + 1
          WHERE id = v_team2_id;
        END IF;

      ELSIF NEW.winner_id = NEW.player2_id OR NEW.winner_id = NEW.team2_partner_id THEN
        -- Team 2 won
        v_t1_new := v_team1_elo + ROUND(v_k * (0 - v_expected_t1));
        v_t2_new := v_team2_elo + ROUND(v_k * (1 - (1 - v_expected_t1)));

        IF v_team1_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t1_new, 100),
              matches_played = matches_played + 1
          WHERE id = v_team1_id;
        END IF;

        IF v_team2_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t2_new, 100),
              matches_played = matches_played + 1,
              matches_won = matches_won + 1
          WHERE id = v_team2_id;
        END IF;
      END IF;
      
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_doubles_teams_elo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_site_data_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_site_data_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_live_match_by_id"("p_match_id" "text", "match_state" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_friendly BOOLEAN;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: You must be logged in.';
  END IF;

  -- Detect whether this is a friendly match from the payload
  is_friendly := COALESCE((match_state->>'isFriendly')::BOOLEAN, true);

  -- For tournament (non-friendly) matches, only umpires and admins may update
  IF NOT is_friendly THEN
    IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
      v_is_authorized := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.players
      WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
      AND role IN ('admin', 'master_admin', 'umpire')
    ) THEN
      v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can update tournament live matches.';
    END IF;
  END IF;

  INSERT INTO site_data (key, value)
  VALUES ('live_matches', jsonb_build_object(p_match_id, match_state))
  ON CONFLICT (key) DO UPDATE
  SET value = site_data.value || jsonb_build_object(p_match_id, match_state);
END;
$$;


ALTER FUNCTION "public"."upsert_live_match_by_id"("p_match_id" "text", "match_state" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_player_endorsement"("p_endorsed_player_id" "uuid", "p_endorser_id" "uuid", "p_category" "text", "p_trait" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- IDENTITY CHECK: Ensure you can only endorse someone AS yourself
    IF p_endorser_id != auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: You can only endorse players as yourself.';
    END IF;

    INSERT INTO public.player_endorsements (endorsed_player_id, endorser_id, category, trait)
    VALUES (p_endorsed_player_id, p_endorser_id, p_category, p_trait)
    ON CONFLICT (endorser_id, endorsed_player_id, category)
    DO UPDATE SET 
        trait = EXCLUDED.trait,
        created_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_player_endorsement"("p_endorsed_player_id" "uuid", "p_endorser_id" "uuid", "p_category" "text", "p_trait" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid",
    "action_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "before_state" "jsonb",
    "after_state" "jsonb",
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_history_action_type_check" CHECK (("action_type" = ANY (ARRAY['create'::"text", 'update'::"text", 'delete'::"text", 'approve'::"text", 'revoke'::"text"])))
);


ALTER TABLE "public"."admin_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_logs" (
    "id" bigint NOT NULL,
    "admin_email" "text" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."admin_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."admin_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."admin_logs_id_seq" OWNED BY "public"."admin_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."buddy_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buddy_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."buddy_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenger_id" "uuid",
    "challenged_id" "uuid",
    "format" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "scheduled_time" timestamp with time zone,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "challenges_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_courts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "court_number" integer NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "current_match_id" "uuid",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "club_courts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'occupied'::"text", 'maintenance'::"text"])))
);


ALTER TABLE "public"."club_courts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "visited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "day_of_week" smallint NOT NULL,
    "hour" smallint NOT NULL
);


ALTER TABLE "public"."court_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doubles_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_name" "text" NOT NULL,
    "player1_id" "uuid" NOT NULL,
    "player2_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "elo_rating" integer DEFAULT 1200 NOT NULL,
    "matches_played" integer DEFAULT 0 NOT NULL,
    "matches_won" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "doubles_teams_category_check" CHECK (("category" = ANY (ARRAY['MD'::"text", 'WD'::"text", 'XD'::"text"])))
);


ALTER TABLE "public"."doubles_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."elo_calculation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_uuid" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_id" "text",
    "previous_elo" integer,
    "new_elo" integer,
    "elo_change" integer,
    "expected_score" numeric,
    "actual_score" numeric,
    "category" "text"
);


ALTER TABLE "public"."elo_calculation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."find_lost_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "contact" "text",
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "resolved" boolean DEFAULT false,
    "claimed_by_id" "uuid",
    "claimed_by_name" "text",
    "image_url" "text",
    "updated_at" timestamp with time zone,
    "claimed_at" timestamp with time zone,
    "claim_message" "text",
    "remarks" "text",
    "claim_contact" "text",
    "claim_msg" "text",
    "claim_contact_info" "text"
);


ALTER TABLE "public"."find_lost_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_match_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "live_match_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pick" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "live_match_votes_pick_check" CHECK (("pick" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."live_match_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "condition" "text" NOT NULL,
    "category" "text" NOT NULL,
    "image_url" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "listing_type" "text" DEFAULT 'sell'::"text" NOT NULL,
    "fulfilled_by_id" "uuid",
    "fulfilled_by_name" "text",
    CONSTRAINT "marketplace_listings_category_check" CHECK (("category" = ANY (ARRAY['Racket'::"text", 'Shoes'::"text", 'Shuttlecocks'::"text", 'Accessories'::"text", 'Other'::"text"]))),
    CONSTRAINT "marketplace_listings_condition_check" CHECK (("condition" = ANY (ARRAY['New'::"text", 'Like New'::"text", 'Used'::"text"]))),
    CONSTRAINT "marketplace_listings_listing_type_check" CHECK (("listing_type" = ANY (ARRAY['sell'::"text", 'buy'::"text"]))),
    CONSTRAINT "marketplace_listings_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'sold'::"text"])))
);


ALTER TABLE "public"."marketplace_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_health_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "match_source" "text" NOT NULL,
    "player_id" "uuid",
    "hr_avg" numeric,
    "hr_max" numeric,
    "hr_min" numeric,
    "hr_resting" numeric,
    "hr_recovery" numeric,
    "hr_zone_1_pct" numeric,
    "hr_zone_2_pct" numeric,
    "hr_zone_3_pct" numeric,
    "hr_zone_4_pct" numeric,
    "hr_zone_5_pct" numeric,
    "hr_samples" "jsonb",
    "steps" integer,
    "calories_burned" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "hrv_avg" numeric,
    "spo2_avg" numeric,
    "spo2_min" numeric
);


ALTER TABLE "public"."match_health_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_motion_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "match_source" "text" NOT NULL,
    "sample_count" integer DEFAULT 0 NOT NULL,
    "avg_magnitude" numeric,
    "max_magnitude" numeric,
    "idle_pct" numeric,
    "walking_pct" numeric,
    "running_pct" numeric,
    "smash_sprint_pct" numeric,
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "match_motion_stats_match_source_check" CHECK (("match_source" = ANY (ARRAY['friendly'::"text", 'tournament'::"text", 'practice'::"text"])))
);


ALTER TABLE "public"."match_motion_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_player_paths" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "match_source" "text" NOT NULL,
    "rally_number" integer NOT NULL,
    "side" "text" NOT NULL,
    "player_label" "text",
    "points" "jsonb" NOT NULL,
    "sample_count" integer DEFAULT 0 NOT NULL,
    "avg_speed_mps" numeric,
    "peak_speed_mps" numeric,
    "distance_covered_m" numeric,
    "calibration_id" "uuid",
    "processed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "match_player_paths_match_source_check" CHECK (("match_source" = ANY (ARRAY['friendly'::"text", 'tournament'::"text", 'practice'::"text"]))),
    CONSTRAINT "match_player_paths_side_check" CHECK (("side" = ANY (ARRAY['near'::"text", 'far'::"text"])))
);


ALTER TABLE "public"."match_player_paths" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_rally_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "match_source" "text" NOT NULL,
    "player_id" "uuid",
    "game_num" integer,
    "rally_number" integer NOT NULL,
    "scoring_team" smallint,
    "t1_score" integer,
    "t2_score" integer,
    "started_at" timestamp with time zone,
    "duration_ms" integer NOT NULL,
    "shot_count" integer DEFAULT 0 NOT NULL,
    "smash_count" integer DEFAULT 0 NOT NULL,
    "avg_intensity" numeric,
    "peak_intensity" numeric,
    "direction_changes" integer DEFAULT 0,
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "match_rally_stats_match_source_check" CHECK (("match_source" = ANY (ARRAY['friendly'::"text", 'tournament'::"text", 'practice'::"text"]))),
    CONSTRAINT "match_rally_stats_scoring_team_check" CHECK (("scoring_team" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."match_rally_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_sensor_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "match_source" "text" NOT NULL,
    "player_id" "uuid",
    "accel_avg" numeric,
    "accel_peak" numeric,
    "accel_std" numeric,
    "gyro_avg" numeric,
    "gyro_peak" numeric,
    "gyro_std" numeric,
    "total_swings" integer DEFAULT 0,
    "smash_count" integer DEFAULT 0,
    "clear_count" integer DEFAULT 0,
    "drive_count" integer DEFAULT 0,
    "net_shot_count" integer DEFAULT 0,
    "avg_swing_speed" numeric,
    "max_swing_speed" numeric,
    "lateral_pct" numeric,
    "forward_back_pct" numeric,
    "vertical_pct" numeric,
    "first_half_intensity" numeric,
    "second_half_intensity" numeric,
    "fatigue_index" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "avg_shot_interval_ms" numeric,
    "fastest_shot_interval_ms" numeric,
    "direction_changes" integer DEFAULT 0,
    CONSTRAINT "match_sensor_analytics_match_source_check" CHECK (("match_source" = ANY (ARRAY['friendly'::"text", 'tournament'::"text", 'practice'::"text"])))
);


ALTER TABLE "public"."match_sensor_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_stroke_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "match_source" "text" NOT NULL,
    "rally_number" integer NOT NULL,
    "stroke_type" "text" NOT NULL,
    "confidence" numeric NOT NULL,
    "peak_acceleration" numeric NOT NULL,
    "processed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "match_stroke_analytics_match_source_check" CHECK (("match_source" = ANY (ARRAY['friendly'::"text", 'tournament'::"text", 'practice'::"text"]))),
    CONSTRAINT "match_stroke_analytics_stroke_type_check" CHECK (("stroke_type" = ANY (ARRAY['Smash'::"text", 'Drop'::"text", 'Clear'::"text", 'Drive'::"text", 'Unknown'::"text"])))
);


ALTER TABLE "public"."match_stroke_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_video_calibration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "match_source" "text" NOT NULL,
    "court_width_m" numeric DEFAULT 6.1 NOT NULL,
    "court_length_m" numeric DEFAULT 13.4 NOT NULL,
    "src_points" "jsonb" NOT NULL,
    "dst_points" "jsonb" NOT NULL,
    "homography_matrix" "jsonb" NOT NULL,
    "video_frame_width" integer NOT NULL,
    "video_frame_height" integer NOT NULL,
    "sync_anchor_rally_number" integer NOT NULL,
    "sync_anchor_wallclock" timestamp with time zone NOT NULL,
    "sync_video_time_ms" integer NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "match_video_calibration_match_source_check" CHECK (("match_source" = ANY (ARRAY['friendly'::"text", 'tournament'::"text", 'practice'::"text"])))
);


ALTER TABLE "public"."match_video_calibration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid",
    "category" "text" NOT NULL,
    "round" "text" NOT NULL,
    "player1_id" "uuid",
    "player2_id" "uuid",
    "team1_partner_id" "uuid",
    "team2_partner_id" "uuid",
    "winner_id" "uuid",
    "score" "text" NOT NULL,
    "date" "date" NOT NULL,
    "is_friendly" boolean DEFAULT false,
    "status" "text" DEFAULT 'confirmed'::"text",
    "submitted_by" "uuid",
    "elo_change_p1" integer,
    "elo_change_p2" integer,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "elo_change_p3" integer,
    "elo_change_p4" integer,
    "kudos_users" "text"[] DEFAULT '{}'::"text"[],
    "kudos_count" integer DEFAULT 0,
    "confirmed_by" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sets_history" "text"[] DEFAULT '{}'::"text"[],
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "link" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_endorsements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endorsed_player_id" "uuid" NOT NULL,
    "endorser_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "trait" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_endorsements_category_check" CHECK (("category" = ANY (ARRAY['skill'::"text", 'behavior'::"text"])))
);


ALTER TABLE "public"."player_endorsements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_sleep_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid",
    "sleep_date" "date" NOT NULL,
    "total_minutes" numeric,
    "deep_minutes" numeric,
    "rem_minutes" numeric,
    "light_minutes" numeric,
    "awake_minutes" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."player_sleep_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recycle_bin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "record_data" "jsonb" NOT NULL,
    "deleted_by" "uuid",
    "label" "text",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL
);


ALTER TABLE "public"."recycle_bin" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."search_players_view" WITH ("security_invoker"='on') AS
 WITH "player_status" AS (
         SELECT "p_1"."id",
            (EXISTS ( SELECT 1
                   FROM "public"."matches" "m"
                  WHERE (("m"."status" = 'confirmed'::"text") AND (("m"."player1_id" = "p_1"."id") OR ("m"."player2_id" = "p_1"."id") OR ("m"."team1_partner_id" = "p_1"."id") OR ("m"."team2_partner_id" = "p_1"."id"))))) AS "has_played"
           FROM "public"."players" "p_1"
        )
 SELECT "p"."id",
    "p"."full_name",
    "p"."avatar_url",
    "p"."department",
        CASE
            WHEN "ps"."has_played" THEN "rank"() OVER (PARTITION BY "ps"."has_played" ORDER BY COALESCE("p"."elo_rating", 1200) DESC)
            ELSE NULL::bigint
        END AS "overall_rank"
   FROM ("public"."players" "p"
     JOIN "player_status" "ps" ON (("p"."id" = "ps"."id")))
  WHERE (("p"."deleted_at" IS NULL) AND ("p"."is_guest" = false));


ALTER VIEW "public"."search_players_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sent_fan_notifications" (
    "user_id" "uuid" NOT NULL,
    "match_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sent_fan_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_data" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."site_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "match_code" "text" NOT NULL,
    "round" integer NOT NULL,
    "round_name" "text" NOT NULL,
    "match_number" integer NOT NULL,
    "player1_id" "uuid",
    "player3_id" "uuid",
    "team1_label" "text",
    "player2_id" "uuid",
    "player4_id" "uuid",
    "team2_label" "text",
    "court_number" "text",
    "scheduled_at" timestamp with time zone,
    "points_to_win" integer DEFAULT 21,
    "best_of_sets" integer DEFAULT 3,
    "golden_point" integer DEFAULT 30,
    "winner_side" smallint,
    "winner_id" "uuid",
    "score" "text",
    "sets_history" "text"[],
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "locked" boolean DEFAULT false,
    "advances_to_match" "text",
    "advances_to_position" smallint,
    "advances_to_match_loser" "text",
    "advances_to_position_loser" smallint,
    "umpired_by" "uuid",
    "scored_by" "uuid",
    "scored_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "reminder_sent" boolean DEFAULT false,
    CONSTRAINT "tournament_matches_advances_to_position_check" CHECK (("advances_to_position" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "tournament_matches_advances_to_position_loser_check" CHECK (("advances_to_position_loser" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "tournament_matches_winner_side_check" CHECK (("winner_side" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."tournament_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "player_id" "uuid",
    "partner_id" "uuid",
    "display_name" "text",
    "seed" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "entry_round" integer,
    CONSTRAINT "tournament_participants_entry_round_check" CHECK ((("entry_round" IS NULL) OR (("entry_round" >= 1) AND ("entry_round" <= 16))))
);


ALTER TABLE "public"."tournament_participants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tournament_participants"."entry_round" IS 'Round this participant plays their first match in. NULL = automatic bye allocation, 1 = no bye, 2 = one bye, 3 = two byes.';



CREATE TABLE IF NOT EXISTS "public"."tournament_round_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "round" integer NOT NULL,
    "round_name" "text",
    "points_to_win" integer DEFAULT 21 NOT NULL,
    "best_of_sets" integer DEFAULT 3 NOT NULL,
    "golden_point" integer DEFAULT 30 NOT NULL
);


ALTER TABLE "public"."tournament_round_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "year" integer NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "tournament_type" "text" DEFAULT 'open'::"text" NOT NULL,
    "bracket_format" "text" DEFAULT 'single_elim'::"text" NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "venue" "text",
    "description" "text",
    "eligibility" "text",
    "form_url" "text",
    "form_status" "text" DEFAULT 'disabled'::"text",
    "form_close_date" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_by" "uuid",
    "require_app_registration" boolean DEFAULT false NOT NULL,
    "auto_reminders_enabled" boolean DEFAULT false,
    "show_brackets" boolean DEFAULT true,
    "show_participants" boolean DEFAULT true
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umpire_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "match_id" "uuid",
    "tournament_match_id" "uuid",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_by" "uuid"
);


ALTER TABLE "public"."umpire_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "feedback_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_feedback_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['bug'::"text", 'feature'::"text", 'general'::"text"]))),
    CONSTRAINT "user_feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."user_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_match_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "match_id" "uuid",
    "notify_before_mins" integer DEFAULT 15,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_match_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_player_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "player_id" "uuid",
    "notify_before_mins" integer DEFAULT 15,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_player_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "token" "text" NOT NULL,
    "platform" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_presence_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "venue_presence_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['enter'::"text", 'exit'::"text"])))
);


ALTER TABLE "public"."venue_presence_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_history"
    ADD CONSTRAINT "admin_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_requests"
    ADD CONSTRAINT "buddy_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_requests"
    ADD CONSTRAINT "buddy_requests_sender_id_receiver_id_key" UNIQUE ("sender_id", "receiver_id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_courts"
    ADD CONSTRAINT "club_courts_court_number_key" UNIQUE ("court_number");



ALTER TABLE ONLY "public"."club_courts"
    ADD CONSTRAINT "club_courts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_visits"
    ADD CONSTRAINT "court_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_player1_id_player2_id_key" UNIQUE ("player1_id", "player2_id");



ALTER TABLE ONLY "public"."elo_calculation_logs"
    ADD CONSTRAINT "elo_calculation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."find_lost_posts"
    ADD CONSTRAINT "find_lost_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_match_votes"
    ADD CONSTRAINT "live_match_votes_live_match_id_user_id_key" UNIQUE ("live_match_id", "user_id");



ALTER TABLE ONLY "public"."live_match_votes"
    ADD CONSTRAINT "live_match_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_health_data"
    ADD CONSTRAINT "match_health_data_match_id_match_source_player_id_key" UNIQUE ("match_id", "match_source", "player_id");



ALTER TABLE ONLY "public"."match_health_data"
    ADD CONSTRAINT "match_health_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_motion_stats"
    ADD CONSTRAINT "match_motion_stats_match_id_match_source_key" UNIQUE ("match_id", "match_source");



ALTER TABLE ONLY "public"."match_motion_stats"
    ADD CONSTRAINT "match_motion_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_player_paths"
    ADD CONSTRAINT "match_player_paths_match_id_match_source_rally_number_side_key" UNIQUE ("match_id", "match_source", "rally_number", "side");



ALTER TABLE ONLY "public"."match_player_paths"
    ADD CONSTRAINT "match_player_paths_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_rally_stats"
    ADD CONSTRAINT "match_rally_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_sensor_analytics"
    ADD CONSTRAINT "match_sensor_analytics_match_id_match_source_player_id_key" UNIQUE ("match_id", "match_source", "player_id");



ALTER TABLE ONLY "public"."match_sensor_analytics"
    ADD CONSTRAINT "match_sensor_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_stroke_analytics"
    ADD CONSTRAINT "match_stroke_analytics_match_id_match_source_rally_number_key" UNIQUE ("match_id", "match_source", "rally_number");



ALTER TABLE ONLY "public"."match_stroke_analytics"
    ADD CONSTRAINT "match_stroke_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_video_calibration"
    ADD CONSTRAINT "match_video_calibration_match_id_match_source_key" UNIQUE ("match_id", "match_source");



ALTER TABLE ONLY "public"."match_video_calibration"
    ADD CONSTRAINT "match_video_calibration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_endorsements"
    ADD CONSTRAINT "player_endorsements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_sleep_data"
    ADD CONSTRAINT "player_sleep_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_sleep_data"
    ADD CONSTRAINT "player_sleep_data_player_id_sleep_date_key" UNIQUE ("player_id", "sleep_date");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recycle_bin"
    ADD CONSTRAINT "recycle_bin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sent_fan_notifications"
    ADD CONSTRAINT "sent_fan_notifications_pkey" PRIMARY KEY ("user_id", "match_id");



ALTER TABLE ONLY "public"."site_data"
    ADD CONSTRAINT "site_data_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_tournament_id_match_code_key" UNIQUE ("tournament_id", "match_code");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_round_rules"
    ADD CONSTRAINT "tournament_round_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_round_rules"
    ADD CONSTRAINT "tournament_round_rules_tournament_id_category_round_key" UNIQUE ("tournament_id", "category", "round");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umpire_assignments"
    ADD CONSTRAINT "umpire_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_endorsements"
    ADD CONSTRAINT "unique_endorsement_per_category" UNIQUE ("endorser_id", "endorsed_player_id", "category");



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_match_notifications"
    ADD CONSTRAINT "user_match_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_match_notifications"
    ADD CONSTRAINT "user_match_notifications_user_id_match_id_key" UNIQUE ("user_id", "match_id");



ALTER TABLE ONLY "public"."user_player_subscriptions"
    ADD CONSTRAINT "user_player_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_player_subscriptions"
    ADD CONSTRAINT "user_player_subscriptions_user_id_player_id_key" UNIQUE ("user_id", "player_id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_user_id_token_key" UNIQUE ("user_id", "token");



ALTER TABLE ONLY "public"."venue_presence_events"
    ADD CONSTRAINT "venue_presence_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_history_admin_id_idx" ON "public"."admin_history" USING "btree" ("admin_id", "created_at" DESC);



CREATE INDEX "court_visits_day_hour_idx" ON "public"."court_visits" USING "btree" ("day_of_week", "hour");



CREATE INDEX "idx_admin_logs_action" ON "public"."admin_logs" USING "btree" ("action");



CREATE INDEX "idx_admin_logs_created_at" ON "public"."admin_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_logs_email" ON "public"."admin_logs" USING "btree" ("admin_email");



CREATE INDEX "idx_buddy_receiver" ON "public"."buddy_requests" USING "btree" ("receiver_id");



CREATE INDEX "idx_buddy_sender" ON "public"."buddy_requests" USING "btree" ("sender_id");



CREATE INDEX "idx_buddy_status" ON "public"."buddy_requests" USING "btree" ("status");



CREATE INDEX "idx_match_motion_stats_match" ON "public"."match_motion_stats" USING "btree" ("match_id", "match_source");



CREATE INDEX "idx_match_rally_stats_match" ON "public"."match_rally_stats" USING "btree" ("match_id", "match_source");



CREATE INDEX "idx_match_rally_stats_player" ON "public"."match_rally_stats" USING "btree" ("player_id");



CREATE INDEX "idx_match_sensor_analytics_match" ON "public"."match_sensor_analytics" USING "btree" ("match_id", "match_source");



CREATE INDEX "idx_mpp_match" ON "public"."match_player_paths" USING "btree" ("match_id", "match_source");



CREATE INDEX "idx_msa_match" ON "public"."match_stroke_analytics" USING "btree" ("match_id", "match_source");



CREATE INDEX "idx_player_endorsements_endorsed" ON "public"."player_endorsements" USING "btree" ("endorsed_player_id");



CREATE INDEX "idx_player_endorsements_endorser" ON "public"."player_endorsements" USING "btree" ("endorser_id");



CREATE INDEX "idx_player_sleep_data_player" ON "public"."player_sleep_data" USING "btree" ("player_id", "sleep_date");



CREATE INDEX "idx_players_is_guest" ON "public"."players" USING "btree" ("is_guest");



CREATE INDEX "recycle_bin_expires_idx" ON "public"."recycle_bin" USING "btree" ("expires_at");



CREATE INDEX "recycle_bin_table_record_idx" ON "public"."recycle_bin" USING "btree" ("table_name", "record_id");



CREATE INDEX "venue_presence_events_created_idx" ON "public"."venue_presence_events" USING "btree" ("created_at" DESC);



CREATE INDEX "venue_presence_events_player_created_idx" ON "public"."venue_presence_events" USING "btree" ("player_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "on_buddy_request_created" AFTER INSERT ON "public"."buddy_requests" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_buddy_request_notification"();



CREATE OR REPLACE TRIGGER "on_challenge_created" AFTER INSERT ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_challenge_notification"();



CREATE OR REPLACE TRIGGER "on_match_confirmed_update_category_records" AFTER UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_category_records"();



CREATE OR REPLACE TRIGGER "on_match_insert_notify" AFTER INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."notify_players_on_match_insert"();



CREATE OR REPLACE TRIGGER "on_match_update_notify" AFTER UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."notify_players_on_match_confirm"();



CREATE OR REPLACE TRIGGER "site_data_updated_at" BEFORE UPDATE ON "public"."site_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_site_data_timestamp"();



CREATE OR REPLACE TRIGGER "tr_protect_player_sensitive_columns" BEFORE UPDATE ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."protect_player_sensitive_columns"();



CREATE OR REPLACE TRIGGER "trg_handle_deleted_tournament" AFTER UPDATE OF "status" ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_deleted_tournament"();



CREATE OR REPLACE TRIGGER "trg_update_doubles_teams_elo" AFTER UPDATE OF "status" ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_doubles_teams_elo"();



CREATE OR REPLACE TRIGGER "trigger_rollback_elo_on_match_delete" AFTER DELETE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."rollback_elo_on_match_delete"();



CREATE OR REPLACE TRIGGER "update_challenges_modtime" BEFORE UPDATE ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "venue_presence_notification_trigger" AFTER INSERT ON "public"."venue_presence_events" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_venue_presence_notification"();



ALTER TABLE ONLY "public"."admin_history"
    ADD CONSTRAINT "admin_history_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_requests"
    ADD CONSTRAINT "buddy_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_requests"
    ADD CONSTRAINT "buddy_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_challenged_id_fkey" FOREIGN KEY ("challenged_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_courts"
    ADD CONSTRAINT "club_courts_current_match_id_fkey" FOREIGN KEY ("current_match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."court_visits"
    ADD CONSTRAINT "court_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."find_lost_posts"
    ADD CONSTRAINT "find_lost_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."find_lost_posts"
    ADD CONSTRAINT "find_lost_posts_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."live_match_votes"
    ADD CONSTRAINT "live_match_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_fulfilled_by_id_fkey" FOREIGN KEY ("fulfilled_by_id") REFERENCES "public"."players"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_health_data"
    ADD CONSTRAINT "match_health_data_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."match_motion_stats"
    ADD CONSTRAINT "match_motion_stats_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."match_player_paths"
    ADD CONSTRAINT "match_player_paths_calibration_id_fkey" FOREIGN KEY ("calibration_id") REFERENCES "public"."match_video_calibration"("id");



ALTER TABLE ONLY "public"."match_player_paths"
    ADD CONSTRAINT "match_player_paths_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."match_rally_stats"
    ADD CONSTRAINT "match_rally_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."match_rally_stats"
    ADD CONSTRAINT "match_rally_stats_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."match_sensor_analytics"
    ADD CONSTRAINT "match_sensor_analytics_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."match_stroke_analytics"
    ADD CONSTRAINT "match_stroke_analytics_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."match_video_calibration"
    ADD CONSTRAINT "match_video_calibration_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_team1_partner_id_fkey" FOREIGN KEY ("team1_partner_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_team2_partner_id_fkey" FOREIGN KEY ("team2_partner_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_endorsements"
    ADD CONSTRAINT "player_endorsements_endorsed_player_id_fkey" FOREIGN KEY ("endorsed_player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_endorsements"
    ADD CONSTRAINT "player_endorsements_endorser_id_fkey" FOREIGN KEY ("endorser_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_sleep_data"
    ADD CONSTRAINT "player_sleep_data_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."recycle_bin"
    ADD CONSTRAINT "recycle_bin_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sent_fan_notifications"
    ADD CONSTRAINT "sent_fan_notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sent_fan_notifications"
    ADD CONSTRAINT "sent_fan_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_player3_id_fkey" FOREIGN KEY ("player3_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_player4_id_fkey" FOREIGN KEY ("player4_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_scored_by_fkey" FOREIGN KEY ("scored_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_umpired_by_fkey" FOREIGN KEY ("umpired_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_round_rules"
    ADD CONSTRAINT "tournament_round_rules_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."umpire_assignments"
    ADD CONSTRAINT "umpire_assignments_tournament_match_id_fkey" FOREIGN KEY ("tournament_match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_match_notifications"
    ADD CONSTRAINT "user_match_notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_match_notifications"
    ADD CONSTRAINT "user_match_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_player_subscriptions"
    ADD CONSTRAINT "user_player_subscriptions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_player_subscriptions"
    ADD CONSTRAINT "user_player_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_presence_events"
    ADD CONSTRAINT "venue_presence_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



CREATE POLICY "Admins and Umpires can insert courts" ON "public"."club_courts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"]))))));



CREATE POLICY "Admins and Umpires can insert matches" ON "public"."matches" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"])))))));



CREATE POLICY "Admins and Umpires can update courts" ON "public"."club_courts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"]))))));



CREATE POLICY "Admins and Umpires can update matches" ON "public"."matches" FOR UPDATE USING (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"]))))))) WITH CHECK (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"])))))));



CREATE POLICY "Admins can delete all posts" ON "public"."find_lost_posts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "Admins can delete any player" ON "public"."players" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."players" "players_1"
  WHERE (("players_1"."id" = "auth"."uid"()) AND ("players_1"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "Admins can delete find_lost_posts" ON "public"."find_lost_posts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admins can delete matches" ON "public"."matches" FOR DELETE USING (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"])))))));



CREATE POLICY "Admins can manage site_data" ON "public"."site_data" USING ((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['rajajanmejaya@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text", 'janmejayraja@iisc.ac.in'::"text", 'raja79sharma@gmail.com'::"text"]))) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['rajajanmejaya@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text", 'janmejayraja@iisc.ac.in'::"text", 'raja79sharma@gmail.com'::"text"])));



CREATE POLICY "Admins can manage site_data strictly" ON "public"."site_data" USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "Admins can manage umpire assignments strictly" ON "public"."umpire_assignments" USING (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))))) WITH CHECK (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"])))))));



CREATE POLICY "Admins can read logs" ON "public"."admin_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admins can update all feedback" ON "public"."user_feedback" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "Admins can update all posts" ON "public"."find_lost_posts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "Admins can update any player" ON "public"."players" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."players" "players_1"
  WHERE (("players_1"."id" = "auth"."uid"()) AND ("players_1"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."players" "players_1"
  WHERE (("players_1"."id" = "auth"."uid"()) AND ("players_1"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "Admins can update find_lost_posts" ON "public"."find_lost_posts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admins can view all feedback" ON "public"."user_feedback" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "Allow admin deletes from elo_calculation_logs" ON "public"."elo_calculation_logs" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))) OR ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'role'::"text") = 'service_role'::"text")));



CREATE POLICY "Allow admin inserts to elo_calculation_logs" ON "public"."elo_calculation_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated to read elo_calculation_logs" ON "public"."elo_calculation_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public read access to confirmed matches" ON "public"."matches" FOR SELECT USING (("status" IS DISTINCT FROM 'pending'::"text"));



CREATE POLICY "Allow public read access to players" ON "public"."players" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to tournaments" ON "public"."tournaments" FOR SELECT USING (true);



CREATE POLICY "Anyone can read doubles_teams" ON "public"."doubles_teams" FOR SELECT USING (true);



CREATE POLICY "Anyone can read matches" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "Anyone can read site_data" ON "public"."site_data" FOR SELECT USING (true);



CREATE POLICY "Anyone can view active marketplace listings" ON "public"."marketplace_listings" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "Anyone can view challenges" ON "public"."challenges" FOR SELECT USING (true);



CREATE POLICY "Anyone can view umpire assignments" ON "public"."umpire_assignments" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert find_lost_posts" ON "public"."find_lost_posts" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert logs" ON "public"."admin_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert match strokes" ON "public"."match_stroke_analytics" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authors can delete find_lost_posts" ON "public"."find_lost_posts" FOR DELETE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Authors can update find_lost_posts" ON "public"."find_lost_posts" FOR UPDATE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Endorsements are viewable by everyone" ON "public"."player_endorsements" FOR SELECT USING (true);



CREATE POLICY "No direct reads" ON "public"."court_visits" FOR SELECT USING (false);



CREATE POLICY "Parties can delete" ON "public"."buddy_requests" FOR DELETE USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Parties can read their buddy requests" ON "public"."buddy_requests" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Players and admins can insert match strokes" ON "public"."match_stroke_analytics" FOR INSERT WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "processed_by"));



CREATE POLICY "Players can create teams they are part of" ON "public"."doubles_teams" FOR INSERT WITH CHECK ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));



CREATE POLICY "Players can delete their own teams" ON "public"."doubles_teams" FOR DELETE USING ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));



CREATE POLICY "Players can read their pending matches" ON "public"."matches" FOR SELECT USING ((("status" = 'pending'::"text") AND (((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")) OR ("auth"."uid"() = "team1_partner_id")) OR ("auth"."uid"() = "team2_partner_id"))));



CREATE POLICY "Players can update their own looking_to_play status" ON "public"."players" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Players can update their own teams" ON "public"."doubles_teams" FOR UPDATE USING ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));



CREATE POLICY "Public can read find_lost_posts" ON "public"."find_lost_posts" FOR SELECT USING (true);



CREATE POLICY "Public read access for match strokes" ON "public"."match_stroke_analytics" FOR SELECT USING (true);



CREATE POLICY "Receiver can update status" ON "public"."buddy_requests" FOR UPDATE USING ((("auth"."uid"() = "receiver_id") OR ("auth"."uid"() = "sender_id")));



CREATE POLICY "Sender can insert buddy request" ON "public"."buddy_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Service role and functions can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can view all tokens for push triggers" ON "public"."user_push_tokens" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Users can create challenges" ON "public"."challenges" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create listings" ON "public"."marketplace_listings" FOR INSERT WITH CHECK (("auth"."uid"() = "seller_id"));



CREATE POLICY "Users can create their own profile" ON "public"."players" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete their own endorsements" ON "public"."player_endorsements" FOR DELETE USING (("endorser_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own listings" ON "public"."marketplace_listings" FOR DELETE USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Users can delete their own match notifications" ON "public"."user_match_notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own player subscriptions" ON "public"."user_player_subscriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own endorsements" ON "public"."player_endorsements" FOR INSERT WITH CHECK (("endorser_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own feedback" ON "public"."user_feedback" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own match notifications" ON "public"."user_match_notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own player subscriptions" ON "public"."user_player_subscriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own push tokens" ON "public"."user_push_tokens" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can log own visits" ON "public"."court_visits" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can log their own presence events" ON "public"."venue_presence_events" FOR INSERT WITH CHECK ((("auth"."uid"() = "player_id") OR (( SELECT "players"."email"
   FROM "public"."players"
  WHERE ("players"."id" = "venue_presence_events"."player_id")) = ("auth"."jwt"() ->> 'email'::"text"))));



CREATE POLICY "Users can update strokes they processed" ON "public"."match_stroke_analytics" FOR UPDATE USING ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "processed_by")) WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "processed_by"));



CREATE POLICY "Users can update their own challenges" ON "public"."challenges" FOR UPDATE USING (true);



CREATE POLICY "Users can update their own endorsements" ON "public"."player_endorsements" FOR UPDATE USING (("endorser_id" = "auth"."uid"())) WITH CHECK (("endorser_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own listings" ON "public"."marketplace_listings" FOR UPDATE USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Users can update their own match notifications" ON "public"."user_match_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own player subscriptions" ON "public"."user_player_subscriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."players" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own push tokens" ON "public"."user_push_tokens" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own feedback" ON "public"."user_feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own listings regardless of status" ON "public"."marketplace_listings" FOR SELECT USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Users can view their own match notifications" ON "public"."user_match_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own player subscriptions" ON "public"."user_player_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own presence events" ON "public"."venue_presence_events" FOR SELECT USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can view their own push tokens" ON "public"."user_push_tokens" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own sent notifications" ON "public"."sent_fan_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins_delete_own_history" ON "public"."admin_history" FOR DELETE USING (("auth"."uid"() = "admin_id"));



CREATE POLICY "admins_insert_history" ON "public"."admin_history" FOR INSERT WITH CHECK (("auth"."uid"() = "admin_id"));



CREATE POLICY "admins_manage_recycle_bin" ON "public"."recycle_bin" USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['master_admin'::"text", 'admin'::"text"]))))));



CREATE POLICY "admins_read_own_history" ON "public"."admin_history" FOR SELECT USING (("auth"."uid"() = "admin_id"));



ALTER TABLE "public"."buddy_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_courts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doubles_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."elo_calculation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."find_lost_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert own vote" ON "public"."live_match_votes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."live_match_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_health_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_motion_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_player_paths" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_rally_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_sensor_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_stroke_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_video_calibration" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mms_auth_insert" ON "public"."match_motion_stats" FOR INSERT WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "recorded_by"));



CREATE POLICY "mms_auth_update_own" ON "public"."match_motion_stats" FOR UPDATE USING ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "recorded_by")) WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "recorded_by"));



CREATE POLICY "mms_public_read" ON "public"."match_motion_stats" FOR SELECT USING (true);



CREATE POLICY "mpp_auth_insert" ON "public"."match_player_paths" FOR INSERT WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "processed_by"));



CREATE POLICY "mpp_auth_update_own" ON "public"."match_player_paths" FOR UPDATE USING ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "processed_by")) WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "processed_by"));



CREATE POLICY "mpp_public_read" ON "public"."match_player_paths" FOR SELECT USING (true);



CREATE POLICY "mrs_auth_insert" ON "public"."match_rally_stats" FOR INSERT WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "recorded_by"));



CREATE POLICY "mrs_auth_update_own" ON "public"."match_rally_stats" FOR UPDATE USING ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "recorded_by")) WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "recorded_by"));



CREATE POLICY "mrs_public_read" ON "public"."match_rally_stats" FOR SELECT USING (true);



CREATE POLICY "msa_auth_insert" ON "public"."match_sensor_analytics" FOR INSERT WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "player_id"));



CREATE POLICY "msa_auth_update_own" ON "public"."match_sensor_analytics" FOR UPDATE USING ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "player_id")) WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "player_id"));



CREATE POLICY "msa_public_read" ON "public"."match_sensor_analytics" FOR SELECT USING (true);



CREATE POLICY "mvc_auth_insert" ON "public"."match_video_calibration" FOR INSERT WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "created_by"));



CREATE POLICY "mvc_auth_update_own" ON "public"."match_video_calibration" FOR UPDATE USING ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "created_by")) WITH CHECK ("public"."is_authorized_for_analytics"("auth"."uid"(), "match_id", "match_source", "created_by"));



CREATE POLICY "mvc_public_read" ON "public"."match_video_calibration" FOR SELECT USING (true);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_endorsements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_sleep_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read all votes" ON "public"."live_match_votes" FOR SELECT USING (true);



ALTER TABLE "public"."recycle_bin" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sent_fan_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_data" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tm_admin_read" ON "public"."tournament_matches" FOR SELECT USING (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"])))))));



CREATE POLICY "tm_admin_write" ON "public"."tournament_matches" USING (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"]))))))) WITH CHECK (((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['raja79sharma@gmail.com'::"text", 'iiscbadmintonclub@gmail.com'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE ((("players"."id" = "auth"."uid"()) OR ("players"."email" = ("auth"."jwt"() ->> 'email'::"text")) OR ("players"."iisc_email" = ("auth"."jwt"() ->> 'email'::"text"))) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text", 'umpire'::"text"])))))));



CREATE POLICY "tm_public_read" ON "public"."tournament_matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_matches"."tournament_id") AND ("t"."status" <> 'draft'::"text")))));



ALTER TABLE "public"."tournament_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_round_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournaments_admin_read" ON "public"."tournaments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "tournaments_admin_write" ON "public"."tournaments" USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "tournaments_public_read" ON "public"."tournaments" FOR SELECT USING (("status" <> 'draft'::"text"));



CREATE POLICY "tp_admin_all" ON "public"."tournament_participants" USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "tp_public_read" ON "public"."tournament_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_participants"."tournament_id") AND ("t"."status" <> 'draft'::"text")))));



CREATE POLICY "trr_admin_all" ON "public"."tournament_round_rules" USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'master_admin'::"text"]))))));



CREATE POLICY "trr_public_read" ON "public"."tournament_round_rules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_round_rules"."tournament_id") AND ("t"."status" <> 'draft'::"text")))));



ALTER TABLE "public"."umpire_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update own vote" ON "public"."live_match_votes" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."user_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_match_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_player_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_presence_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."live_match_votes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."matches";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."site_data";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tournament_matches";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[], "p_approved" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[], "p_approved" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_approve_players"("p_ids" "uuid"[], "p_approved" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_edit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_scored_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_edit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_scored_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_edit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_scored_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."advance_tournament_winner"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_tournament_winner"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_tournament_winner"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_tournament_winner"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_tournament"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_tournament"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_tournament"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_claim_duplicate_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_claim_duplicate_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_claim_duplicate_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_overall_elo"("p_singles_elo" integer, "p_singles_matches" integer, "p_doubles_elo" integer, "p_doubles_matches" integer, "p_mixed_elo" integer, "p_mixed_matches" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_overall_elo"("p_singles_elo" integer, "p_singles_matches" integer, "p_doubles_elo" integer, "p_doubles_matches" integer, "p_mixed_elo" integer, "p_mixed_matches" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_overall_elo"("p_singles_elo" integer, "p_singles_matches" integer, "p_doubles_elo" integer, "p_doubles_matches" integer, "p_mixed_elo" integer, "p_mixed_matches" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_exists"("lookup_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("lookup_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("lookup_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "text", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "text", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "text", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_find_lost_item"("post_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text", "claim_msg" "text", "claim_contact_info" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_guest_player"("p_guest_id" "uuid", "p_real_player_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_guest_player"("p_guest_id" "uuid", "p_real_player_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_guest_player"("p_guest_id" "uuid", "p_real_player_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_guest_player"("p_full_name" "text", "p_gender" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_guest_player"("p_full_name" "text", "p_gender" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_guest_player"("p_full_name" "text", "p_gender" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_recalc"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_recalc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_recalc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_guest_player"("p_guest_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_guest_player"("p_guest_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_guest_player"("p_guest_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_player_match_session"("p_match_id" "uuid", "p_match_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_player_match_session"("p_match_id" "uuid", "p_match_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_player_match_session"("p_match_id" "uuid", "p_match_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fulfill_marketplace_request"("listing_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fulfill_marketplace_request"("listing_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fulfill_marketplace_request"("listing_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fulfill_marketplace_request"("listing_uuid" "uuid", "claimer_id" "uuid", "claimer_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_court_popularity"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_court_popularity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_court_popularity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_k_factor"("p_matches" integer, "p_config" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_k_factor"("p_matches" integer, "p_config" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_k_factor"("p_matches" integer, "p_config" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_match_dominance"("p_sets" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_match_dominance"("p_sets" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_match_dominance"("p_sets" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_set_multiplier"("p_sets" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_set_multiplier"("p_sets" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_set_multiplier"("p_sets" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_venue_active_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_venue_active_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_venue_active_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_venue_hourly_pattern"("days_back" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_venue_hourly_pattern"("days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_venue_hourly_pattern"("days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_deleted_tournament"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_deleted_tournament"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_deleted_tournament"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_label_to_player"("p_label" "text", "p_player_id" "uuid", "p_partner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_label_to_player"("p_label" "text", "p_player_id" "uuid", "p_partner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_label_to_player"("p_label" "text", "p_player_id" "uuid", "p_partner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_players_on_match_confirm"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_confirm"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_confirm"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_players_on_match_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_tournament_bracket_progression"("p_match_id" "uuid", "p_winner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_tournament_bracket_progression"("p_match_id" "uuid", "p_winner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_tournament_bracket_progression"("p_match_id" "uuid", "p_winner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_player_sensitive_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_player_sensitive_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_player_sensitive_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."push_match_alert"("p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."push_match_alert"("p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."push_match_alert"("p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."push_match_alert"("p_message" "text", "p_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."push_match_alert"("p_message" "text", "p_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."push_match_alert"("p_message" "text", "p_title" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalculate_all_elo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalculate_all_elo"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_all_elo"() TO "service_role";
GRANT ALL ON FUNCTION "public"."recalculate_all_elo"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."recalculate_category_records"("player_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalculate_category_records"("player_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_category_records"("player_uuid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."recalculate_category_records"("player_uuid" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."recalculate_player_all_records"("player_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalculate_player_all_records"("player_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_player_all_records"("player_uuid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."recalculate_player_all_records"("player_uuid" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."recalculate_tournament_elo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalculate_tournament_elo"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_tournament_elo"() TO "service_role";
GRANT ALL ON FUNCTION "public"."recalculate_tournament_elo"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_buddy"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_buddy"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_buddy"("p_target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_live_match_by_id"("p_match_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_live_match_by_id"("p_match_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_live_match_by_id"("p_match_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_elo_on_match_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_elo_on_match_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_elo_on_match_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."send_ping_notification"("p_target_id" "uuid", "p_sender_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_ping_notification"("p_target_id" "uuid", "p_sender_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_ping_notification"("p_target_id" "uuid", "p_sender_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_ping_notification"("p_target_id" "uuid", "p_sender_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_player_role"("p_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_player_role"("p_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_player_role"("p_id" "uuid", "p_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_player_role"("p_id" "uuid", "p_role" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_tournament_match_times"("p_match_id" "uuid", "p_started_at" timestamp with time zone, "p_ended_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."set_tournament_match_times"("p_match_id" "uuid", "p_started_at" timestamp with time zone, "p_ended_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tournament_match_times"("p_match_id" "uuid", "p_started_at" timestamp with time zone, "p_ended_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_umpire_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_umpire_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_tournament_match"("p_match_id" "uuid", "p_winner_side" smallint, "p_score" "text", "p_sets" "text"[], "p_umpire_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_follow"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_follow"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_follow"("p_target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_buddy_request_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_buddy_request_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_buddy_request_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_challenge_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_challenge_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_challenge_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_category_records"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_category_records"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_category_records"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_venue_presence_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_venue_presence_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_venue_presence_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unclaim_find_lost_item"("post_uuid" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_doubles_teams_elo"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_doubles_teams_elo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_doubles_teams_elo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_site_data_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_site_data_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_site_data_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_live_match_by_id"("p_match_id" "text", "match_state" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_live_match_by_id"("p_match_id" "text", "match_state" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_live_match_by_id"("p_match_id" "text", "match_state" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_player_endorsement"("p_endorsed_player_id" "uuid", "p_endorser_id" "uuid", "p_category" "text", "p_trait" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_player_endorsement"("p_endorsed_player_id" "uuid", "p_endorser_id" "uuid", "p_category" "text", "p_trait" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_player_endorsement"("p_endorsed_player_id" "uuid", "p_endorser_id" "uuid", "p_category" "text", "p_trait" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_player_endorsement"("p_endorsed_player_id" "uuid", "p_endorser_id" "uuid", "p_category" "text", "p_trait" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."admin_history" TO "anon";
GRANT ALL ON TABLE "public"."admin_history" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_history" TO "service_role";



GRANT ALL ON TABLE "public"."admin_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."admin_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_requests" TO "anon";
GRANT ALL ON TABLE "public"."buddy_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_requests" TO "service_role";



GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON TABLE "public"."club_courts" TO "anon";
GRANT ALL ON TABLE "public"."club_courts" TO "authenticated";
GRANT ALL ON TABLE "public"."club_courts" TO "service_role";



GRANT ALL ON TABLE "public"."court_visits" TO "anon";
GRANT ALL ON TABLE "public"."court_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."court_visits" TO "service_role";



GRANT ALL ON TABLE "public"."doubles_teams" TO "anon";
GRANT ALL ON TABLE "public"."doubles_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."doubles_teams" TO "service_role";



GRANT ALL ON TABLE "public"."elo_calculation_logs" TO "anon";
GRANT ALL ON TABLE "public"."elo_calculation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."elo_calculation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."find_lost_posts" TO "anon";
GRANT ALL ON TABLE "public"."find_lost_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."find_lost_posts" TO "service_role";



GRANT ALL ON TABLE "public"."live_match_votes" TO "anon";
GRANT ALL ON TABLE "public"."live_match_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."live_match_votes" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_listings" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_listings" TO "service_role";



GRANT ALL ON TABLE "public"."match_health_data" TO "anon";
GRANT ALL ON TABLE "public"."match_health_data" TO "authenticated";
GRANT ALL ON TABLE "public"."match_health_data" TO "service_role";



GRANT ALL ON TABLE "public"."match_motion_stats" TO "anon";
GRANT ALL ON TABLE "public"."match_motion_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."match_motion_stats" TO "service_role";



GRANT ALL ON TABLE "public"."match_player_paths" TO "anon";
GRANT ALL ON TABLE "public"."match_player_paths" TO "authenticated";
GRANT ALL ON TABLE "public"."match_player_paths" TO "service_role";



GRANT ALL ON TABLE "public"."match_rally_stats" TO "anon";
GRANT ALL ON TABLE "public"."match_rally_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."match_rally_stats" TO "service_role";



GRANT ALL ON TABLE "public"."match_sensor_analytics" TO "anon";
GRANT ALL ON TABLE "public"."match_sensor_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."match_sensor_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."match_stroke_analytics" TO "anon";
GRANT ALL ON TABLE "public"."match_stroke_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."match_stroke_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."match_video_calibration" TO "anon";
GRANT ALL ON TABLE "public"."match_video_calibration" TO "authenticated";
GRANT ALL ON TABLE "public"."match_video_calibration" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."player_endorsements" TO "anon";
GRANT ALL ON TABLE "public"."player_endorsements" TO "authenticated";
GRANT ALL ON TABLE "public"."player_endorsements" TO "service_role";



GRANT ALL ON TABLE "public"."player_sleep_data" TO "anon";
GRANT ALL ON TABLE "public"."player_sleep_data" TO "authenticated";
GRANT ALL ON TABLE "public"."player_sleep_data" TO "service_role";



GRANT ALL ON TABLE "public"."recycle_bin" TO "anon";
GRANT ALL ON TABLE "public"."recycle_bin" TO "authenticated";
GRANT ALL ON TABLE "public"."recycle_bin" TO "service_role";



GRANT ALL ON TABLE "public"."search_players_view" TO "anon";
GRANT ALL ON TABLE "public"."search_players_view" TO "authenticated";
GRANT ALL ON TABLE "public"."search_players_view" TO "service_role";



GRANT ALL ON TABLE "public"."sent_fan_notifications" TO "anon";
GRANT ALL ON TABLE "public"."sent_fan_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."sent_fan_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."site_data" TO "anon";
GRANT ALL ON TABLE "public"."site_data" TO "authenticated";
GRANT ALL ON TABLE "public"."site_data" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_matches" TO "anon";
GRANT ALL ON TABLE "public"."tournament_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_matches" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_participants" TO "anon";
GRANT ALL ON TABLE "public"."tournament_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_participants" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_round_rules" TO "anon";
GRANT ALL ON TABLE "public"."tournament_round_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_round_rules" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."umpire_assignments" TO "anon";
GRANT ALL ON TABLE "public"."umpire_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."umpire_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."user_feedback" TO "anon";
GRANT ALL ON TABLE "public"."user_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."user_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."user_match_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_match_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_match_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."user_player_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_player_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_player_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."venue_presence_events" TO "anon";
GRANT ALL ON TABLE "public"."venue_presence_events" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_presence_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























