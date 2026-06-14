-- Find & Lost bulletin board
CREATE TABLE IF NOT EXISTS public.find_lost_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('lost', 'found')),
  title        TEXT        NOT NULL,
  description  TEXT,
  location     TEXT,
  contact      TEXT,
  image_url    TEXT,
  resolved     BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.find_lost_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read find_lost posts"   ON public.find_lost_posts;
DROP POLICY IF EXISTS "Authors can insert their posts"    ON public.find_lost_posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.find_lost_posts;
DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.find_lost_posts;

CREATE POLICY "Anyone can read find_lost posts"
  ON public.find_lost_posts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authors can insert their posts"
  ON public.find_lost_posts FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = author_id));

CREATE POLICY "Authors can update their own posts"
  ON public.find_lost_posts FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = author_id));

CREATE POLICY "Authors can delete their own posts"
  ON public.find_lost_posts FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = author_id));

CREATE INDEX IF NOT EXISTS idx_find_lost_created  ON public.find_lost_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_find_lost_type     ON public.find_lost_posts (type);
CREATE INDEX IF NOT EXISTS idx_find_lost_resolved ON public.find_lost_posts (resolved);
