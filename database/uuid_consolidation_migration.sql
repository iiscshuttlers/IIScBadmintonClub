-- ============================================================
-- UUID Consolidation Migration
-- Goal: players.id becomes UUID (= auth.users.id), drop players.user_id
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run: staging columns are added with IF NOT EXISTS semantics
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Add UUID staging columns to child tables and populate
-- ============================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS _player1_id       UUID,
  ADD COLUMN IF NOT EXISTS _player2_id       UUID,
  ADD COLUMN IF NOT EXISTS _team1_partner_id UUID,
  ADD COLUMN IF NOT EXISTS _team2_partner_id UUID,
  ADD COLUMN IF NOT EXISTS _winner_id        UUID,
  ADD COLUMN IF NOT EXISTS _submitted_by     UUID;

UPDATE public.matches SET
  _player1_id       = (SELECT user_id FROM public.players WHERE id = player1_id),
  _player2_id       = (SELECT user_id FROM public.players WHERE id = player2_id),
  _team1_partner_id = (SELECT user_id FROM public.players WHERE id = team1_partner_id),
  _team2_partner_id = (SELECT user_id FROM public.players WHERE id = team2_partner_id),
  _winner_id        = (SELECT user_id FROM public.players WHERE id = winner_id),
  _submitted_by     = (SELECT user_id FROM public.players WHERE id = submitted_by);

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS _challenger_id UUID,
  ADD COLUMN IF NOT EXISTS _challenged_id UUID;

UPDATE public.challenges SET
  _challenger_id = (SELECT user_id FROM public.players WHERE id = challenger_id),
  _challenged_id = (SELECT user_id FROM public.players WHERE id = challenged_id);

ALTER TABLE public.buddy_requests
  ADD COLUMN IF NOT EXISTS _sender_id   UUID,
  ADD COLUMN IF NOT EXISTS _receiver_id UUID;

UPDATE public.buddy_requests SET
  _sender_id   = (SELECT user_id FROM public.players WHERE id = sender_id),
  _receiver_id = (SELECT user_id FROM public.players WHERE id = receiver_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'challenge_progress') THEN
    ALTER TABLE public.challenge_progress ADD COLUMN IF NOT EXISTS _player_id UUID;
    UPDATE public.challenge_progress SET
      _player_id = (SELECT user_id FROM public.players WHERE id = player_id);
  END IF;
END $$;

ALTER TABLE public.find_lost_posts
  ADD COLUMN IF NOT EXISTS _author_id UUID;

UPDATE public.find_lost_posts SET
  _author_id = (SELECT user_id FROM public.players WHERE id = author_id);

ALTER TABLE public.live_matches
  ADD COLUMN IF NOT EXISTS _player1_id UUID,
  ADD COLUMN IF NOT EXISTS _player2_id UUID,
  ADD COLUMN IF NOT EXISTS _scorer_id  UUID;

UPDATE public.live_matches SET
  _player1_id = (SELECT user_id FROM public.players WHERE id = player1_id),
  _player2_id = (SELECT user_id FROM public.players WHERE id = player2_id),
  _scorer_id  = (SELECT user_id FROM public.players WHERE id = scorer_id);

ALTER TABLE public.match_predictions
  ADD COLUMN IF NOT EXISTS _player_id           UUID,
  ADD COLUMN IF NOT EXISTS _predicted_winner_id UUID;

UPDATE public.match_predictions SET
  _player_id           = (SELECT user_id FROM public.players WHERE id = player_id),
  _predicted_winner_id = (SELECT user_id FROM public.players WHERE id = predicted_winner_id);

ALTER TABLE public.prediction_points
  ADD COLUMN IF NOT EXISTS _player_id UUID;

UPDATE public.prediction_points SET
  _player_id = (SELECT user_id FROM public.players WHERE id = player_id);

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS _player_id UUID;

UPDATE public.notification_queue SET
  _player_id = (SELECT user_id FROM public.players WHERE id = player_id);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS _user_id UUID;

UPDATE public.notifications SET
  _user_id = (SELECT user_id FROM public.players WHERE id = notifications.user_id);

-- ============================================================
-- STEP 2: Convert TEXT[] arrays on players to store UUIDs
-- (buddies, buddy_requests, followers, following)
-- ============================================================

