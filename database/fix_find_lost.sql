-- 1. Add missing columns for claimed items
ALTER TABLE public.find_lost_posts ADD COLUMN IF NOT EXISTS claimed_by_id TEXT;
ALTER TABLE public.find_lost_posts ADD COLUMN IF NOT EXISTS claimed_by_name TEXT;

-- 2. Allow Admins to update and delete ANY post
DROP POLICY IF EXISTS "Admins can update all posts" ON public.find_lost_posts;
CREATE POLICY "Admins can update all posts"
  ON public.find_lost_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM site_data WHERE key = 'admins' AND value->>auth.email() = 'true'
    )
  );

DROP POLICY IF EXISTS "Admins can delete all posts" ON public.find_lost_posts;
CREATE POLICY "Admins can delete all posts"
  ON public.find_lost_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM site_data WHERE key = 'admins' AND value->>auth.email() = 'true'
    )
  );

-- 3. Create RPC to bypass RLS for non-authors trying to claim an item
CREATE OR REPLACE FUNCTION claim_find_lost_item(post_uuid UUID, claimer_id TEXT, claimer_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.find_lost_posts
  SET resolved = true, claimed_by_id = claimer_id, claimed_by_name = claimer_name
  WHERE id = post_uuid;
END;
$$;
