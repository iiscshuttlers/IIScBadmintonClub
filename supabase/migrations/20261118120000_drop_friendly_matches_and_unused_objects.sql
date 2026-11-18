-- Remove the friendly-match feature and database objects nothing uses.
--
-- The app is tournament-only. The friendly `matches` table had 0 rows and
-- `doubles_teams` held 2 placeholder rows (0 matches played). The functions
-- dropped in section 6 are not called by the current client, the deployed
-- client (v4.32) or v4.27 (18 Oct 2026), by any edge function, cron job,
-- policy, trigger or other live SQL function.
--
-- Rollback: supabase/rollbacks/20261118120000_drop_friendly_matches_and_unused_objects.rollback.sql
-- (function bodies, policies, FKs, view and doubles_teams rows). A full
-- pre-change schema dump is kept locally in backups/2026-11-18-db-cleanup/.

-- 1. Cron jobs that fail on every run and only served friendly matches.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('remind-pending-matches', 'weekly-digest');

-- 2. The unified match view becomes tournament-only. Columns and types are
--    unchanged so existing selects keep working; is_friendly is always false.
CREATE OR REPLACE VIEW public.player_matches_unified AS
 SELECT tm.id,
    tm.category,
    tm.player1_id,
    tm.player2_id,
    tm.player3_id,
    tm.player4_id,
    tm.winner_id,
    tm.winner_side,
    tm.status,
    tm.score,
    tm.created_at,
    tm.ended_at,
    tm.scheduled_at,
    NULL::date AS date,
    false AS is_friendly,
    t.counts_for_elo
   FROM tournament_matches tm
     JOIN tournaments t ON t.id = tm.tournament_id
  WHERE tm.status = ANY (ARRAY['completed'::text, 'scheduled'::text, 'in_progress'::text, 'walkover'::text])
    AND t.status <> 'deleted'::text;

-- 3. Live functions that still referenced `matches`. Same signatures and
--    security settings; the friendly-match statements are removed.
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

-- merge_guest_player also updated columns that don't exist
-- (matches.player3_id, tournament_matches.recorded_by,
-- tournament_participants.player1_id/player2_id), so it failed on every
-- call. It now updates the real participant columns.
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

    -- 4. Reassign Tournament Matches
    UPDATE tournament_matches SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tournament_matches SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE tournament_matches SET player3_id = real_id WHERE player3_id = guest_id;
    UPDATE tournament_matches SET player4_id = real_id WHERE player4_id = guest_id;
    UPDATE tournament_matches SET umpired_by = real_id WHERE umpired_by = guest_id;

    -- 5. Reassign Tournament Participants
    UPDATE tournament_participants SET player_id = real_id WHERE player_id = guest_id;
    UPDATE tournament_participants SET partner_id = real_id WHERE partner_id = guest_id;

    -- 6. Reassign Team Events
    UPDATE tournament_teams SET captain_id = real_id WHERE captain_id = guest_id;
    UPDATE tournament_team_members SET player_id = real_id WHERE player_id = guest_id;
    UPDATE tournament_team_members SET invited_by = real_id WHERE invited_by = guest_id;
    UPDATE tie_lineups SET player1_id = real_id WHERE player1_id = guest_id;
    UPDATE tie_lineups SET player2_id = real_id WHERE player2_id = guest_id;
    UPDATE tie_lineups SET submitted_by = real_id WHERE submitted_by = guest_id;

    -- 7. Reassign ELO logs
    UPDATE elo_calculation_logs SET player_id = real_id WHERE player_id = guest_id;

    -- 8. Delete the Guest Profile
    DELETE FROM players WHERE id = guest_id;
END;
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

  -- Delete the guest shadow profile
  DELETE FROM players WHERE id = p_guest_id AND is_guest = true;
END;
$function$;

-- The "matches on record" guard only ever looked at the empty friendly
-- table; it now checks tournament matches, which is what it was protecting.
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
  FROM public.tournament_matches
  WHERE player1_id = p_guest_id OR player2_id = p_guest_id
     OR player3_id = p_guest_id OR player4_id = p_guest_id;

  IF v_matches > 0 THEN
    RAISE EXCEPTION 'Guest has % match(es) on record — claim the profile instead of deleting.', v_matches;
  END IF;

  DELETE FROM public.players WHERE id = p_guest_id AND is_guest = true;
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
  IF TG_TABLE_NAME = 'tournament_matches' THEN
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

-- 4. Foreign keys into `matches`. match_reminders stores tournament match ids
--    (send-match-reminders upserts tournament_matches.id), so its FK to the
--    friendly table rejected every dedup row; point it at tournament_matches.
ALTER TABLE public.match_reminders DROP CONSTRAINT match_reminders_match_id_fkey;
ALTER TABLE public.match_reminders
  ADD CONSTRAINT match_reminders_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE;
ALTER TABLE public.club_courts DROP CONSTRAINT club_courts_current_match_id_fkey;

-- 5. Friendly-match tables. Their triggers, policies and realtime
--    publication membership are dropped with them.
DROP TABLE public.matches;
DROP TABLE public.doubles_teams;

