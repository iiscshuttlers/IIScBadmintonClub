-- Tournament player check-in ("I'm here").
--
-- Players tap "I'm here" when they reach the venue. Opponents see it on their
-- match card, umpires get a "Ready to play" list, organisers a "Who's here"
-- roster, and spectators only a "Both sides here" chip. Manual tap only: no
-- location is read or stored anywhere.
--
-- 1. public.tournament_checkins, one row per (tournament, player):
--    state here|break, checked_in_at, break_until (NULL on a break = "until
--    I'm back"), checked_in_by, expires_at. A BEFORE trigger owns the derived
--    columns, so a client can't extend its own check-in: expires_at is 4 h
--    after check-in / last renewal or after the player's last match ended,
--    whichever is later, and never past midnight (Asia/Kolkata).
-- 2. RLS. Players change only their own row (is_my_player_id, since one
--    account's player id can differ from its auth uid) and only for a
--    tournament they're entered in that is under way. Officials (ORGANIZER,
--    UMPIRE, REFEREE in tournament_officials), the tournament's manager and
--    admins/umpires change any row of it. Signed-in users read rows of
--    visible tournaments; drafts are readable only by their officials and
--    trashed tournaments by nobody (same initplan pattern as tm_* policies).
--    anon has no table access at all.
-- 3. tournament_checkin(...): the one write path the app uses (SECURITY
--    INVOKER, so the policies above apply).
-- 4. tournament_match_presence(tournament): match_id + ready flag ("both
--    sides here") for spectators, including signed-out ones. No names, times
--    or reasons leave the database through it.
-- 5. Alerts through dispatch_authoritative_match_alert, which gains optional
--    p_recipients / p_link (it stays service-role only):
--      opponent_checked_in  next opponents + partner, once per (match, player)
--      match_ready          assigned umpire, else the REFEREEs, once per
--                           transition to ready
--      break_over           the player, once per break
--      checkin_expiring     the player, 10 min before expiry, once per expiry
-- 6. process_tournament_checkins(): run every minute by notify-up-next. Ends
--    timed breaks, warns before expiry, deletes expired rows, and detects
--    matches turning ready.
-- 7. court_calls.player_ids records who a call went to (NULL = everyone, for
--    older rows); call-to-court uses it for a per-player cooldown.
-- 8. tournament_checkins and court_calls join the supabase_realtime
--    publication.
--
-- The readiness rule here mirrors client/src/lib/matchReadiness.ts:
-- both sides known, every player checked in (not expired) and not on a
-- break, nobody live on another match, and min_rest_minutes since each
-- player's last finished match.
--
-- Rollback: supabase/rollbacks/20261120160000_tournament_checkins.rollback.sql

-- ---------- 1. table ----------
CREATE TABLE public.tournament_checkins (
  tournament_id     uuid        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id         uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  state             text        NOT NULL DEFAULT 'here' CHECK (state IN ('here', 'break')),
  checked_in_at     timestamptz NOT NULL DEFAULT now(),
  break_until       timestamptz,
  checked_in_by     uuid,
  expires_at        timestamptz NOT NULL DEFAULT now(),
  -- Derived bookkeeping (set by the trigger, not by clients).
  here_since        timestamptz NOT NULL DEFAULT now(),
  break_started_at  timestamptz,
  renewed_at        timestamptz NOT NULL DEFAULT now(),
  expiry_warned_for timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, player_id),
  CHECK (state = 'break' OR (break_until IS NULL AND break_started_at IS NULL))
);

CREATE INDEX tournament_checkins_expires_idx ON public.tournament_checkins (expires_at);
CREATE INDEX tournament_checkins_player_idx ON public.tournament_checkins (player_id);

COMMENT ON TABLE public.tournament_checkins IS
  'Manual "I''m here" check-ins per tournament player. No location data. See migration 20261120160000.';

-- Is this player entered in the tournament (entry, draw slot or team roster)?
CREATE OR REPLACE FUNCTION public.is_entered_in_tournament(p_tournament_id uuid, p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_player_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.tournament_participants tp
             WHERE tp.tournament_id = p_tournament_id
               AND (tp.player_id = p_player_id OR tp.partner_id = p_player_id))
    OR EXISTS (SELECT 1 FROM public.tournament_matches tm
                WHERE tm.tournament_id = p_tournament_id
                  AND p_player_id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id))
    OR EXISTS (SELECT 1 FROM public.tournament_team_members m
                WHERE m.tournament_id = p_tournament_id
                  AND m.player_id = p_player_id
                  AND m.status = 'ACTIVE')
  );