UPDATE public.players p SET
  buddies = (
    SELECT COALESCE(array_agg(src.user_id::text ORDER BY ord), ARRAY[]::TEXT[])
    FROM unnest(COALESCE(p.buddies, ARRAY[]::TEXT[])) WITH ORDINALITY AS u(slug, ord)
    JOIN public.players src ON src.id = u.slug
  ),
  buddy_requests = (
    SELECT COALESCE(array_agg(src.user_id::text ORDER BY ord), ARRAY[]::TEXT[])
    FROM unnest(COALESCE(p.buddy_requests, ARRAY[]::TEXT[])) WITH ORDINALITY AS u(slug, ord)
    JOIN public.players src ON src.id = u.slug
  ),
  followers = (
    SELECT COALESCE(array_agg(src.user_id::text ORDER BY ord), ARRAY[]::TEXT[])
    FROM unnest(COALESCE(p.followers, ARRAY[]::TEXT[])) WITH ORDINALITY AS u(slug, ord)
    JOIN public.players src ON src.id = u.slug
  ),
  following = (
    SELECT COALESCE(array_agg(src.user_id::text ORDER BY ord), ARRAY[]::TEXT[])
    FROM unnest(COALESCE(p.following, ARRAY[]::TEXT[])) WITH ORDINALITY AS u(slug, ord)
    JOIN public.players src ON src.id = u.slug
  );

-- Convert matches.kudos_users TEXT[] to store UUIDs
UPDATE public.matches m SET
  kudos_users = (
    SELECT COALESCE(array_agg(src.user_id::text ORDER BY ord), ARRAY[]::TEXT[])
    FROM unnest(COALESCE(m.kudos_users, ARRAY[]::TEXT[])) WITH ORDINALITY AS u(slug, ord)
    JOIN public.players src ON src.id = u.slug
  );

-- ============================================================
-- STEP 3: Drop all FK constraints pointing to players(id)
-- ============================================================

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_player1_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_player2_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_team1_partner_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_team2_partner_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_winner_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_submitted_by_fkey;

ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_challenger_id_fkey,
  DROP CONSTRAINT IF EXISTS challenges_challenged_id_fkey;

ALTER TABLE public.buddy_requests
  DROP CONSTRAINT IF EXISTS buddy_requests_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS buddy_requests_receiver_id_fkey,
  DROP CONSTRAINT IF EXISTS buddy_requests_sender_id_receiver_id_key;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'challenge_progress') THEN
    ALTER TABLE public.challenge_progress DROP CONSTRAINT IF EXISTS challenge_progress_player_id_fkey;
  END IF;
END $$;

ALTER TABLE public.find_lost_posts
  DROP CONSTRAINT IF EXISTS find_lost_posts_author_id_fkey;

ALTER TABLE public.live_matches
  DROP CONSTRAINT IF EXISTS live_matches_player1_id_fkey,
  DROP CONSTRAINT IF EXISTS live_matches_player2_id_fkey,
  DROP CONSTRAINT IF EXISTS live_matches_scorer_id_fkey;

ALTER TABLE public.match_predictions
  DROP CONSTRAINT IF EXISTS match_predictions_player_id_fkey,
  DROP CONSTRAINT IF EXISTS match_predictions_predicted_winner_id_fkey;

ALTER TABLE public.prediction_points
  DROP CONSTRAINT IF EXISTS prediction_points_player_id_fkey,
  DROP CONSTRAINT IF EXISTS prediction_points_player_id_key;

ALTER TABLE public.notification_queue
  DROP CONSTRAINT IF EXISTS notification_queue_player_id_fkey;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.user_push_tokens
  DROP CONSTRAINT IF EXISTS user_push_tokens_user_id_fkey,
  DROP CONSTRAINT IF EXISTS user_push_tokens_user_id_token_key;

-- ============================================================
-- STEP 4: Drop ALL policies and FKs that depend on players.id
-- (covers user_id policies AND any column-id-referencing policies)
-- ============================================================

-- players self-policies
DROP POLICY IF EXISTS "Users can create their own profile"                  ON public.players;
DROP POLICY IF EXISTS "Users can update their own profile"                  ON public.players;
DROP POLICY IF EXISTS "Players can update their own looking_to_play status" ON public.players;

-- matches policies
DROP POLICY IF EXISTS "Players can read their pending matches"              ON public.matches;
DROP POLICY IF EXISTS "Players can withdraw their pending matches"          ON public.matches;
DROP POLICY IF EXISTS "Admins can delete any match"                        ON public.matches;

