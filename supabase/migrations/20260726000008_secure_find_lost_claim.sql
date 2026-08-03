-- Secure Find & Lost Claims and Fix Schema Desync

-- 1. Add missing columns to match frontend updates
ALTER TABLE public.find_lost_posts ADD COLUMN IF NOT EXISTS claim_msg TEXT;
ALTER TABLE public.find_lost_posts ADD COLUMN IF NOT EXISTS claim_contact_info TEXT;

-- 2. Secure claim_find_lost_item (prevent identity spoofing)
-- Note: We keep the exact 5-parameter signature the UI is calling to prevent downtime,
-- but we completely ignore the untrusted `claimer_id` parameter and derive identity from auth.uid().
CREATE OR REPLACE FUNCTION claim_find_lost_item(
  post_uuid UUID, 
  claimer_id TEXT, 
  claimer_name TEXT, 
  claim_msg TEXT, 
  claim_contact_info TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 3. Create missing unclaim_find_lost_item (securely)
CREATE OR REPLACE FUNCTION unclaim_find_lost_item(
  post_uuid UUID, 
  user_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 4. Drop wide-open redundant storage policy
DROP POLICY IF EXISTS "Authenticated can delete find-lost images" ON storage.objects;
