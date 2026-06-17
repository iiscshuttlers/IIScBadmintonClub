-- Buddy / Practice Partner System (normalized)
CREATE TABLE IF NOT EXISTS public.buddy_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
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
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Sender can insert buddy request"
  ON public.buddy_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receiver can update status"
  ON public.buddy_requests FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Parties can delete"
  ON public.buddy_requests FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS idx_buddy_sender   ON public.buddy_requests (sender_id);
CREATE INDEX IF NOT EXISTS idx_buddy_receiver ON public.buddy_requests (receiver_id);
CREATE INDEX IF NOT EXISTS idx_buddy_status   ON public.buddy_requests (status);

-- Auto-notify on buddy request
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

DROP TRIGGER IF EXISTS on_buddy_request_created ON public.buddy_requests;
CREATE TRIGGER on_buddy_request_created
  AFTER INSERT ON public.buddy_requests
  FOR EACH ROW EXECUTE PROCEDURE trigger_buddy_request_notification();
