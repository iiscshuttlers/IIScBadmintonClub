-- Allow admins to update all find_lost_posts
DROP POLICY IF EXISTS "Admins can update all posts" ON public.find_lost_posts;
CREATE POLICY "Admins can update all posts"
  ON public.find_lost_posts FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  );

-- Allow admins to delete all find_lost_posts
DROP POLICY IF EXISTS "Admins can delete all posts" ON public.find_lost_posts;
CREATE POLICY "Admins can delete all posts"
  ON public.find_lost_posts FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin'))
  );