$function$;

-- Can the caller check players in/out for this tournament?
CREATE OR REPLACE FUNCTION public.can_manage_tournament_checkins(p_tournament_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    public.is_admin_or_umpire()
    OR public.is_tournament_manager(p_tournament_id)
    OR EXISTS (SELECT 1 FROM public.tournament_officials o
                WHERE o.tournament_id = p_tournament_id
                  AND o.user_id = auth.uid()
                  AND o.role IN ('ORGANIZER', 'UMPIRE', 'REFEREE')),
    false);
$function$;

-- Is check-in open for this tournament (play not finished, not draft/trash)?
CREATE OR REPLACE FUNCTION public.tournament_checkin_open(p_tournament_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.tournaments t
                  WHERE t.id = p_tournament_id
                    AND t.status <> ALL (ARRAY['draft', 'deleted', 'completed', 'archived']));
$function$;

-- When does a check-in expire? 4 h after the later of its last renewal and the
-- player's last finished match in this tournament, capped at midnight IST of
-- the day it was renewed.
CREATE OR REPLACE FUNCTION public.tournament_checkin_expiry(p_tournament_id uuid, p_player_id uuid, p_renewed_at timestamptz)
 RETURNS timestamptz
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH last_end AS (
    SELECT max(tm.ended_at) AS ended_at
      FROM public.tournament_matches tm
     WHERE tm.tournament_id = p_tournament_id
       AND tm.status IN ('completed', 'walkover')
       AND p_player_id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
  ), base AS (
    SELECT GREATEST(p_renewed_at, COALESCE((SELECT ended_at FROM last_end), p_renewed_at)) AS at
  )
  SELECT LEAST(
    (SELECT at FROM base) + interval '4 hours',
    ((date_trunc('day', p_renewed_at AT TIME ZONE 'Asia/Kolkata') + interval '1 day')
       AT TIME ZONE 'Asia/Kolkata')
  );
$function$;

-- Derived columns: clients may send state and break_until only.
CREATE OR REPLACE FUNCTION public.tournament_checkins_normalize()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_fresh boolean;
BEGIN
  v_fresh := TG_OP = 'INSERT' OR OLD.expires_at <= now();

  IF v_fresh THEN
    -- New check-in (or a re-check-in after the old one ran out).
    NEW.checked_in_at := now();
    NEW.checked_in_by := COALESCE(auth.uid(), NEW.checked_in_by);
    NEW.renewed_at := now();
    NEW.here_since := now();
    NEW.expiry_warned_for := NULL;
    NEW.break_started_at := NULL;
    IF TG_OP = 'UPDATE' AND NEW.state = 'break' THEN
      NEW.state := 'here';
    END IF;
  ELSE
    NEW.checked_in_at := OLD.checked_in_at;
    NEW.checked_in_by := OLD.checked_in_by;
    NEW.renewed_at := GREATEST(OLD.renewed_at, LEAST(NEW.renewed_at, now()));
    NEW.here_since := OLD.here_since;
    NEW.expiry_warned_for := NEW.expiry_warned_for;
  END IF;

  IF NEW.state = 'here' THEN
    IF TG_OP = 'UPDATE' AND NOT v_fresh AND OLD.state = 'break' THEN
      NEW.here_since := now();
    END IF;
    NEW.break_until := NULL;
    NEW.break_started_at := NULL;
  ELSE
    IF TG_OP = 'UPDATE' AND NOT v_fresh AND OLD.state = 'break' THEN
      NEW.break_started_at := OLD.break_started_at;
    ELSE
      NEW.break_started_at := now();
    END IF;
    IF NEW.break_until IS NOT NULL AND NEW.break_until > now() + interval '4 hours' THEN
      NEW.break_until := now() + interval '4 hours';
    END IF;
  END IF;

  NEW.expires_at := public.tournament_checkin_expiry(NEW.tournament_id, NEW.player_id, NEW.renewed_at);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER tournament_checkins_normalize
  BEFORE INSERT OR UPDATE ON public.tournament_checkins
  FOR EACH ROW EXECUTE FUNCTION public.tournament_checkins_normalize();

-- ---------- 2. RLS ----------
ALTER TABLE public.tournament_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_checkins FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_checkins TO authenticated;
GRANT ALL ON public.tournament_checkins TO service_role;

