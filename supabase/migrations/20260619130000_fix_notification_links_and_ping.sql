-- Fix challenge notification link: was /player/<challenged_id>, now /feed/challenges
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
    '/feed/challenges'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix buddy request notification link: was /player/<sender_id>, now /players#network
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
    '/players#network'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix new follower notification link: was /player/<follower_id>, now /players#network
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
      '/players#network'
    );
  END IF;
END;
$$;

-- Add ping_sent notification type support (inserted client-side via RPC)
-- This RPC lets a player insert a ping notification for another player securely
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
    '/players'
  );
END;
$$;
