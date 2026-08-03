-- Fix notification links that point to routes which no longer exist in the app router.
-- /feed/challenges, /players#network, /players were all stale from an earlier routing scheme.

CREATE OR REPLACE FUNCTION trigger_challenge_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_buddy_request_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION toggle_follow(p_target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Fix match insert/confirm notification links: /feed/my-matches -> /my-matches
CREATE OR REPLACE FUNCTION notify_players_on_match_insert()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_players_on_match_confirm()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_ping_notification(
  p_target_id UUID,
  p_sender_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
