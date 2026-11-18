-- Rollback for 20261118120000_drop_friendly_matches_and_unused_objects.sql
-- Generated on 2026-11-18 from a pg_dump of production taken just before the
-- migration ran, plus pg_get_functiondef() output for every dropped/rewritten
-- function. Run with: supabase db query --remote -f <this file>
BEGIN;

-- 1. Tables, constraints, indexes, triggers, policies and grants
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
    "ended_at" timestamp with time zone,
    "video_url" "text"
);

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

ALTER TABLE "public"."matches" OWNER TO "postgres";

ALTER TABLE "public"."doubles_teams" OWNER TO "postgres";

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_player1_id_player2_id_key" UNIQUE ("player1_id", "player2_id");

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

ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."doubles_teams"
    ADD CONSTRAINT "doubles_teams_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;

ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."doubles_teams" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Umpires can insert matches" ON "public"."matches" FOR INSERT WITH CHECK ("public"."is_admin_or_umpire"());

CREATE POLICY "Admins and Umpires can update matches" ON "public"."matches" FOR UPDATE USING ("public"."is_admin_or_umpire"()) WITH CHECK ("public"."is_admin_or_umpire"());

CREATE POLICY "Admins can delete matches" ON "public"."matches" FOR DELETE USING ("public"."is_admin_or_master"());

CREATE POLICY "Allow public read access to confirmed matches" ON "public"."matches" FOR SELECT USING (("status" IS DISTINCT FROM 'pending'::"text"));

CREATE POLICY "Anyone can read matches" ON "public"."matches" FOR SELECT USING (true);