CREATE POLICY tc_read ON public.tournament_checkins
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tournaments t
             WHERE t.id = tournament_checkins.tournament_id
               AND t.status <> ALL (ARRAY['draft'::text, 'deleted'::text]))
    OR tournament_id = ANY (COALESCE((SELECT public.my_official_tournament_ids()), ARRAY[]::uuid[]))
    OR (SELECT public.is_admin_or_umpire())
  );

-- Trashed tournaments are hidden from every signed-in reader, as tm_hide_trashed.
CREATE POLICY tc_hide_trashed ON public.tournament_checkins
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tournament_id <> ALL (COALESCE((SELECT public.trashed_tournament_ids()), ARRAY[]::uuid[])));

CREATE POLICY tc_self_insert ON public.tournament_checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_my_player_id(player_id)
    AND public.tournament_checkin_open(tournament_id)
    AND public.is_entered_in_tournament(tournament_id, player_id)
  );

CREATE POLICY tc_self_update ON public.tournament_checkins
  FOR UPDATE TO authenticated
  USING (public.is_my_player_id(player_id) AND public.tournament_checkin_open(tournament_id))
  WITH CHECK (
    public.is_my_player_id(player_id)
    AND public.tournament_checkin_open(tournament_id)
    AND public.is_entered_in_tournament(tournament_id, player_id)
  );

CREATE POLICY tc_self_delete ON public.tournament_checkins
  FOR DELETE TO authenticated
  USING (public.is_my_player_id(player_id));

CREATE POLICY tc_official_write ON public.tournament_checkins
  FOR ALL TO authenticated
  USING (public.can_manage_tournament_checkins(tournament_id))
  WITH CHECK (
    public.can_manage_tournament_checkins(tournament_id)
    AND public.tournament_checkin_open(tournament_id)
    AND public.is_entered_in_tournament(tournament_id, player_id)
  );

-- ---------- 3. alerts: dispatcher gains recipients and link ----------
-- The old five-argument signature is replaced (two overloads would make a
-- five-argument call ambiguous). Existing callers keep working through the
-- defaults; DROP + CREATE resets grants, so they are re-applied below.
DROP FUNCTION IF EXISTS public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint);

