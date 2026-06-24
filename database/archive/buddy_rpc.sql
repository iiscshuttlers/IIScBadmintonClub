CREATE OR REPLACE FUNCTION send_buddy_request(p_target_id UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_append(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id
    AND NOT (v_my_id::text = ANY(COALESCE(buddy_requests, ARRAY[]::TEXT[])));
END;
$$;

CREATE OR REPLACE FUNCTION cancel_buddy_request(p_target_id UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE players
  SET buddy_requests = array_remove(COALESCE(buddy_requests, ARRAY[]::TEXT[]), v_my_id::text)
  WHERE id = p_target_id;
END;
$$;

CREATE OR REPLACE FUNCTION accept_buddy_request(p_target_id UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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

CREATE OR REPLACE FUNCTION remove_buddy(p_target_id UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_my_id UUID := auth.uid();
BEGIN
  IF v_my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), p_target_id::text) WHERE id = v_my_id;
  UPDATE players SET buddies = array_remove(COALESCE(buddies, ARRAY[]::TEXT[]), v_my_id::text)     WHERE id = p_target_id;
END;
$$;