CREATE POLICY "Players can read their pending matches" ON "public"."matches" FOR SELECT USING ((("status" = 'pending'::"text") AND (((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")) OR ("auth"."uid"() = "team1_partner_id")) OR ("auth"."uid"() = "team2_partner_id"))));

CREATE POLICY "Anyone can read doubles_teams" ON "public"."doubles_teams" FOR SELECT USING (true);

CREATE POLICY "Players can create teams they are part of" ON "public"."doubles_teams" FOR INSERT WITH CHECK ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));

CREATE POLICY "Players can delete their own teams" ON "public"."doubles_teams" FOR DELETE USING ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));

CREATE POLICY "Players can update their own teams" ON "public"."doubles_teams" FOR UPDATE USING ((("auth"."uid"() = "player1_id") OR ("auth"."uid"() = "player2_id")));

GRANT ALL ON TABLE "public"."matches" TO "anon";

GRANT ALL ON TABLE "public"."matches" TO "authenticated";

GRANT ALL ON TABLE "public"."matches" TO "service_role";

GRANT ALL ON TABLE "public"."doubles_teams" TO "anon";

GRANT ALL ON TABLE "public"."doubles_teams" TO "authenticated";

GRANT ALL ON TABLE "public"."doubles_teams" TO "service_role";

-- 2. Dropped functions
CREATE OR REPLACE FUNCTION public._player_private_columns()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$ SELECT ARRAY['email', 'iisc_email', 'contact_number', 'sr_number']::TEXT[] $function$;

ALTER FUNCTION "public"."_player_private_columns"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."_player_private_columns"() TO "service_role";

CREATE OR REPLACE FUNCTION public.accept_buddy_request(p_target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_buddy_request"("p_target_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.accept_friendly_match(match_uuid uuid, confirmer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_friendly_match"("match_uuid" "uuid", "confirmer_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.admin_assign_umpires(p_user_ids uuid[], p_tournament_match_id uuid DEFAULT NULL::uuid, p_start_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_time timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

ALTER FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_assign_umpires"("p_user_ids" "uuid"[], "p_tournament_match_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "service_role";

CREATE OR REPLACE FUNCTION public.admin_delete_umpire_assignment(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

ALTER FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_umpire_assignment"("p_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.admin_move_player_in_bracket(p_match_id uuid, p_slot smallint, p_player_id uuid, p_partner_id uuid, p_label text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_move_player_in_bracket"("p_match_id" "uuid", "p_slot" smallint, "p_player_id" "uuid", "p_partner_id" "uuid", "p_label" "text") TO "service_role";

CREATE OR REPLACE FUNCTION public.approve_player(player_id text, admin_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.approve_player(player_id uuid, admin_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "text", "admin_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_player"("player_id" "uuid", "admin_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.auto_claim_duplicate_profile()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_auth_email TEXT;
  v_old_id UUID;
  v_new_id UUID;
BEGIN
  v_new_id := auth.uid();
  v_auth_email := (auth.jwt() ->> 'email');
  
  IF v_auth_email IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO v_old_id 
  FROM players 
  WHERE (email = v_auth_email OR iisc_email = v_auth_email) 
    AND id != v_new_id
  ORDER BY is_guest DESC
  LIMIT 1;

  IF v_old_id IS NULL THEN
    RETURN false;
  END IF;

  -- Match references
  UPDATE matches SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE matches SET player2_id = v_new_id WHERE player2_id = v_old_id;
  UPDATE matches SET team1_partner_id = v_new_id WHERE team1_partner_id = v_old_id;
  UPDATE matches SET team2_partner_id = v_new_id WHERE team2_partner_id = v_old_id;
  UPDATE matches SET winner_id = v_new_id WHERE winner_id = v_old_id;
  UPDATE matches SET submitted_by = v_new_id WHERE submitted_by = v_old_id;
  
  -- Tournament specific references
  UPDATE tournament_registrations SET player1_id = v_new_id WHERE player1_id = v_old_id;
  UPDATE tournament_registrations SET player2_id = v_new_id WHERE player2_id = v_old_id;
  
  -- Team references (New for Team Events)
  UPDATE tournament_team_members SET player_id = v_new_id WHERE player_id = v_old_id;
  UPDATE tournament_teams SET captain_id = v_new_id WHERE captain_id = v_old_id;

  -- Other
  UPDATE elo_logs SET player_id = v_new_id WHERE player_id = v_old_id;
  UPDATE venue_presence_events SET player_id = v_new_id WHERE player_id = v_old_id;
  UPDATE feedback SET user_id = v_new_id WHERE user_id = v_old_id;

  -- Delete the old row
  DELETE FROM players WHERE id = v_old_id;

  RETURN true;
END;
$function$;

ALTER FUNCTION "public"."auto_claim_duplicate_profile"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."auto_claim_duplicate_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_claim_duplicate_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_claim_duplicate_profile"() TO "service_role";

CREATE OR REPLACE FUNCTION public.cancel_buddy_request(p_target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id;
END;
$function$;

ALTER FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_buddy_request"("p_target_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.check_tournament_court_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_conflict_code text;
  v_est_minutes integer := 30;
  v_unavailable_period jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.court_number IS NOT DISTINCT FROM NEW.court_number
    AND OLD.scheduled_at IS NOT DISTINCT FROM NEW.scheduled_at
    AND OLD.started_at IS NOT DISTINCT FROM NEW.started_at
    AND OLD.ended_at IS NOT DISTINCT FROM NEW.ended_at
    AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('completed', 'walkover', 'cancelled')
    OR NULLIF(BTRIM(NEW.court_number), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read tournament policy
  SELECT COALESCE(estimated_match_minutes, 30)
  INTO v_est_minutes
  FROM public.tournaments
  WHERE id = NEW.tournament_id;

  v_start := COALESCE(NEW.started_at, NEW.scheduled_at);
  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;
  v_end := COALESCE(NEW.ended_at, v_start + (v_est_minutes || ' minutes')::interval);

  IF v_end <= v_start THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'court_interval_invalid: end must be later than start';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.tournament_id::text || ':' || LOWER(BTRIM(NEW.court_number)), 0)
  );

  -- HARD CONSTRAINT: Check if court is in an unavailable court period
  SELECT elem
  INTO v_unavailable_period
  FROM public.tournaments t,
       jsonb_array_elements(t.unavailable_court_periods) elem
  WHERE t.id = NEW.tournament_id
    AND LOWER(BTRIM(elem->>'court')) = LOWER(BTRIM(NEW.court_number))
    AND v_start < (elem->>'end')::timestamptz
    AND (elem->>'start')::timestamptz < v_end
  LIMIT 1;

  IF v_unavailable_period IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format(
        'court_unavailable: court %s is unavailable (%s)',
        NEW.court_number,
        COALESCE(v_unavailable_period->>'reason', 'Scheduled maintenance / blackout')
      );
  END IF;

  -- HARD CONSTRAINT: Check if court is currently occupied now by an active match
  SELECT COALESCE(other.match_code, other.id::text)
  INTO v_conflict_code
  FROM public.tournament_matches other
  WHERE other.id <> NEW.id
    AND other.tournament_id = NEW.tournament_id
    AND LOWER(BTRIM(other.court_number)) = LOWER(BTRIM(NEW.court_number))
    AND other.status IN ('in_progress', 'live', 'playing', 'ready', 'warming_up', 'paused')
    AND NOT (NEW.tie_id IS NOT NULL AND other.tie_id = NEW.tie_id)
  LIMIT 1;

  IF v_conflict_code IS NOT NULL AND NEW.status IN ('in_progress', 'live', 'playing') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format('court_in_use: court %s is currently occupied by %s', NEW.court_number, v_conflict_code);
  END IF;

  -- ESTIMATED OVERLAP: If an override with non-empty reason is present, allow it
  IF NEW.schedule_override_reason IS NOT NULL AND length(btrim(NEW.schedule_override_reason)) > 0 THEN
    RETURN NEW;
  END IF;

  -- Otherwise, prevent estimated overlap on scheduled matches
  SELECT COALESCE(other.match_code, other.id::text)
  INTO v_conflict_code
  FROM public.tournament_matches other
  WHERE other.id <> NEW.id
    AND other.tournament_id = NEW.tournament_id
    AND LOWER(BTRIM(other.court_number)) = LOWER(BTRIM(NEW.court_number))
    AND other.status NOT IN ('walkover', 'cancelled')
    AND (other.status <> 'completed' OR other.ended_at IS NOT NULL)
    AND COALESCE(other.started_at, other.scheduled_at) IS NOT NULL
    AND NOT (NEW.tie_id IS NOT NULL AND other.tie_id = NEW.tie_id)
    AND v_start < COALESCE(
      other.ended_at,
      COALESCE(other.started_at, other.scheduled_at) + (v_est_minutes || ' minutes')::interval
    )
    AND COALESCE(other.started_at, other.scheduled_at) < v_end
  ORDER BY COALESCE(other.started_at, other.scheduled_at)
  LIMIT 1;

  IF v_conflict_code IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = format(
        'court_conflict: court %s overlaps %s',
        NEW.court_number,
        v_conflict_code
      );
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."check_tournament_court_overlap"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."check_tournament_court_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_tournament_court_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_tournament_court_overlap"() TO "service_role";

CREATE OR REPLACE FUNCTION public.cleanup_stale_push_tokens()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.user_push_tokens
  WHERE updated_at < NOW() - INTERVAL '7 days';

  RAISE NOTICE 'Cleaned up stale push tokens older than 7 days';
END;
$function$;

ALTER FUNCTION "public"."cleanup_stale_push_tokens"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stale_push_tokens"() TO "service_role";

CREATE OR REPLACE FUNCTION public.complete_match(p_match_id uuid, p_winner_id uuid, p_umpire_id uuid, p_game1_s1 integer, p_game1_s2 integer, p_game2_s1 integer, p_game2_s2 integer, p_game3_s1 integer DEFAULT NULL::integer, p_game3_s2 integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match       tournament_matches%ROWTYPE;
  v_winner_side INT;
  v_winner_id   UUID;
BEGIN
  -- Fetch the match
  SELECT * INTO v_match
  FROM tournament_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  IF v_match.status = 'completed' THEN
    RAISE EXCEPTION 'Match % is already completed', p_match_id;
  END IF;

  -- Verify umpire/manager permission
  IF NOT (
    is_admin_or_master()
    OR is_tournament_manager(v_match.tournament_id)
    OR (v_match.umpire_id IS NOT NULL AND v_match.umpire_id = p_umpire_id)
    OR EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = auth.uid()
        AND p.role IN ('umpire', 'admin', 'master_admin')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned umpire, tournament manager, or admin can finalize';
  END IF;

  -- Determine winner side and ID
  IF p_winner_id IS NOT NULL THEN
    v_winner_id := p_winner_id;
    IF p_winner_id = v_match.player1_id THEN
      v_winner_side := 1;
    ELSIF p_winner_id = v_match.player2_id THEN
      v_winner_side := 2;
    ELSE
      v_winner_side := 1;
    END IF;
  ELSE
    DECLARE
      v_sets_side1 INT := 0;
      v_sets_side2 INT := 0;
    BEGIN
      IF p_game1_s1 > p_game1_s2 THEN v_sets_side1 := v_sets_side1 + 1;
      ELSIF p_game1_s2 > p_game1_s1 THEN v_sets_side2 := v_sets_side2 + 1;
      END IF;

      IF p_game2_s1 > p_game2_s2 THEN v_sets_side1 := v_sets_side1 + 1;
      ELSIF p_game2_s2 > p_game2_s1 THEN v_sets_side2 := v_sets_side2 + 1;
      END IF;

      IF p_game3_s1 IS NOT NULL AND p_game3_s2 IS NOT NULL THEN
        IF p_game3_s1 > p_game3_s2 THEN v_sets_side1 := v_sets_side1 + 1;
        ELSIF p_game3_s2 > p_game3_s1 THEN v_sets_side2 := v_sets_side2 + 1;
        END IF;
      END IF;

      IF v_sets_side1 > v_sets_side2 THEN
        v_winner_side := 1;
        v_winner_id   := v_match.player1_id;
      ELSE
        v_winner_side := 2;
        v_winner_id   := v_match.player2_id;
      END IF;
    END;
  END IF;

  -- Persist the match completion
  UPDATE tournament_matches
  SET
    game1_score1 = p_game1_s1,
    game1_score2 = p_game1_s2,
    game2_score1 = p_game2_s1,
    game2_score2 = p_game2_s2,
    game3_score1 = p_game3_s1,
    game3_score2 = p_game3_s2,
    winner_id    = v_winner_id,
    winner_side  = v_winner_side,
    status       = 'completed',
    locked       = TRUE,
    umpired_by   = p_umpire_id,
    scored_by    = auth.uid(),
    scored_at    = NOW()
  WHERE id = p_match_id;

  -- TEAM EVENTS: Update Tie Score if this match belongs to a Tie
  IF v_match.tie_id IS NOT NULL THEN
    DECLARE
      v_score_a INTEGER;
      v_score_b INTEGER;
      v_total_rubbers INTEGER;
      v_pending_deciders INTEGER;
      v_tie tournament_ties%ROWTYPE;
    BEGIN
      -- Calculate current score
      SELECT COUNT(*) INTO v_score_a FROM tournament_matches WHERE tie_id = v_match.tie_id AND status = 'completed' AND winner_side = 1;
      SELECT COUNT(*) INTO v_score_b FROM tournament_matches WHERE tie_id = v_match.tie_id AND status = 'completed' AND winner_side = 2;
      SELECT COUNT(*) INTO v_total_rubbers FROM tournament_matches WHERE tie_id = v_match.tie_id;
      SELECT COUNT(*) INTO v_pending_deciders FROM tournament_matches WHERE tie_id = v_match.tie_id AND is_decider_tiebreaker = true AND status <> 'completed';
      
      UPDATE tournament_ties SET
        score_team_a = v_score_a,
        score_team_b = v_score_b,
        updated_at = NOW()
      WHERE id = v_match.tie_id
      RETURNING * INTO v_tie;

      -- Check if current match was a decider match
      IF v_match.is_decider_tiebreaker THEN
        -- Decider finished!
        IF v_winner_side = 1 THEN
          UPDATE tournament_ties SET state = 'COMPLETED', decider_status = 'COMPLETED', winner_team_id = v_tie.team_a_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        ELSE
          UPDATE tournament_ties SET state = 'COMPLETED', decider_status = 'COMPLETED', winner_team_id = v_tie.team_b_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        END IF;
      ELSE
        -- Standard rubber
        IF v_score_a > (v_total_rubbers / 2) AND v_pending_deciders = 0 THEN
          UPDATE tournament_ties SET state = 'COMPLETED', winner_team_id = v_tie.team_a_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        ELSIF v_score_b > (v_total_rubbers / 2) AND v_pending_deciders = 0 THEN
          UPDATE tournament_ties SET state = 'COMPLETED', winner_team_id = v_tie.team_b_id WHERE id = v_tie.id RETURNING * INTO v_tie;
        ELSIF (v_score_a + v_score_b) = v_total_rubbers THEN
          -- Tied and no decider pending? Check if tie has decider enabled
          IF v_tie.has_decider_rubber OR v_pending_deciders > 0 THEN
            UPDATE tournament_ties SET state = 'IN_PROGRESS', decider_status = 'AWAITING_LINEUPS' WHERE id = v_tie.id RETURNING * INTO v_tie;
          ELSE
            UPDATE tournament_ties SET state = 'COMPLETED' WHERE id = v_tie.id RETURNING * INTO v_tie;
          END IF;
        END IF;
      END IF;

      -- Bracket Advancement Logic
      IF v_tie.winner_team_id IS NOT NULL AND v_tie.advances_to_tie IS NOT NULL THEN
        IF v_tie.advances_to_slot = 'A' THEN
            UPDATE tournament_ties SET team_a_id = v_tie.winner_team_id WHERE id = v_tie.advances_to_tie;
        ELSIF v_tie.advances_to_slot = 'B' THEN
            UPDATE tournament_ties SET team_b_id = v_tie.winner_team_id WHERE id = v_tie.advances_to_tie;
        END IF;
      END IF;
      IF v_tie.winner_team_id IS NOT NULL AND v_tie.loser_advances_to_tie IS NOT NULL THEN
        DECLARE
          v_loser_team_id uuid;
        BEGIN
          IF v_tie.winner_team_id = v_tie.team_a_id THEN v_loser_team_id := v_tie.team_b_id; ELSE v_loser_team_id := v_tie.team_a_id; END IF;
          IF v_tie.loser_advances_to_slot = 'A' THEN
              UPDATE tournament_ties SET team_a_id = v_loser_team_id WHERE id = v_tie.loser_advances_to_tie;
          ELSIF v_tie.loser_advances_to_slot = 'B' THEN
              UPDATE tournament_ties SET team_b_id = v_loser_team_id WHERE id = v_tie.loser_advances_to_tie;
          END IF;
        END;
      END IF;
    END;
  ELSE
    -- Only trigger bracket progression for Open Events
    PERFORM process_tournament_bracket_progression(p_match_id, v_winner_id);
  END IF;
END;
$function$;

ALTER FUNCTION "public"."complete_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_umpire_id" "uuid", "p_game1_s1" integer, "p_game1_s2" integer, "p_game2_s1" integer, "p_game2_s2" integer, "p_game3_s1" integer, "p_game3_s2" integer) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."complete_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_umpire_id" "uuid", "p_game1_s1" integer, "p_game1_s2" integer, "p_game2_s1" integer, "p_game2_s2" integer, "p_game3_s1" integer, "p_game3_s2" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."complete_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_umpire_id" "uuid", "p_game1_s1" integer, "p_game1_s2" integer, "p_game2_s1" integer, "p_game2_s2" integer, "p_game3_s1" integer, "p_game3_s2" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_umpire_id" "uuid", "p_game1_s1" integer, "p_game1_s2" integer, "p_game2_s1" integer, "p_game2_s2" integer, "p_game3_s1" integer, "p_game3_s2" integer) TO "service_role";

CREATE OR REPLACE FUNCTION public.confirm_friendly_match(match_uuid uuid, confirmer_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_friendly_match"("match_uuid" "uuid", "confirmer_id" "text") TO "service_role";

CREATE OR REPLACE FUNCTION public.debug_recalc()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$;

ALTER FUNCTION "public"."debug_recalc"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."debug_recalc"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_recalc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_recalc"() TO "service_role";

CREATE OR REPLACE FUNCTION public.get_court_popularity()
 RETURNS TABLE(day_of_week smallint, hour smallint, visit_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT 
    day_of_week, 
    hour, 
    COUNT(*) AS visit_count 
  FROM public.court_visits 
  GROUP BY day_of_week, hour;
$function$;

ALTER FUNCTION "public"."get_court_popularity"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."get_court_popularity"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_court_popularity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_court_popularity"() TO "service_role";

CREATE OR REPLACE FUNCTION public.get_expected_score(p_team_elo numeric, p_opponent_elo numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN 1.0 / (1.0 + POWER(10.0, (p_opponent_elo - p_team_elo) / 400.0));
END;
$function$;

ALTER FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_expected_score"("p_team_elo" numeric, "p_opponent_elo" numeric) TO "service_role";

CREATE OR REPLACE FUNCTION public.increment_match_score(match_id uuid, p1_increment integer, p2_increment integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_match_score"("match_id" "uuid", "p1_increment" integer, "p2_increment" integer) TO "service_role";

CREATE OR REPLACE FUNCTION public.is_active_team_member(t_team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM tournament_team_members 
        WHERE team_id = t_team_id 
        AND player_id = auth.uid() 
        AND status = 'ACTIVE'
    );
$function$;

ALTER FUNCTION "public"."is_active_team_member"("t_team_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."is_active_team_member"("t_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_team_member"("t_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_team_member"("t_team_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.is_authorized_for_analytics(p_auth_uid uuid, p_match_id uuid, p_match_source text, p_target_player uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

ALTER FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authorized_for_analytics"("p_auth_uid" "uuid", "p_match_id" "uuid", "p_match_source" "text", "p_target_player" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.notify_players_on_match_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."notify_players_on_match_confirm"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_confirm"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_confirm"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_confirm"() TO "service_role";

CREATE OR REPLACE FUNCTION public.notify_players_on_match_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."notify_players_on_match_insert"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_players_on_match_insert"() TO "service_role";

CREATE OR REPLACE FUNCTION public.recalculate_all_win_loss_records()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  rec RECORD;
BEGIN
  -- We just apply the logic for all players efficiently using the same CTE but without the player_id filter
  WITH match_participants AS (
    SELECT 
      m.id as match_id,
      COALESCE(m.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = m.player1_id OR p.id = m.team1_partner_id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) THEN true
        WHEN (p.id = m.player2_id OR p.id = m.team2_partner_id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) THEN true
        ELSE false
      END as is_win
    FROM matches m
    JOIN players p ON p.id IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id)
    WHERE m.status = 'confirmed' AND p.id IS NOT NULL

    UNION ALL

    SELECT 
      tm.id as match_id,
      COALESCE(tm.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = tm.player1_id OR p.id = tm.player3_id) AND (tm.winner_id = tm.player1_id OR tm.winner_id = tm.player3_id) THEN true
        WHEN (p.id = tm.player2_id OR p.id = tm.player4_id) AND (tm.winner_id = tm.player2_id OR tm.winner_id = tm.player4_id) THEN true
        ELSE false
      END as is_win
    FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    JOIN players p ON p.id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
    WHERE tm.status = 'completed' AND t.status != 'deleted' AND p.id IS NOT NULL
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
  ),
  aggregated_stats AS (
    SELECT 
      player_id,
      COUNT(*) FILTER (WHERE is_win) as overall_wins,
      COUNT(*) FILTER (WHERE NOT is_win) as overall_losses,
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND is_win) as singles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND NOT is_win) as singles_losses,
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND is_win) as doubles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND NOT is_win) as doubles_losses,
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND is_win) as mixed_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND NOT is_win) as mixed_losses
    FROM match_participants
    GROUP BY player_id
  )
  UPDATE players p
  SET 
    win_loss_record = COALESCE(ast.overall_wins, 0) || 'W - ' || COALESCE(ast.overall_losses, 0) || 'L',
    singles_record = COALESCE(ast.singles_wins, 0) || 'W - ' || COALESCE(ast.singles_losses, 0) || 'L',
    doubles_record = COALESCE(ast.doubles_wins, 0) || 'W - ' || COALESCE(ast.doubles_losses, 0) || 'L',
    mixed_record = COALESCE(ast.mixed_wins, 0) || 'W - ' || COALESCE(ast.mixed_losses, 0) || 'L'
  FROM aggregated_stats ast
  WHERE p.id = ast.player_id;

  -- Reset players with NO matches
  UPDATE players
  SET 
    win_loss_record = '0W - 0L', singles_record = '0W - 0L', doubles_record = '0W - 0L', mixed_record = '0W - 0L'
  WHERE id NOT IN (
    SELECT p.id FROM matches m JOIN players p ON p.id IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id) WHERE m.status = 'confirmed' AND p.id IS NOT NULL
    UNION
    SELECT p.id FROM tournament_matches tm JOIN tournaments t ON t.id = tm.tournament_id JOIN players p ON p.id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id) WHERE tm.status = 'completed' AND t.status != 'deleted' AND p.id IS NOT NULL AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
  );

END;
$function$;

ALTER FUNCTION "public"."recalculate_all_win_loss_records"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."recalculate_all_win_loss_records"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_all_win_loss_records"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_all_win_loss_records"() TO "service_role";

CREATE OR REPLACE FUNCTION public.recalculate_player_win_loss_records(p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  WITH match_participants AS (
    -- Friendly Matches
    SELECT 
      m.id as match_id,
      COALESCE(m.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = m.player1_id OR p.id = m.team1_partner_id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) THEN true
        WHEN (p.id = m.player2_id OR p.id = m.team2_partner_id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) THEN true
        ELSE false
      END as is_win
    FROM matches m
    JOIN players p ON p.id IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id)
    WHERE m.status = 'confirmed' AND p.id = p_player_id

    UNION ALL

    -- Tournament Matches
    SELECT 
      tm.id as match_id,
      COALESCE(tm.category, 'Singles') as category,
      p.id as player_id,
      CASE 
        WHEN (p.id = tm.player1_id OR p.id = tm.player3_id) AND (tm.winner_id = tm.player1_id OR tm.winner_id = tm.player3_id) THEN true
        WHEN (p.id = tm.player2_id OR p.id = tm.player4_id) AND (tm.winner_id = tm.player2_id OR tm.winner_id = tm.player4_id) THEN true
        ELSE false
      END as is_win
    FROM tournament_matches tm
    JOIN tournaments t ON t.id = tm.tournament_id
    JOIN players p ON p.id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
    WHERE tm.status = 'completed' AND t.status != 'deleted' AND p.id = p_player_id
      AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL -- Exclude BYEs
  ),
  aggregated_stats AS (
    SELECT 
      player_id,
      
      -- Overall
      COUNT(*) FILTER (WHERE is_win) as overall_wins,
      COUNT(*) FILTER (WHERE NOT is_win) as overall_losses,
      
      -- Singles
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND is_win) as singles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Singles%' OR category ILIKE '%MS%' OR category ILIKE '%WS%') AND NOT is_win) as singles_losses,
      
      -- Doubles
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND is_win) as doubles_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Doubles%' OR category ILIKE '%MD%' OR category ILIKE '%WD%') AND category NOT ILIKE '%Mixed%' AND category NOT ILIKE '%XD%' AND NOT is_win) as doubles_losses,
      
      -- Mixed
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND is_win) as mixed_wins,
      COUNT(*) FILTER (WHERE (category ILIKE '%Mixed%' OR category ILIKE '%XD%') AND NOT is_win) as mixed_losses
      
    FROM match_participants
    GROUP BY player_id
  )
  UPDATE players p
  SET 
    win_loss_record = COALESCE(ast.overall_wins, 0) || 'W - ' || COALESCE(ast.overall_losses, 0) || 'L',
    singles_record = COALESCE(ast.singles_wins, 0) || 'W - ' || COALESCE(ast.singles_losses, 0) || 'L',
    doubles_record = COALESCE(ast.doubles_wins, 0) || 'W - ' || COALESCE(ast.doubles_losses, 0) || 'L',
    mixed_record = COALESCE(ast.mixed_wins, 0) || 'W - ' || COALESCE(ast.mixed_losses, 0) || 'L'
  FROM aggregated_stats ast
  WHERE p.id = p_player_id AND p.id = ast.player_id;

  -- If player had no matches, reset them
  IF NOT FOUND THEN
    UPDATE players
    SET 
      win_loss_record = '0W - 0L',
      singles_record = '0W - 0L',
      doubles_record = '0W - 0L',
      mixed_record = '0W - 0L'
    WHERE id = p_player_id;
  END IF;
END;
$function$;

ALTER FUNCTION "public"."recalculate_player_win_loss_records"("p_player_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."recalculate_player_win_loss_records"("p_player_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_player_win_loss_records"("p_player_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_player_win_loss_records"("p_player_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.reject_friendly_match(match_uuid uuid, rejecter_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.reject_friendly_match(match_uuid uuid, rejecter_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_friendly_match"("match_uuid" "uuid", "rejecter_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.remove_buddy(p_target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), p_target_id::text) WHERE id = v_my_id;
  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), v_my_id::text)     WHERE id = p_target_id;
END;
$function$;

ALTER FUNCTION "public"."remove_buddy"("p_target_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."remove_buddy"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_buddy"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_buddy"("p_target_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.rollback_elo_on_match_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

ALTER FUNCTION "public"."rollback_elo_on_match_delete"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."rollback_elo_on_match_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_elo_on_match_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_elo_on_match_delete"() TO "service_role";

CREATE OR REPLACE FUNCTION public.save_tie_lineup(p_tie_id uuid, p_side text, p_assignments jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_team_id uuid;
    v_state text;
    v_is_locked boolean;
    a jsonb;
    v_player1_id uuid;
    v_player2_id uuid;
BEGIN
    SELECT state, 
           CASE WHEN p_side = 'A' THEN team_a_id ELSE team_b_id END,
           CASE WHEN p_side = 'A' THEN lineup_locked_a ELSE lineup_locked_b END
    INTO v_state, v_team_id, v_is_locked
    FROM tournament_ties WHERE id = p_tie_id;

    IF v_state != 'AWAITING_LINEUPS' THEN
        RAISE EXCEPTION 'Tie is not accepting lineups at this time.';
    END IF;
    IF v_is_locked THEN
        RAISE EXCEPTION 'Lineup is already locked.';
    END IF;
    IF NOT is_team_staff(v_team_id) THEN
        RAISE EXCEPTION 'Unauthorized to save lineup for this team.';
    END IF;

    -- Upsert loop
    FOR a IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
        v_player1_id := (a->>'player1_id')::uuid;
        v_player2_id := NULLIF(a->>'player2_id', '')::uuid;
        
        -- Basic validation: Ensure players belong to the ACTIVE roster
        IF NOT EXISTS (SELECT 1 FROM tournament_team_members WHERE team_id = v_team_id AND player_id = v_player1_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Player % is not an active team member.', v_player1_id;
        END IF;

        IF v_player2_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tournament_team_members WHERE team_id = v_team_id AND player_id = v_player2_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Player % is not an active team member.', v_player2_id;
        END IF;

        INSERT INTO tie_lineups (tie_id, side, rubber_order, player1_id, player2_id, submitted_by)
        VALUES (p_tie_id, p_side, (a->>'rubber_order')::int, v_player1_id, v_player2_id, auth.uid())
        ON CONFLICT (tie_id, side, rubber_order) 
        DO UPDATE SET player1_id = EXCLUDED.player1_id, player2_id = EXCLUDED.player2_id, submitted_by = EXCLUDED.submitted_by, updated_at = now();
    END LOOP;

    RETURN true;
END;
$function$;

ALTER FUNCTION "public"."save_tie_lineup"("p_tie_id" "uuid", "p_side" "text", "p_assignments" "jsonb") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."save_tie_lineup"("p_tie_id" "uuid", "p_side" "text", "p_assignments" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_tie_lineup"("p_tie_id" "uuid", "p_side" "text", "p_assignments" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_tie_lineup"("p_tie_id" "uuid", "p_side" "text", "p_assignments" "jsonb") TO "service_role";

CREATE OR REPLACE FUNCTION public.send_buddy_request(p_target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_append(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id
    AND NOT (v_my_id::text = ANY(COALESCE(buddy_requests, ARRAY[]::TEXT[])));
END;
$function$;

ALTER FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_buddy_request"("p_target_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.soft_delete_player(player_id text, admin_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") OWNER TO "postgres";
ALTER FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "service_role";

CREATE OR REPLACE FUNCTION public.soft_delete_player(target_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

ALTER FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") OWNER TO "postgres";
ALTER FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("target_player_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_player"("player_id" "text", "admin_email" "text") TO "service_role";

CREATE OR REPLACE FUNCTION public.submit_friendly_match(submitter_id text, opponent_id text, match_winner_id text, match_score text, submitter_partner_id text DEFAULT NULL::text, opponent_partner_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "service_role";

CREATE OR REPLACE FUNCTION public.submit_friendly_match(submitter_id text, opponent_id text, match_winner_id text, match_score text, submitter_partner_id text DEFAULT NULL::text, opponent_partner_id text DEFAULT NULL::text, is_cross_gender_singles boolean DEFAULT false, is_hybrid boolean DEFAULT false, is_mixed_category_doubles boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_friendly_match"("submitter_id" "text", "opponent_id" "text", "match_winner_id" "text", "match_score" "text", "submitter_partner_id" "text", "opponent_partner_id" "text", "is_cross_gender_singles" boolean, "is_hybrid" boolean, "is_mixed_category_doubles" boolean) TO "service_role";

CREATE OR REPLACE FUNCTION public.toggle_buddy(p_target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_buddy"("p_target_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.toggle_follow(p_target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."toggle_follow"("p_target_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."toggle_follow"("p_target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_follow"("p_target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_follow"("p_target_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.toggle_match_kudos(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_current_users uuid[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check if the match is in matches table (completed matches)
  SELECT kudos_users INTO v_current_users FROM public.matches WHERE id = p_match_id;
  
  IF FOUND THEN
    IF v_user_id = ANY(v_current_users) THEN
      UPDATE public.matches
      SET 
        kudos_users = array_remove(kudos_users, v_user_id),
        kudos_count = GREATEST(0, COALESCE(kudos_count, 0) - 1)
      WHERE id = p_match_id;
    ELSE
      UPDATE public.matches
      SET 
        kudos_users = array_append(COALESCE(kudos_users, '{}'), v_user_id),
        kudos_count = COALESCE(kudos_count, 0) + 1
      WHERE id = p_match_id;
    END IF;
    RETURN;
  END IF;

  -- 2. If not found in matches, check site_data (live matches)
  -- live_matches is a JSONB object mapping match_id -> match state
  -- We'll extract the current kudos_users string array from it if it exists.
  DECLARE
    v_site_data jsonb;
    v_match_data jsonb;
    v_users jsonb;
    v_new_users jsonb;
    v_count int;
  BEGIN
    SELECT value INTO v_site_data FROM public.site_data WHERE key = 'live_matches';
    IF v_site_data ? p_match_id::text THEN
      v_match_data := v_site_data -> p_match_id::text;
      v_users := COALESCE(v_match_data -> 'kudos_users', '[]'::jsonb);
      
      -- Check if user is in array
      IF v_users @> to_jsonb(v_user_id::text) THEN
        -- Remove user
        v_new_users := (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_users) elem WHERE elem #>> '{}' != v_user_id::text);
        v_new_users := COALESCE(v_new_users, '[]'::jsonb);
        v_count := GREATEST(0, COALESCE((v_match_data->>'kudos_count')::int, 0) - 1);
      ELSE
        -- Add user
        v_new_users := v_users || to_jsonb(v_user_id::text);
        v_count := COALESCE((v_match_data->>'kudos_count')::int, 0) + 1;
      END IF;
      
      -- Update site_data
      v_match_data := v_match_data || jsonb_build_object('kudos_users', v_new_users, 'kudos_count', v_count);
      UPDATE public.site_data 
      SET value = jsonb_set(value, array[p_match_id::text], v_match_data)
      WHERE key = 'live_matches';
      
      RETURN;
    END IF;
  END;
END;
$function$;

ALTER FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_match_kudos"("p_match_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.toggle_team_invite_token(p_team_id uuid, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_team_staff(p_team_id) AND NOT is_tournament_manager((SELECT tournament_id FROM tournament_teams WHERE id = p_team_id)) THEN
    RAISE EXCEPTION 'Only team captain or managers can configure invite links.';
  END IF;

  UPDATE tournament_teams
  SET invite_token_enabled = p_enabled
  WHERE id = p_team_id;

  RETURN p_enabled;
END;
$function$;

ALTER FUNCTION "public"."toggle_team_invite_token"("p_team_id" "uuid", "p_enabled" boolean) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."toggle_team_invite_token"("p_team_id" "uuid", "p_enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_team_invite_token"("p_team_id" "uuid", "p_enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_team_invite_token"("p_team_id" "uuid", "p_enabled" boolean) TO "service_role";

CREATE OR REPLACE FUNCTION public.transfer_umpire_duty(p_match_id uuid, p_new_umpire_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_umpire_duty"("p_match_id" "uuid", "p_new_umpire_id" "uuid") TO "service_role";

CREATE OR REPLACE FUNCTION public.trigger_buddy_request_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

ALTER FUNCTION "public"."trigger_buddy_request_notification"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."trigger_buddy_request_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_buddy_request_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_buddy_request_notification"() TO "service_role";

CREATE OR REPLACE FUNCTION public.trigger_challenge_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

ALTER FUNCTION "public"."trigger_challenge_notification"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."trigger_challenge_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_challenge_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_challenge_notification"() TO "service_role";

CREATE OR REPLACE FUNCTION public.trigger_update_category_records()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

ALTER FUNCTION "public"."trigger_update_category_records"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."trigger_update_category_records"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_category_records"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_category_records"() TO "service_role";

CREATE OR REPLACE FUNCTION public.umpire_submit_match(umpire_id text, player1_id text, player2_id text, team1_partner_id text, team2_partner_id text, winner_id text, match_score text, match_category text, match_round text, is_friendly boolean, sets_history text[] DEFAULT '{}'::text[], started_at timestamp with time zone DEFAULT NULL::timestamp with time zone, ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_submit_match"("umpire_id" "text", "player1_id" "text", "player2_id" "text", "team1_partner_id" "text", "team2_partner_id" "text", "winner_id" "text", "match_score" "text", "match_category" "text", "match_round" "text", "is_friendly" boolean, "sets_history" "text"[], "started_at" timestamp with time zone, "ended_at" timestamp with time zone) TO "service_role";

CREATE OR REPLACE FUNCTION public.umpire_update_match(match_uuid uuid, winner_id text, match_score text, match_category text, sets_history text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE matches
  SET
    winner_id = umpire_update_match.winner_id,
    score = umpire_update_match.match_score,
    category = umpire_update_match.match_category,
    sets_history = umpire_update_match.sets_history
  WHERE id = umpire_update_match.match_uuid;
END;
$function$;

ALTER FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) OWNER TO "postgres";
ALTER FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "service_role";

CREATE OR REPLACE FUNCTION public.umpire_update_match(match_uuid uuid, winner_id uuid, match_score text, match_category text, sets_history text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE matches
  SET
    winner_id = umpire_update_match.winner_id,
    match_score = umpire_update_match.match_score,
    category = umpire_update_match.match_category
  WHERE id = umpire_update_match.match_uuid;
END;
$function$;

ALTER FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) OWNER TO "postgres";
ALTER FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "text", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umpire_update_match"("match_uuid" "uuid", "winner_id" "uuid", "match_score" "text", "match_category" "text", "sets_history" "text"[]) TO "service_role";

CREATE OR REPLACE FUNCTION public.update_doubles_teams_elo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

ALTER FUNCTION "public"."update_doubles_teams_elo"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."update_doubles_teams_elo"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_doubles_teams_elo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_doubles_teams_elo"() TO "service_role";

CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";

CREATE OR REPLACE FUNCTION public.validate_tie_format(config jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    r jsonb;
    points_total int := 0;
BEGIN
    IF config IS NULL OR jsonb_array_length(config) = 0 THEN
        RETURN false;
    END IF;
    
    FOR r IN SELECT * FROM jsonb_array_elements(config) LOOP
        IF (r->>'order') IS NULL OR (r->>'category') IS NULL OR (r->>'points') IS NULL THEN
            RETURN false;
        END IF;
        IF (r->>'points')::int <= 0 THEN
            RETURN false;
        END IF;
        points_total := points_total + (r->>'points')::int;
    END LOOP;
    
    RETURN true;
END;
$function$;

ALTER FUNCTION "public"."validate_tie_format"("config" "jsonb") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."validate_tie_format"("config" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_tie_format"("config" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_tie_format"("config" "jsonb") TO "service_role";

-- 3. Triggers on the restored tables
CREATE OR REPLACE TRIGGER "on_match_confirmed_update_category_records" AFTER UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_category_records"();

CREATE OR REPLACE TRIGGER "on_match_insert_notify" AFTER INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."notify_players_on_match_insert"();

CREATE OR REPLACE TRIGGER "on_match_update_notify" AFTER UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."notify_players_on_match_confirm"();

CREATE OR REPLACE TRIGGER "trg_update_doubles_teams_elo" AFTER UPDATE OF "status" ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_doubles_teams_elo"();

CREATE OR REPLACE TRIGGER "trg_update_win_loss_friendly" AFTER INSERT OR DELETE OR UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_win_loss_records"();

CREATE OR REPLACE TRIGGER "trigger_rollback_elo_on_match_delete" AFTER DELETE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."rollback_elo_on_match_delete"();

-- 4. Previous definitions of the rewritten functions
CREATE OR REPLACE FUNCTION public._player_reference_columns()
 RETURNS TABLE(table_name text, column_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH fk AS (
    SELECT c.relname::text AS table_name, a.attname::text AS column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN unnest(con.conkey) AS k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE con.contype = 'f' AND con.confrelid = 'public.players'::regclass
      AND array_length(con.conkey, 1) = 1
  ),
  known(table_name, column_name) AS (
    VALUES
      ('matches', 'player1_id'), ('matches', 'player2_id'), ('matches', 'player3_id'), ('matches', 'player4_id'),
      ('matches', 'team1_partner_id'), ('matches', 'team2_partner_id'), ('matches', 'winner_id'),
      ('matches', 'submitted_by'), ('matches', 'umpired_by'), ('matches', 'recorded_by'),
      ('tournament_matches', 'player1_id'), ('tournament_matches', 'player2_id'),
      ('tournament_matches', 'player3_id'), ('tournament_matches', 'player4_id'),
      ('tournament_matches', 'winner_id'), ('tournament_matches', 'umpired_by'),
      ('tournament_matches', 'recorded_by'), ('tournament_matches', 'scored_by'),
      ('tournament_participants', 'player_id'), ('tournament_participants', 'partner_id'),
      ('tournament_teams', 'captain_id'),
      ('tournament_team_members', 'player_id'), ('tournament_team_members', 'invited_by'),
      ('tie_lineups', 'player1_id'), ('tie_lineups', 'player2_id'), ('tie_lineups', 'submitted_by'),
      ('elo_calculation_logs', 'player_id')
  )
  SELECT DISTINCT x.table_name, x.column_name
  FROM (SELECT * FROM fk UNION SELECT * FROM known) x
  JOIN information_schema.columns ic
    ON ic.table_schema = 'public' AND ic.table_name = x.table_name AND ic.column_name = x.column_name
   AND ic.data_type = 'uuid'
  WHERE x.table_name NOT IN ('players', 'player_aliases', 'player_claim_requests')
  ORDER BY 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.claim_guest_player(p_guest_id uuid, p_real_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_guest_player(p_guest_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.merge_guest_player(guest_id uuid, real_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- 1. Ensure caller is an admin or master_admin
    IF NOT EXISTS (
        SELECT 1 FROM players 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'master_admin')
    ) THEN
        RAISE EXCEPTION 'Only admins can merge profiles.';
    END IF;

    -- 2. Validate that the guest_id actually belongs to a guest profile
    IF NOT EXISTS (
        SELECT 1 FROM players 
        WHERE id = guest_id 
        AND is_guest = true
    ) THEN
        RAISE EXCEPTION 'Source profile is not a valid guest player.';
    END IF;

    -- 3. Validate that real_id exists
    IF NOT EXISTS (
        SELECT 1 FROM players WHERE id = real_id
    ) THEN
        RAISE EXCEPTION 'Target profile does not exist.';
    END IF;

    -- 4. Reassign Matches
    UPDATE matches SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE matches SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE matches SET player3_id = real_id WHERE player3_id = guest_id;
    UPDATE matches SET player4_id = real_id WHERE player4_id = guest_id;
    UPDATE matches SET umpired_by = real_id WHERE umpired_by = guest_id;
    UPDATE matches SET recorded_by = real_id WHERE recorded_by = guest_id;

    -- 5. Reassign Tournament Matches
    UPDATE tournament_matches SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tournament_matches SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE tournament_matches SET player3_id = real_id WHERE player3_id = guest_id;
    UPDATE tournament_matches SET player4_id = real_id WHERE player4_id = guest_id;
    UPDATE tournament_matches SET umpired_by = real_id WHERE umpired_by = guest_id;
    UPDATE tournament_matches SET recorded_by = real_id WHERE recorded_by = guest_id;

    -- 6. Reassign Tournament Participants
    UPDATE tournament_participants SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tournament_participants SET player2_id = real_id WHERE player2_id = guest_id;

    -- 7. Reassign Team Events (Tournaments Phase 2)
    UPDATE tournament_teams SET captain_id = real_id WHERE captain_id = guest_id;
    UPDATE tournament_team_members SET player_id = real_id WHERE player_id = guest_id;
    UPDATE tournament_team_members SET invited_by = real_id WHERE invited_by = guest_id;
    UPDATE tie_lineups SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tie_lineups SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE tie_lineups SET submitted_by = real_id WHERE submitted_by = guest_id;

    -- 8. Reassign ELO logs
    UPDATE elo_calculation_logs SET player_id = real_id WHERE player_id = guest_id;

    -- 9. Delete the Guest Profile
    -- This relies on ON DELETE CASCADE for any remaining tables we might have missed,
    -- or if we didn't miss anything, it just deletes the record.
    DELETE FROM players WHERE id = guest_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_elo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.trigger_update_win_loss_records()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE 
  rec RECORD;
BEGIN
  IF TG_TABLE_NAME = 'matches' THEN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed') OR
       (TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status != 'confirmed') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND NEW.winner_id IS DISTINCT FROM OLD.winner_id) OR
       (TG_OP = 'DELETE' AND OLD.status = 'confirmed') THEN
       
       rec := COALESCE(NEW, OLD);
       IF rec.player1_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player1_id); END IF;
       IF rec.player2_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player2_id); END IF;
       IF rec.team1_partner_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.team1_partner_id); END IF;
       IF rec.team2_partner_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.team2_partner_id); END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'tournament_matches' THEN
    IF (TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'walkover') AND OLD.status NOT IN ('completed', 'walkover')) OR
       (TG_OP = 'UPDATE' AND OLD.status IN ('completed', 'walkover') AND NEW.status NOT IN ('completed', 'walkover')) OR
       (TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'walkover') AND NEW.winner_id IS DISTINCT FROM OLD.winner_id) OR
       (TG_OP = 'DELETE' AND OLD.status IN ('completed', 'walkover')) THEN
       
       rec := COALESCE(NEW, OLD);
       IF rec.player1_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player1_id); END IF;
       IF rec.player2_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player2_id); END IF;
       IF rec.player3_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player3_id); END IF;
       IF rec.player4_id IS NOT NULL THEN PERFORM recalculate_player_all_records(rec.player4_id); END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

-- 5. Previous view definition
CREATE OR REPLACE VIEW "public"."player_matches_unified" AS
 SELECT "matches"."id",
    "matches"."category",
    "matches"."player1_id",
    "matches"."player2_id",
    "matches"."team1_partner_id" AS "player3_id",
    "matches"."team2_partner_id" AS "player4_id",
    "matches"."winner_id",
    NULL::smallint AS "winner_side",
    "matches"."status",
    "matches"."score",
    "matches"."created_at",
    "matches"."ended_at",
    NULL::timestamp with time zone AS "scheduled_at",
    "matches"."date",
    true AS "is_friendly",
    NULL::boolean AS "counts_for_elo"
   FROM "public"."matches"
  WHERE ("matches"."status" = ANY (ARRAY['confirmed'::"text", 'pending'::"text"]))
UNION ALL
 SELECT "tm"."id",
    "tm"."category",
    "tm"."player1_id",
    "tm"."player2_id",
    "tm"."player3_id",
    "tm"."player4_id",
    "tm"."winner_id",
    "tm"."winner_side",
    "tm"."status",
    "tm"."score",
    "tm"."created_at",
    "tm"."ended_at",
    "tm"."scheduled_at",
    NULL::"date" AS "date",
    false AS "is_friendly",
    "t"."counts_for_elo"
   FROM ("public"."tournament_matches" "tm"
     JOIN "public"."tournaments" "t" ON (("t"."id" = "tm"."tournament_id")))
  WHERE (("tm"."status" = ANY (ARRAY['completed'::"text", 'scheduled'::"text", 'in_progress'::"text", 'walkover'::"text"])) AND ("t"."status" <> 'deleted'::"text"));

-- 6. Foreign keys into matches
ALTER TABLE public.match_reminders DROP CONSTRAINT match_reminders_match_id_fkey;
ALTER TABLE ONLY "public"."club_courts"
    ADD CONSTRAINT "club_courts_current_match_id_fkey" FOREIGN KEY ("current_match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."match_reminders"
    ADD CONSTRAINT "match_reminders_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;

-- 7. Redundant policies
CREATE POLICY "Admins can delete find_lost_posts" ON "public"."find_lost_posts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));
CREATE POLICY "Admins can update find_lost_posts" ON "public"."find_lost_posts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "auth"."uid"()) AND ("players"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));
CREATE POLICY "Players can update their own looking_to_play status" ON "public"."players" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

-- 8. Dropped columns (data was never written)
ALTER TABLE public.tournament_ties ADD COLUMN "result_type" "text" DEFAULT 'NORMAL'::"text" NOT NULL;
ALTER TABLE public.tournament_ties ADD COLUMN "needs_admin_decision" boolean DEFAULT false NOT NULL;
ALTER TABLE public.delivered_targeted_alerts ADD COLUMN "error_message" "text";

-- 9. doubles_teams rows (2 placeholder pairs, 0 matches played)
INSERT INTO public.doubles_teams (category, created_at, elo_rating, id, matches_played, matches_won, player1_id, player2_id, team_name) VALUES ('MD', '2026-08-15 13:42:15.837847+00', 1200, '4f282dc5-2815-4af2-a118-1fc1e4877412', 0, 0, '561e463f-4dfe-4817-a3f7-199f4c9ec714', '0c824da8-cbc6-4e94-9e05-26062449d073', 'PHANTOMS');
INSERT INTO public.doubles_teams (category, created_at, elo_rating, id, matches_played, matches_won, player1_id, player2_id, team_name) VALUES ('XD', '2026-08-15 13:43:17.073132+00', 1200, '18c04749-e614-4caa-bf5d-4e3bc01c9329', 0, 0, '561e463f-4dfe-4817-a3f7-199f4c9ec714', '75aab4c2-646c-4ce5-b195-04e6f164ab9b', 'APEX');

-- 10. Realtime publication and cron jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
SELECT cron.schedule('remind-pending-matches', '30 3 * * *', $cron$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/remind-pending-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $cron$);
SELECT cron.schedule('weekly-digest', '30 14 * * 0', $cron$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $cron$);

COMMIT;
NOTIFY pgrst, 'reload schema';