-- buddy_requests policies
DROP POLICY IF EXISTS "Parties can read their buddy requests"               ON public.buddy_requests;
DROP POLICY IF EXISTS "Sender can insert buddy request"                     ON public.buddy_requests;
DROP POLICY IF EXISTS "Receiver can update status"                          ON public.buddy_requests;
DROP POLICY IF EXISTS "Parties can delete"                                  ON public.buddy_requests;

-- live_matches policies
DROP POLICY IF EXISTS "Scorer can insert"                                   ON public.live_matches;
DROP POLICY IF EXISTS "Scorer can update"                                   ON public.live_matches;

-- match_predictions policies
DROP POLICY IF EXISTS "Player can manage own predictions"                   ON public.match_predictions;

-- prediction_points policies
DROP POLICY IF EXISTS "Player can manage own points"                        ON public.prediction_points;

-- challenge_progress policies
DROP POLICY IF EXISTS "Player can manage own progress"                      ON public.challenge_progress;

-- find_lost_posts policies
DROP POLICY IF EXISTS "Authors can insert their posts"                      ON public.find_lost_posts;
DROP POLICY IF EXISTS "Authors can update their own posts"                  ON public.find_lost_posts;
DROP POLICY IF EXISTS "Authors can delete their own posts"                  ON public.find_lost_posts;

-- push tokens policies
DROP POLICY IF EXISTS "Users can insert their own push tokens"              ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can update their own push tokens"              ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can view their own push tokens"                ON public.user_push_tokens;

-- broadcast_history policies
DROP POLICY IF EXISTS "Admins can read broadcast history"                   ON public.broadcast_history;
DROP POLICY IF EXISTS "Admins can insert broadcast history"                 ON public.broadcast_history;

-- tournament_registrations FK (not in our source files but exists in live DB)
ALTER TABLE public.tournament_registrations
  DROP CONSTRAINT IF EXISTS tournament_registrations_player_id_fkey;

-- ============================================================
-- STEP 5: Swap players.id (TEXT) → players.user_id (UUID)
-- ============================================================

-- Drop the TEXT PK (all FK constraints already dropped above)
ALTER TABLE public.players DROP COLUMN id;

-- Rename user_id → id, make it the PK
ALTER TABLE public.players RENAME COLUMN user_id TO id;
ALTER TABLE public.players ADD PRIMARY KEY (id);

-- ============================================================
-- STEP 6: Replace old TEXT columns with UUID columns in child tables
-- ============================================================

-- matches
ALTER TABLE public.matches
  DROP COLUMN player1_id,
  DROP COLUMN player2_id,
  DROP COLUMN team1_partner_id,
  DROP COLUMN team2_partner_id,
  DROP COLUMN winner_id,
  DROP COLUMN submitted_by;
ALTER TABLE public.matches RENAME COLUMN _player1_id       TO player1_id;
ALTER TABLE public.matches RENAME COLUMN _player2_id       TO player2_id;
ALTER TABLE public.matches RENAME COLUMN _team1_partner_id TO team1_partner_id;
ALTER TABLE public.matches RENAME COLUMN _team2_partner_id TO team2_partner_id;
ALTER TABLE public.matches RENAME COLUMN _winner_id        TO winner_id;
ALTER TABLE public.matches RENAME COLUMN _submitted_by     TO submitted_by;

-- challenges
ALTER TABLE public.challenges DROP COLUMN challenger_id, DROP COLUMN challenged_id;
ALTER TABLE public.challenges RENAME COLUMN _challenger_id TO challenger_id;
ALTER TABLE public.challenges RENAME COLUMN _challenged_id TO challenged_id;

-- buddy_requests
ALTER TABLE public.buddy_requests DROP COLUMN sender_id, DROP COLUMN receiver_id;
ALTER TABLE public.buddy_requests RENAME COLUMN _sender_id   TO sender_id;
ALTER TABLE public.buddy_requests RENAME COLUMN _receiver_id TO receiver_id;
ALTER TABLE public.buddy_requests ADD CONSTRAINT buddy_requests_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);

-- challenge_progress
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'challenge_progress' AND column_name = '_player_id') THEN
    ALTER TABLE public.challenge_progress DROP COLUMN player_id;
    ALTER TABLE public.challenge_progress RENAME COLUMN _player_id TO player_id;
  END IF;
END $$;

-- find_lost_posts
ALTER TABLE public.find_lost_posts DROP COLUMN author_id;
ALTER TABLE public.find_lost_posts RENAME COLUMN _author_id TO author_id;

-- live_matches
ALTER TABLE public.live_matches
  DROP COLUMN player1_id, DROP COLUMN player2_id, DROP COLUMN scorer_id;