CREATE FUNCTION public.dispatch_authoritative_match_alert(
  p_match_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_version bigint DEFAULT 0,
  p_recipients uuid[] DEFAULT NULL,
  p_link text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_match_players UUID[] := ARRAY[]::UUID[];
  v_candidate_recipients UUID[] := ARRAY[]::UUID[];
  v_uid UUID;
  v_player_rec public.players%ROWTYPE;
  v_delivered_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_deep_link TEXT;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Canonical deep link to the affected match, unless the caller gives one.
  v_deep_link := COALESCE(NULLIF(p_link, ''), format('/tournaments/%s/matches/%s', v_match.tournament_id, p_match_id));

  IF p_recipients IS NOT NULL THEN
    -- Targeted alert (check-in events, single-player calls): exactly these
    -- people, no followers or subscribers.
    SELECT COALESCE(array_agg(DISTINCT r), ARRAY[]::uuid[]) INTO v_candidate_recipients
      FROM unnest(p_recipients) r WHERE r IS NOT NULL;
  ELSE
    -- 1. Collect match participants
    IF v_match.player1_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player1_id); END IF;
    IF v_match.player2_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player2_id); END IF;
    IF v_match.player3_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player3_id); END IF;
    IF v_match.player4_id IS NOT NULL THEN v_match_players := array_append(v_match_players, v_match.player4_id); END IF;

    -- Match competitors always candidates
    v_candidate_recipients := v_match_players;

    -- 2. Users with explicit player subscriptions to competitors
    IF cardinality(v_match_players) > 0 THEN
      SELECT array_agg(DISTINCT user_id) INTO v_candidate_recipients
      FROM (
        SELECT unnest(v_candidate_recipients) AS user_id
        UNION
        SELECT ups.user_id
        FROM public.user_player_subscriptions ups
        WHERE ups.player_id = ANY(v_match_players)
          AND ups.is_muted IS FALSE
          AND (
            (p_event_type = 'match_call' AND ups.notify_match_call) OR
            (p_event_type = 'schedule_change' AND ups.notify_schedule_change) OR
            (p_event_type = 'result' AND ups.notify_result) OR
            (p_event_type NOT IN ('match_call', 'schedule_change', 'result'))
          )
        UNION
        -- Users with competitor in their following array
        SELECT p.id AS user_id
        FROM public.players p
        WHERE p.following IS NOT NULL
          AND p.following && v_match_players::text[]
      ) sub;
    END IF;

    -- 3. Users subscribed to the tournament
    IF v_match.tournament_id IS NOT NULL THEN
      SELECT array_agg(DISTINCT user_id) INTO v_candidate_recipients
      FROM (
        SELECT unnest(v_candidate_recipients) AS user_id
        UNION
        SELECT uts.user_id
        FROM public.user_tournament_subscriptions uts
        WHERE uts.tournament_id = v_match.tournament_id
          AND uts.is_muted IS FALSE
          AND (
            (p_event_type = 'match_call' AND uts.notify_match_call) OR
            (p_event_type = 'schedule_change' AND uts.notify_schedule_change) OR
            (p_event_type = 'result' AND uts.notify_result) OR
            (p_event_type NOT IN ('match_call', 'schedule_change', 'result'))
          )
      ) sub_tour;
    END IF;
  END IF;

  IF v_candidate_recipients IS NULL OR cardinality(v_candidate_recipients) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'delivered_count', 0,
      'skipped_count', 0,
      'match_id', p_match_id
    );
  END IF;

  -- 4. Deduplicate and filter candidates (quiet hours, previous delivery)
  FOREACH v_uid IN ARRAY v_candidate_recipients
  LOOP
    SELECT * INTO v_player_rec FROM public.players WHERE id = v_uid;

    -- Alerts need both a player row (notifications.user_id) and a login
    -- (delivered_targeted_alerts.user_id). Guests without a login, or a login
    -- without a player profile, can't receive them; skip instead of failing.
    IF v_player_rec.id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Respect quiet hours if enabled
    IF v_player_rec.quiet_hours_enabled IS TRUE THEN
      IF public.is_in_quiet_hours(v_player_rec.quiet_hours_start, v_player_rec.quiet_hours_end) THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Deduplication check: Has this user already received this exact event and version?
    IF EXISTS (
      SELECT 1 FROM public.delivered_targeted_alerts
      WHERE user_id = v_uid
        AND match_id = p_match_id
        AND event_type = p_event_type
        AND event_version = p_version
        AND channel = 'in_app'
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, link, is_read, created_at)
    VALUES (v_uid, p_title, p_body, 'tournament_alert', v_deep_link, false, now());

    INSERT INTO public.delivered_targeted_alerts (user_id, match_id, event_type, event_version, channel, status, created_at)
    VALUES (v_uid, p_match_id, p_event_type, p_version, 'in_app', 'sent', now());

    -- Queue the push. stamp_authoritative_notification_queue() ties this row
    -- to the in-app delivery above (match, event, version) and sets its expiry.
    -- Best-effort: the in-app alert is already recorded.
    BEGIN
      INSERT INTO public.scheduled_notifications (
        recipient_ids, channels, audience, tournament_id, title, body, link, status, scheduled_at
      ) VALUES (
        ARRAY[v_uid], ARRAY['push'], 'custom', v_match.tournament_id, p_title, p_body, v_deep_link, 'pending', now()
      );
    EXCEPTION
      WHEN unique_violation THEN
        NULL; -- this event is already queued for this recipient
      WHEN OTHERS THEN
        RAISE WARNING 'dispatch_authoritative_match_alert: push not queued for % (match %): % %',
          v_uid, p_match_id, SQLSTATE, SQLERRM;
    END;

    v_delivered_count := v_delivered_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'delivered_count', v_delivered_count,
    'skipped_count', v_skipped_count,
    'match_id', p_match_id,
    'event_type', p_event_type,
    'version', p_version,
    'link', v_deep_link
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint, uuid[], text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_authoritative_match_alert(uuid, text, text, text, bigint, uuid[], text)
  TO service_role;

-- A stable bigint per player id: the event version that makes
-- "X is here for <match>" go out once per (recipient, match, player).
CREATE OR REPLACE FUNCTION public.checkin_alert_version(p_player_id uuid)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ('x' || substr(md5(p_player_id::text), 1, 15))::bit(60)::bigint;
$function$;

