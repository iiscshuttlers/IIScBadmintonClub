-- Buddy / Practice Partner System (normalized)
CREATE TABLE IF NOT EXISTS public.buddy_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  receiver_id TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);

ALTER TABLE public.buddy_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parties can read their buddy requests" ON public.buddy_requests;
DROP POLICY IF EXISTS "Sender can insert buddy request"       ON public.buddy_requests;
DROP POLICY IF EXISTS "Receiver can update status"            ON public.buddy_requests;
DROP POLICY IF EXISTS "Parties can delete"                    ON public.buddy_requests;

CREATE POLICY "Parties can read their buddy requests"
  ON public.buddy_requests FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = sender_id)
      OR auth.uid() = (SELECT user_id FROM public.players WHERE id = receiver_id));

CREATE POLICY "Sender can insert buddy request"
  ON public.buddy_requests FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = sender_id));

CREATE POLICY "Receiver can update status"
  ON public.buddy_requests FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = receiver_id)
      OR auth.uid() = (SELECT user_id FROM public.players WHERE id = sender_id));

CREATE POLICY "Parties can delete"
  ON public.buddy_requests FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = sender_id)
      OR auth.uid() = (SELECT user_id FROM public.players WHERE id = receiver_id));

CREATE INDEX IF NOT EXISTS idx_buddy_sender   ON public.buddy_requests (sender_id);
CREATE INDEX IF NOT EXISTS idx_buddy_receiver ON public.buddy_requests (receiver_id);
CREATE INDEX IF NOT EXISTS idx_buddy_status   ON public.buddy_requests (status);