ALTER TABLE public.live_matches RENAME COLUMN _player1_id TO player1_id;
ALTER TABLE public.live_matches RENAME COLUMN _player2_id TO player2_id;
ALTER TABLE public.live_matches RENAME COLUMN _scorer_id  TO scorer_id;

-- match_predictions
ALTER TABLE public.match_predictions DROP COLUMN player_id, DROP COLUMN predicted_winner_id;
ALTER TABLE public.match_predictions RENAME COLUMN _player_id           TO player_id;
ALTER TABLE public.match_predictions RENAME COLUMN _predicted_winner_id TO predicted_winner_id;

-- prediction_points
ALTER TABLE public.prediction_points DROP COLUMN player_id;
ALTER TABLE public.prediction_points RENAME COLUMN _player_id TO player_id;
ALTER TABLE public.prediction_points ADD CONSTRAINT prediction_points_player_id_key UNIQUE (player_id);

-- notification_queue
ALTER TABLE public.notification_queue DROP COLUMN player_id;
ALTER TABLE public.notification_queue RENAME COLUMN _player_id TO player_id;

-- notifications
ALTER TABLE public.notifications DROP COLUMN user_id;
ALTER TABLE public.notifications RENAME COLUMN _user_id TO user_id;

-- user_push_tokens: column contains UUID strings already; just change the type
ALTER TABLE public.user_push_tokens ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE public.user_push_tokens ADD CONSTRAINT user_push_tokens_user_id_token_key UNIQUE (user_id, token);

-- ============================================================
-- STEP 7: Recreate FK constraints (all now UUID → UUID)
-- ============================================================

ALTER TABLE public.matches
  ADD CONSTRAINT matches_player1_id_fkey       FOREIGN KEY (player1_id)       REFERENCES public.players(id),
  ADD CONSTRAINT matches_player2_id_fkey       FOREIGN KEY (player2_id)       REFERENCES public.players(id),
  ADD CONSTRAINT matches_team1_partner_id_fkey FOREIGN KEY (team1_partner_id) REFERENCES public.players(id),
  ADD CONSTRAINT matches_team2_partner_id_fkey FOREIGN KEY (team2_partner_id) REFERENCES public.players(id),
  ADD CONSTRAINT matches_winner_id_fkey        FOREIGN KEY (winner_id)        REFERENCES public.players(id),
  ADD CONSTRAINT matches_submitted_by_fkey     FOREIGN KEY (submitted_by)     REFERENCES public.players(id);

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES public.players(id) ON DELETE CASCADE,
  ADD CONSTRAINT challenges_challenged_id_fkey FOREIGN KEY (challenged_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.buddy_requests
  ADD CONSTRAINT buddy_requests_sender_id_fkey   FOREIGN KEY (sender_id)   REFERENCES public.players(id) ON DELETE CASCADE,
  ADD CONSTRAINT buddy_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.players(id) ON DELETE CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'challenge_progress') THEN
    ALTER TABLE public.challenge_progress
      ADD CONSTRAINT challenge_progress_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.find_lost_posts
  ADD CONSTRAINT find_lost_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.live_matches
  ADD CONSTRAINT live_matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE CASCADE,
  ADD CONSTRAINT live_matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE CASCADE,
  ADD CONSTRAINT live_matches_scorer_id_fkey  FOREIGN KEY (scorer_id)  REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.match_predictions
  ADD CONSTRAINT match_predictions_player_id_fkey          FOREIGN KEY (player_id)           REFERENCES public.players(id) ON DELETE CASCADE,
  ADD CONSTRAINT match_predictions_predicted_winner_id_fkey FOREIGN KEY (predicted_winner_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.prediction_points
  ADD CONSTRAINT prediction_points_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.user_push_tokens
  ADD CONSTRAINT user_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.players(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 8: Recreate simplified RLS policies
-- ============================================================

-- players: id IS auth.uid() now
CREATE POLICY "Users can create their own profile"
  ON public.players FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.players FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Players can update their own looking_to_play status"
  ON public.players FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- matches: pending match visibility — sender_id/receiver_id columns are now UUID
CREATE POLICY "Players can read their pending matches"
  ON public.matches FOR SELECT
  USING (
    status = 'pending'
    AND auth.uid() IN (player1_id, player2_id, team1_partner_id, team2_partner_id)
  );

-- buddy_requests: sender_id / receiver_id are now the auth UUID directly
CREATE POLICY "Parties can read their buddy requests"
  ON public.buddy_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Sender can insert buddy request"
  ON public.buddy_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receiver can update status"
  ON public.buddy_requests FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Parties can delete"
  ON public.buddy_requests FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- user_push_tokens: user_id is now UUID
CREATE POLICY "Users can insert their own push tokens"
  ON public.user_push_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
  ON public.user_push_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own push tokens"
  ON public.user_push_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- matches: delete policies
CREATE POLICY "Players can withdraw their pending matches"
  ON public.matches FOR DELETE
  USING (
    status = 'pending'
    AND (auth.uid() = submitted_by OR auth.uid() IN (player1_id, player2_id, team1_partner_id, team2_partner_id))
  );

CREATE POLICY "Admins can delete any match"
  ON public.matches FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('master_admin', 'admin')));

