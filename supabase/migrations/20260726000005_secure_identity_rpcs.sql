-- Secure Identity RPCs against Spoofing and Forgery

-- 1. send_ping_notification: Stop Notification Spoofing
CREATE OR REPLACE FUNCTION send_ping_notification(
  p_target_id UUID,
  p_sender_name TEXT -- Parameter kept for backwards compatibility but IGNORED
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_true_sender_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF auth.uid() = p_target_id THEN RAISE EXCEPTION 'Cannot ping yourself'; END IF;

  -- SECURE RESOLUTION: Ignore client parameter, fetch the true name from DB
  SELECT full_name INTO v_true_sender_name 
  FROM public.players 
  WHERE id = auth.uid();

  IF v_true_sender_name IS NULL THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    p_target_id,
    'Match Request (Ping)!',
    v_true_sender_name || ' is looking to play a match with you!',
    'ping',
    '/players'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION send_ping_notification(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION send_ping_notification(UUID, TEXT) TO authenticated;


-- 2. upsert_player_endorsement: Stop Reputation Forgery
CREATE OR REPLACE FUNCTION upsert_player_endorsement(
    p_endorsed_player_id UUID,
    p_endorser_id UUID,
    p_category TEXT,
    p_trait TEXT
) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION upsert_player_endorsement(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_player_endorsement(UUID, UUID, TEXT, TEXT) TO authenticated;


-- 3. fulfill_marketplace_request: Stop Marketplace Hijacking
CREATE OR REPLACE FUNCTION public.fulfill_marketplace_request(
    listing_uuid uuid, 
    claimer_id uuid, 
    claimer_name text -- Kept for backwards compatibility but IGNORED
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.fulfill_marketplace_request(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_marketplace_request(UUID, UUID, TEXT) TO authenticated;


-- 4. Legacy Umpire Forgery: Drop old vulnerable functions
DROP FUNCTION IF EXISTS upsert_live_match(TEXT, JSONB);
DROP FUNCTION IF EXISTS remove_live_match(TEXT);