-- 6. Functions nothing calls, plus the friendly-match RPCs and trigger functions.
DROP FUNCTION public._player_private_columns();
DROP FUNCTION public.accept_buddy_request(p_target_id uuid);
DROP FUNCTION public.accept_friendly_match(match_uuid uuid, confirmer_id uuid);
DROP FUNCTION public.admin_assign_umpires(p_user_ids uuid[], p_tournament_match_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone);
DROP FUNCTION public.admin_delete_umpire_assignment(p_id uuid);
DROP FUNCTION public.admin_move_player_in_bracket(p_match_id uuid, p_slot smallint, p_player_id uuid, p_partner_id uuid, p_label text);
DROP FUNCTION public.approve_player(player_id text, admin_email text);
DROP FUNCTION public.approve_player(player_id uuid, admin_id uuid);
DROP FUNCTION public.auto_claim_duplicate_profile();
DROP FUNCTION public.cancel_buddy_request(p_target_id uuid);
DROP FUNCTION public.check_tournament_court_overlap();
DROP FUNCTION public.cleanup_stale_push_tokens();
DROP FUNCTION public.complete_match(p_match_id uuid, p_winner_id uuid, p_umpire_id uuid, p_game1_s1 integer, p_game1_s2 integer, p_game2_s1 integer, p_game2_s2 integer, p_game3_s1 integer, p_game3_s2 integer);
DROP FUNCTION public.confirm_friendly_match(match_uuid uuid, confirmer_id text);
DROP FUNCTION public.debug_recalc();
DROP FUNCTION public.get_court_popularity();
DROP FUNCTION public.get_expected_score(p_team_elo numeric, p_opponent_elo numeric);
DROP FUNCTION public.increment_match_score(match_id uuid, p1_increment integer, p2_increment integer);
DROP FUNCTION public.is_active_team_member(t_team_id uuid);
DROP FUNCTION public.is_authorized_for_analytics(p_auth_uid uuid, p_match_id uuid, p_match_source text, p_target_player uuid);
DROP FUNCTION public.notify_players_on_match_confirm();
DROP FUNCTION public.notify_players_on_match_insert();
DROP FUNCTION public.recalculate_all_win_loss_records();
DROP FUNCTION public.recalculate_player_win_loss_records(p_player_id uuid);
DROP FUNCTION public.reject_friendly_match(match_uuid uuid, rejecter_id text);
DROP FUNCTION public.reject_friendly_match(match_uuid uuid, rejecter_id uuid);
DROP FUNCTION public.remove_buddy(p_target_id uuid);
DROP FUNCTION public.rollback_elo_on_match_delete();
DROP FUNCTION public.save_tie_lineup(p_tie_id uuid, p_side text, p_assignments jsonb);
DROP FUNCTION public.send_buddy_request(p_target_id uuid);
DROP FUNCTION public.soft_delete_player(player_id text, admin_email text);
DROP FUNCTION public.soft_delete_player(target_player_id uuid);
DROP FUNCTION public.submit_friendly_match(submitter_id text, opponent_id text, match_winner_id text, match_score text, submitter_partner_id text, opponent_partner_id text);
DROP FUNCTION public.submit_friendly_match(submitter_id text, opponent_id text, match_winner_id text, match_score text, submitter_partner_id text, opponent_partner_id text, is_cross_gender_singles boolean, is_hybrid boolean, is_mixed_category_doubles boolean);
DROP FUNCTION public.toggle_buddy(p_target_id uuid);
DROP FUNCTION public.toggle_follow(p_target_id uuid);
DROP FUNCTION public.toggle_match_kudos(p_match_id uuid);
DROP FUNCTION public.toggle_team_invite_token(p_team_id uuid, p_enabled boolean);
DROP FUNCTION public.transfer_umpire_duty(p_match_id uuid, p_new_umpire_id uuid);
DROP FUNCTION public.trigger_buddy_request_notification();
DROP FUNCTION public.trigger_challenge_notification();
DROP FUNCTION public.trigger_update_category_records();
DROP FUNCTION public.umpire_submit_match(umpire_id text, player1_id text, player2_id text, team1_partner_id text, team2_partner_id text, winner_id text, match_score text, match_category text, match_round text, is_friendly boolean, sets_history text[], started_at timestamp with time zone, ended_at timestamp with time zone);
DROP FUNCTION public.umpire_update_match(match_uuid uuid, winner_id text, match_score text, match_category text, sets_history text[]);
DROP FUNCTION public.umpire_update_match(match_uuid uuid, winner_id uuid, match_score text, match_category text, sets_history text[]);
DROP FUNCTION public.update_doubles_teams_elo();
DROP FUNCTION public.update_modified_column();
DROP FUNCTION public.validate_tie_format(config jsonb);

-- 7. Redundant RLS policies. The find_lost_posts pair checks a 'superadmin'
--    role that doesn't exist (the admin/master_admin policies already cover
--    admins); the players policy duplicates "Users can update their own profile".
DROP POLICY "Admins can delete find_lost_posts" ON public.find_lost_posts;
DROP POLICY "Admins can update find_lost_posts" ON public.find_lost_posts;
DROP POLICY "Players can update their own looking_to_play status" ON public.players;

-- 8. Columns that no code, function, view or policy reads or writes.
ALTER TABLE public.tournament_ties DROP COLUMN result_type;
ALTER TABLE public.tournament_ties DROP COLUMN needs_admin_decision;
ALTER TABLE public.delivered_targeted_alerts DROP COLUMN error_message;

NOTIFY pgrst, 'reload schema';
