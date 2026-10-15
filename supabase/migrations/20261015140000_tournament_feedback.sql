-- Post-event rating. Players who played a tournament rate it 1–5 with optional
-- tags and a comment. Two hours after a tournament is marked completed or
-- archived, its participants get an in-app + push nudge (queued through the
-- existing scheduled_notifications dispatcher) linking to /rate/:id.
-- Organisers/officials/admins read all feedback (wrap-up report).

CREATE TABLE IF NOT EXISTS public.tournament_feedback (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags          text[] NOT NULL DEFAULT ARRAY[]::text[],
  comment       text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

CREATE OR REPLACE FUNCTION public.played_in_tournament(p_tournament uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_matches
    WHERE tournament_id = p_tournament
      AND p_uid IN (player1_id, player2_id, player3_id, player4_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.played_in_tournament(uuid, uuid) TO authenticated;

ALTER TABLE public.tournament_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback read own or as official" ON public.tournament_feedback;
CREATE POLICY "feedback read own or as official"
  ON public.tournament_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_master() OR is_tournament_official(tournament_id));

DROP POLICY IF EXISTS "feedback write own if played" ON public.tournament_feedback;
CREATE POLICY "feedback write own if played"
  ON public.tournament_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.played_in_tournament(tournament_id, auth.uid()));

DROP POLICY IF EXISTS "feedback update own" ON public.tournament_feedback;
CREATE POLICY "feedback update own"
  ON public.tournament_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Let a scheduled notification carry its own deep link (dispatcher falls back
-- to /pulse when NULL).
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS link text;

CREATE OR REPLACE FUNCTION public.queue_tournament_feedback_prompt()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link text := '/rate/' || NEW.id;
  v_recipients uuid[];
BEGIN
  IF NEW.status NOT IN ('completed', 'archived') OR OLD.status IN ('completed', 'archived') THEN
    RETURN NEW;
  END IF;
  -- Once per tournament (e.g. completed → archived must not re-send).
  IF EXISTS (SELECT 1 FROM scheduled_notifications WHERE tournament_id = NEW.id AND link = v_link) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT pid), ARRAY[]::uuid[]) INTO v_recipients
  FROM (
    SELECT unnest(ARRAY[player1_id, player2_id, player3_id, player4_id]) AS pid
    FROM tournament_matches
    WHERE tournament_id = NEW.id AND status IN ('completed', 'walkover')
  ) s
  WHERE pid IS NOT NULL;

  IF array_length(v_recipients, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO scheduled_notifications
    (tournament_id, created_by, title, body, channels, audience, recipient_ids, scheduled_at, link)
  VALUES
    (NEW.id, NEW.created_by,
     'How was ' || NEW.name || '?',
     'Rate the tournament in 10 seconds — it helps the organisers make the next one better.',
     ARRAY['in_app', 'push'], 'tournament', v_recipients, now() + interval '2 hours', v_link);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_tournament_feedback_prompt ON public.tournaments;
CREATE TRIGGER trg_queue_tournament_feedback_prompt
  AFTER UPDATE OF status ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.queue_tournament_feedback_prompt();
