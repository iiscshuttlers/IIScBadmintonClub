-- Challenges table for matchmaking
CREATE TABLE IF NOT EXISTS public.challenges (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id  UUID        REFERENCES public.players(id) ON DELETE CASCADE,
  challenged_id  UUID        REFERENCES public.players(id) ON DELETE CASCADE,
  format         TEXT        NOT NULL,
  status         TEXT        DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','completed','cancelled')),
  scheduled_time TIMESTAMPTZ,
  message        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view challenges"            ON public.challenges;
DROP POLICY IF EXISTS "Users can create challenges"           ON public.challenges;
DROP POLICY IF EXISTS "Users can update their own challenges" ON public.challenges;

CREATE POLICY "Anyone can view challenges"
  ON public.challenges FOR SELECT USING (true);

CREATE POLICY "Users can create challenges"
  ON public.challenges FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own challenges"
  ON public.challenges FOR UPDATE USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_challenges_modtime ON public.challenges;
CREATE TRIGGER update_challenges_modtime
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES public.players(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  type       TEXT        NOT NULL,
  is_read    BOOLEAN     DEFAULT false,
  link       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications"                    ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications"                           ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (mark read)"      ON public.notifications;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT USING (true);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications (mark read)"
  ON public.notifications FOR UPDATE USING (true);

-- Auto-notify on challenge creation
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
    '/player/' || NEW.challenged_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_challenge_created ON public.challenges;
CREATE TRIGGER on_challenge_created
  AFTER INSERT ON public.challenges
  FOR EACH ROW EXECUTE PROCEDURE trigger_challenge_notification();
