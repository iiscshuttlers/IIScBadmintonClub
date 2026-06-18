-- ============================================================
-- Find & Lost: multi-image support + claim type fix
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Multiple images per post (legacy single image_url is kept for old rows)
ALTER TABLE public.find_lost_posts ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- 2. Fix claim RPC
--    Live DB has claimed_by_id as UUID, but claim_find_lost_item passed TEXT,
--    causing: 'column "claimed_by_id" is of type uuid but expression is of type text'.
--    Casting claimer_id::uuid works whether the column is uuid or text.
CREATE OR REPLACE FUNCTION claim_find_lost_item(post_uuid UUID, claimer_id TEXT, claimer_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.find_lost_posts
  SET resolved = true,
      claimed_by_id = claimer_id::uuid,
      claimed_by_name = claimer_name
  WHERE id = post_uuid;
END;
$$;

-- 3. Allow deleting images from the 'find-lost' storage bucket so that
--    removing a post also removes its images. The app only triggers this
--    after a successful post delete (already gated to author/admin in RLS + UI).
DROP POLICY IF EXISTS "Authenticated can delete find-lost images" ON storage.objects;
CREATE POLICY "Authenticated can delete find-lost images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'find-lost');