-- live_matches
CREATE POLICY "Scorer can insert"
  ON public.live_matches FOR INSERT
  WITH CHECK (auth.uid() = scorer_id);

CREATE POLICY "Scorer can update"
  ON public.live_matches FOR UPDATE
  USING (auth.uid() = scorer_id);

-- match_predictions
CREATE POLICY "Player can manage own predictions"
  ON public.match_predictions FOR ALL
  USING (auth.uid() = player_id);

-- prediction_points
CREATE POLICY "Player can manage own points"
  ON public.prediction_points FOR ALL
  USING (auth.uid() = player_id);

-- challenge_progress
CREATE POLICY "Player can manage own progress"
  ON public.challenge_progress FOR ALL
  USING (auth.uid() = player_id);

-- find_lost_posts
CREATE POLICY "Authors can insert their posts"
  ON public.find_lost_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own posts"
  ON public.find_lost_posts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own posts"
  ON public.find_lost_posts FOR DELETE
  USING (auth.uid() = author_id);

-- broadcast_history: id = auth.uid() now
CREATE POLICY "Admins can read broadcast history"
  ON public.broadcast_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('master_admin', 'admin')));

CREATE POLICY "Admins can insert broadcast history"
  ON public.broadcast_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('master_admin', 'admin')));

-- ============================================================
-- STEP 9: Simplify SQL functions (no more user_id lookup)
-- ============================================================

CREATE OR REPLACE FUNCTION send_buddy_request(p_target_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_append(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id
    AND NOT (v_my_id::text = ANY(COALESCE(buddy_requests, ARRAY[]::TEXT[])));
END;
$$;

CREATE OR REPLACE FUNCTION cancel_buddy_request(p_target_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id;
END;
$$;

CREATE OR REPLACE FUNCTION accept_buddy_request(p_target_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), p_target_id::text),
      buddies        = array_append(COALESCE(buddies, ARRAY[]::TEXT[]), p_target_id::text)
  WHERE id = v_my_id
    AND NOT (p_target_id::text = ANY(COALESCE(buddies, ARRAY[]::TEXT[])));
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text),
      buddies        = array_append(COALESCE(buddies, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id
    AND NOT (v_my_id::text = ANY(COALESCE(buddies, ARRAY[]::TEXT[])));
END;
$$;

CREATE OR REPLACE FUNCTION remove_buddy(p_target_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), p_target_id::text) WHERE id = v_my_id;
  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), v_my_id::text)     WHERE id = p_target_id;
END;
$$;

CREATE OR REPLACE FUNCTION toggle_match_kudos(p_match_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_player_id UUID    := auth.uid();
  v_is_liked  BOOLEAN;
BEGIN
  IF v_player_id IS NULL THEN RAISE EXCEPTION 'Not authenticated or no player profile'; END IF;

  SELECT v_player_id::text = ANY(kudos_users) INTO v_is_liked FROM matches WHERE id = p_match_id;

  IF v_is_liked THEN
    UPDATE matches SET
      kudos_users = array_remove(kudos_users, v_player_id::text),
      kudos_count = GREATEST(0, kudos_count - 1)
    WHERE id = p_match_id;
  ELSE
    UPDATE matches SET
      kudos_users = array_append(kudos_users, v_player_id::text),
      kudos_count = kudos_count + 1
    WHERE id = p_match_id;
  END IF;
END;
$$;

-- ============================================================
-- STEP 10: Set master admin by role (using id = auth UUID now)
-- ============================================================
UPDATE public.players SET role = 'master_admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('iiscbadmintonclub@gmail.com', 'janmejayraja@iisc.ac.in', 'rajajanmejaya@gmail.com')
);

COMMIT;