-- ---------- 4. readiness (mirrors client/src/lib/matchReadiness.ts) ----------
-- One row per open match of a tournament with both sides known:
--   all_here  every player checked in (unexpired), not on a break, and not
--             live on another match. What spectators see as "Both sides here".
--   ready     all_here and every player has rested min_rest_minutes since
--             their last finished match. What umpires see as "Ready to play".
CREATE OR REPLACE FUNCTION public.tournament_checkin_readiness(p_tournament_id uuid)
 RETURNS TABLE (match_id uuid, all_here boolean, ready boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH t AS (
    SELECT id, COALESCE(min_rest_minutes, 15) AS min_rest FROM public.tournaments WHERE id = p_tournament_id
  ), open_matches AS (
    SELECT tm.*
      FROM public.tournament_matches tm
     WHERE tm.tournament_id = p_tournament_id
       AND tm.status IN ('scheduled', 'pending')
       AND tm.player1_id IS NOT NULL AND tm.player2_id IS NOT NULL
       AND COALESCE(tm.team1_label, '') !~* '\mbye\M'
       AND COALESCE(tm.team2_label, '') !~* '\mbye\M'
  ), slots AS (
    SELECT om.id AS match_id, p.player_id
      FROM open_matches om
     CROSS JOIN LATERAL unnest(ARRAY[om.player1_id, om.player2_id, om.player3_id, om.player4_id]) AS p(player_id)
     WHERE p.player_id IS NOT NULL
  ), per_player AS (
    SELECT s.match_id, s.player_id,
      EXISTS (
        SELECT 1 FROM public.tournament_checkins c
         WHERE c.tournament_id = p_tournament_id AND c.player_id = s.player_id
           AND c.expires_at > now()
           AND (c.state = 'here' OR (c.break_until IS NOT NULL AND c.break_until <= now()))
      ) AS present,
      EXISTS (
        SELECT 1 FROM public.tournament_matches lm
         WHERE lm.tournament_id = p_tournament_id
           AND lm.id <> s.match_id
           AND lm.status IN ('in_progress', 'playing', 'live', 'ongoing')
           AND s.player_id IN (lm.player1_id, lm.player2_id, lm.player3_id, lm.player4_id)
      ) AS busy,
      COALESCE((
        SELECT max(fm.ended_at) FROM public.tournament_matches fm
         WHERE fm.tournament_id = p_tournament_id
           AND fm.status = 'completed'
           AND s.player_id IN (fm.player1_id, fm.player2_id, fm.player3_id, fm.player4_id)
      ) + make_interval(mins => (SELECT min_rest FROM t)) <= now(), true) AS rested
      FROM slots s
  )
  SELECT pp.match_id,
         bool_and(pp.present AND NOT pp.busy) AS all_here,
         bool_and(pp.present AND NOT pp.busy AND pp.rested) AS ready
    FROM per_player pp
   GROUP BY pp.match_id;
$function$;

REVOKE ALL ON FUNCTION public.tournament_checkin_readiness(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_checkin_readiness(uuid) TO service_role;

-- Spectator chip. Visible tournaments only; returns nothing but match ids and
-- a flag, so it is safe for signed-out viewers.
CREATE OR REPLACE FUNCTION public.tournament_match_presence(p_tournament_id uuid)
 RETURNS TABLE (match_id uuid, ready boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT r.match_id, r.all_here
    FROM public.tournament_checkin_readiness(p_tournament_id) r
   WHERE EXISTS (SELECT 1 FROM public.tournaments t
                  WHERE t.id = p_tournament_id
                    AND t.status <> ALL (ARRAY['draft', 'deleted']));
$function$;

REVOKE ALL ON FUNCTION public.tournament_match_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tournament_match_presence(uuid) TO anon, authenticated, service_role;

-- ---------- 5. "X is here for <match>" ----------
-- The player's next open match in this tournament, in court-queue order.
CREATE OR REPLACE FUNCTION public.tournament_player_next_match(p_tournament_id uuid, p_player_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT tm.id
    FROM public.tournament_matches tm
   WHERE tm.tournament_id = p_tournament_id
     AND tm.status IN ('scheduled', 'pending')
     AND p_player_id IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
   ORDER BY tm.scheduled_at ASC NULLS LAST, tm.round ASC NULLS FIRST, tm.match_number ASC NULLS FIRST
   LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.tournament_checkins_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_match_id uuid;
  v_name text;
  v_code text;
  v_side int;
  v_other uuid;
  v_other_side int;
  v_other_here boolean;
  v_title text;
  v_body text;
BEGIN
  -- Only a new check-in (or a re-check-in after expiry) tells anyone.
  IF TG_OP = 'UPDATE' AND OLD.checked_in_at = NEW.checked_in_at THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_match_id := public.tournament_player_next_match(NEW.tournament_id, NEW.player_id);
    IF v_match_id IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO v_match FROM public.tournament_matches WHERE id = v_match_id;
    SELECT COALESCE(NULLIF(btrim(full_name), ''), 'A player') INTO v_name FROM public.players WHERE id = NEW.player_id;
    v_name := COALESCE(v_name, 'A player');
    v_code := COALESCE(NULLIF(btrim(v_match.match_code), ''), 'your next match');
    v_side := CASE WHEN NEW.player_id IN (v_match.player1_id, v_match.player3_id) THEN 1 ELSE 2 END;

    FOREACH v_other IN ARRAY ARRAY[v_match.player1_id, v_match.player2_id, v_match.player3_id, v_match.player4_id]
    LOOP
      CONTINUE WHEN v_other IS NULL OR v_other = NEW.player_id;
      v_other_side := CASE WHEN v_other IN (v_match.player1_id, v_match.player3_id) THEN 1 ELSE 2 END;
      v_other_here := EXISTS (SELECT 1 FROM public.tournament_checkins c
                               WHERE c.tournament_id = NEW.tournament_id AND c.player_id = v_other
                                 AND c.expires_at > now());
      v_title := format('%s is here for %s', v_name, v_code);
      v_body := CASE WHEN v_other_side = v_side THEN 'Your partner has checked in.' ELSE 'Your opponent has checked in.' END
             || CASE WHEN v_other_here THEN '' ELSE ' Tap "I''m here" when you arrive.' END;
      PERFORM public.dispatch_authoritative_match_alert(
        v_match_id, 'opponent_checked_in', v_title, v_body,
        public.checkin_alert_version(NEW.player_id), ARRAY[v_other], NULL);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- An alert problem must never undo a check-in.
    RAISE WARNING 'check-in alert for player % failed: % %', NEW.player_id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER tournament_checkins_notify
  AFTER INSERT OR UPDATE ON public.tournament_checkins
  FOR EACH ROW EXECUTE FUNCTION public.tournament_checkins_notify();

-- A finished match renews its players' check-ins (4 h from the match end).
CREATE OR REPLACE FUNCTION public.tournament_matches_renew_checkins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status IN ('completed', 'walkover')
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.ended_at IS DISTINCT FROM NEW.ended_at) THEN
    BEGIN
      UPDATE public.tournament_checkins c
         SET updated_at = now()
       WHERE c.tournament_id = NEW.tournament_id
         AND c.expires_at > now()
         AND c.player_id IN (NEW.player1_id, NEW.player2_id, NEW.player3_id, NEW.player4_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'renewing check-ins after match % failed: % %', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER tournament_matches_renew_checkins
  AFTER UPDATE OF status, ended_at ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public.tournament_matches_renew_checkins();

-- ---------- 6. the one write path the app uses ----------
CREATE OR REPLACE FUNCTION public.tournament_checkin(
  p_tournament_id uuid,
  p_player_id uuid,
  p_action text,
  p_break_minutes integer DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.tournament_checkins%ROWTYPE;
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to check in' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'check_in' THEN
    INSERT INTO public.tournament_checkins AS c (tournament_id, player_id, state)
    VALUES (p_tournament_id, p_player_id, 'here')
    ON CONFLICT (tournament_id, player_id)
      DO UPDATE SET state = 'here', break_until = NULL, renewed_at = now()
    RETURNING * INTO v_row;
  ELSIF p_action = 'renew' THEN
    UPDATE public.tournament_checkins
       SET renewed_at = now()
     WHERE tournament_id = p_tournament_id AND player_id = p_player_id
    RETURNING * INTO v_row;
  ELSIF p_action = 'break' THEN
    IF p_break_minutes IS NOT NULL AND (p_break_minutes < 1 OR p_break_minutes > 240) THEN
      RAISE EXCEPTION 'A break can be 1 to 240 minutes' USING ERRCODE = '22023';
    END IF;
    UPDATE public.tournament_checkins
       SET state = 'break',
           break_until = CASE WHEN p_break_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => p_break_minutes) END
     WHERE tournament_id = p_tournament_id AND player_id = p_player_id AND expires_at > now()
    RETURNING * INTO v_row;
  ELSIF p_action = 'back' THEN
    UPDATE public.tournament_checkins
       SET state = 'here', break_until = NULL
     WHERE tournament_id = p_tournament_id AND player_id = p_player_id
    RETURNING * INTO v_row;
  ELSIF p_action = 'check_out' THEN
    DELETE FROM public.tournament_checkins
     WHERE tournament_id = p_tournament_id AND player_id = p_player_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN jsonb_build_object('checked_in', false, 'removed', v_n);
  ELSE
    RAISE EXCEPTION 'Unknown check-in action %', p_action USING ERRCODE = '22023';
  END IF;

  IF v_row.player_id IS NULL THEN
    RAISE EXCEPTION 'Check in first' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('checked_in', true, 'row', to_jsonb(v_row));
END;
$function$;

REVOKE ALL ON FUNCTION public.tournament_checkin(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tournament_checkin(uuid, uuid, text, integer) TO authenticated, service_role;

-- Helper functions used by policies: authenticated needs them (policies run
-- as the caller); anon never reaches a write policy.
REVOKE ALL ON FUNCTION public.is_entered_in_tournament(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_tournament_checkins(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tournament_checkin_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_entered_in_tournament(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_tournament_checkins(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tournament_checkin_open(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tournament_checkin_expiry(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_player_next_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkin_alert_version(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_checkin_expiry(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_player_next_match(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkin_alert_version(uuid) TO service_role;
-- Trigger functions are not callable through the API.
REVOKE ALL ON FUNCTION public.tournament_checkins_normalize() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_checkins_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_matches_renew_checkins() FROM PUBLIC, anon, authenticated;

-- ---------- 7. every-minute processing ----------
-- Readiness transitions, so "match ready" goes out once per transition.
CREATE TABLE public.tournament_match_ready_state (
  match_id    uuid PRIMARY KEY REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  ready       boolean NOT NULL DEFAULT false,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  transitions integer NOT NULL DEFAULT 0
);
ALTER TABLE public.tournament_match_ready_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_match_ready_state FROM anon, authenticated;
GRANT ALL ON public.tournament_match_ready_state TO service_role;

CREATE OR REPLACE FUNCTION public.process_tournament_checkins()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  v_match public.tournament_matches%ROWTYPE;
  v_match_id uuid;
  v_code text;
  v_recipients uuid[];
  v_free text;
  v_breaks int := 0;
  v_warned int := 0;
  v_expired int := 0;
  v_ready int := 0;
BEGIN
  -- a. Timed breaks that have ended: back to "here", tell the player.
  FOR r IN
    UPDATE public.tournament_checkins c
       SET state = 'here', break_until = NULL
      FROM (SELECT tournament_id, player_id, break_until AS ended
              FROM public.tournament_checkins
             WHERE state = 'break' AND break_until IS NOT NULL AND break_until <= now()
               AND expires_at > now()) b
     WHERE c.tournament_id = b.tournament_id AND c.player_id = b.player_id
    RETURNING c.tournament_id, c.player_id, b.ended
  LOOP
    v_breaks := v_breaks + 1;
    BEGIN
      v_match_id := public.tournament_player_next_match(r.tournament_id, r.player_id);
      IF v_match_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(btrim(match_code), ''), 'your next match') INTO v_code
          FROM public.tournament_matches WHERE id = v_match_id;
        PERFORM public.dispatch_authoritative_match_alert(
          v_match_id, 'break_over', 'Your break is over',
          format('You''re back in the ready list for %s.', v_code),
          floor(extract(epoch FROM r.ended))::bigint, ARRAY[r.player_id], NULL);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'break-over alert for % failed: % %', r.player_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  -- b. "Still at the venue?" 10 minutes before a check-in runs out.
  FOR r IN
    UPDATE public.tournament_checkins c
       SET expiry_warned_for = c.expires_at
     WHERE c.expires_at > now()
       AND c.expires_at <= now() + interval '10 minutes'
       AND c.expiry_warned_for IS DISTINCT FROM c.expires_at
    RETURNING c.tournament_id, c.player_id, c.expires_at
  LOOP
    v_warned := v_warned + 1;
    BEGIN
      v_match_id := public.tournament_player_next_match(r.tournament_id, r.player_id);
      IF v_match_id IS NOT NULL THEN
        PERFORM public.dispatch_authoritative_match_alert(
          v_match_id, 'checkin_expiring', 'Still at the venue?',
          'Your check-in ends in 10 minutes. Tap to stay checked in.',
          floor(extract(epoch FROM r.expires_at))::bigint, ARRAY[r.player_id],
          format('/tournaments/%s/matches/%s?checkin=renew', r.tournament_id, v_match_id));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'expiry alert for % failed: % %', r.player_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  -- c. Expired check-ins are removed (readiness already ignores them).
  DELETE FROM public.tournament_checkins WHERE expires_at <= now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- d. Matches turning ready: tell the assigned umpire, else the referees.
  -- Tournaments with check-ins are evaluated; a match still marked ready whose
  -- tournament has none left (all expired) drops back to not ready, so the
  -- next day's first transition alerts again.
  FOR r IN
    WITH rd AS (
      SELECT x.match_id, x.ready
        FROM (SELECT DISTINCT tournament_id FROM public.tournament_checkins) tt
        JOIN public.tournaments t ON t.id = tt.tournament_id AND t.status <> ALL (ARRAY['draft', 'deleted'])
       CROSS JOIN LATERAL public.tournament_checkin_readiness(tt.tournament_id) x
    ), was AS (
      SELECT match_id, ready, transitions FROM public.tournament_match_ready_state WHERE ready
    )
    SELECT COALESCE(rd.match_id, was.match_id) AS match_id,
           COALESCE(rd.ready, false) AS ready,
           COALESCE(st.transitions, 0) AS transitions
      FROM rd
      FULL JOIN was ON was.match_id = rd.match_id
      LEFT JOIN public.tournament_match_ready_state st ON st.match_id = COALESCE(rd.match_id, was.match_id)
     WHERE COALESCE(rd.ready, false) IS DISTINCT FROM COALESCE(st.ready, false)
  LOOP
    INSERT INTO public.tournament_match_ready_state AS s (match_id, ready, changed_at, transitions)
    VALUES (r.match_id, r.ready, now(), CASE WHEN r.ready THEN 1 ELSE 0 END)
    ON CONFLICT (match_id) DO UPDATE
      SET ready = EXCLUDED.ready,
          changed_at = now(),
          transitions = s.transitions + CASE WHEN EXCLUDED.ready THEN 1 ELSE 0 END;

    CONTINUE WHEN NOT r.ready;
    v_ready := v_ready + 1;
    BEGIN
      SELECT * INTO v_match FROM public.tournament_matches WHERE id = r.match_id;
      SELECT array_agg(DISTINCT u) INTO v_recipients
        FROM (SELECT v_match.umpired_by AS u
              UNION SELECT ua.user_id FROM public.umpire_assignments ua WHERE ua.tournament_match_id = r.match_id) x
       WHERE u IS NOT NULL;
      IF v_recipients IS NULL THEN
        SELECT array_agg(DISTINCT o.user_id) INTO v_recipients
          FROM public.tournament_officials o
         WHERE o.tournament_id = v_match.tournament_id AND o.role = 'REFEREE';
      END IF;
      CONTINUE WHEN v_recipients IS NULL;

      -- A free court: the match's own if free, else the first scheduled court
      -- with nothing live on it.
      SELECT c INTO v_free
        FROM (SELECT DISTINCT btrim(court_number) AS c
                FROM public.tournament_matches
               WHERE tournament_id = v_match.tournament_id AND NULLIF(btrim(court_number), '') IS NOT NULL) courts
       WHERE NOT EXISTS (SELECT 1 FROM public.tournament_matches lm
                          WHERE lm.tournament_id = v_match.tournament_id
                            AND btrim(lm.court_number) = courts.c
                            AND lm.status IN ('in_progress', 'playing', 'live', 'ongoing'))
       ORDER BY (courts.c = btrim(COALESCE(v_match.court_number, ''))) DESC,
                length(courts.c), courts.c
       LIMIT 1;

      PERFORM public.dispatch_authoritative_match_alert(
        r.match_id, 'match_ready',
        format('%s is ready', COALESCE(NULLIF(btrim(v_match.match_code), ''), 'A match')),
        CASE WHEN v_free IS NULL
             THEN 'All players here. No court is free yet.'
             ELSE format('All players here, %s is free.',
                         CASE WHEN v_free ~ '^\d+$' THEN 'Court ' || v_free ELSE v_free END)
        END,
        r.transitions + 1, v_recipients, NULL);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'match-ready alert for % failed: % %', r.match_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('breaks_ended', v_breaks, 'expiry_warnings', v_warned,
                            'expired', v_expired, 'became_ready', v_ready);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_tournament_checkins() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_tournament_checkins() TO service_role;

-- ---------- 8. court calls: who was called ----------
ALTER TABLE public.court_calls ADD COLUMN IF NOT EXISTS player_ids uuid[];
COMMENT ON COLUMN public.court_calls.player_ids IS
  'Players this call went to; NULL on rows from before 20261120160000 means everyone in the match.';
CREATE INDEX IF NOT EXISTS court_calls_match_called_idx ON public.court_calls (match_id, called_at DESC);

-- ---------- 9. realtime ----------
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.court_calls;
