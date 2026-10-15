-- "Call to court" log: who called players to a match, and when. Written by the
-- call-to-court edge function (service role); used for its 90 s cooldown.

CREATE TABLE IF NOT EXISTS public.court_calls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  called_by  uuid REFERENCES public.players(id) ON DELETE SET NULL,
  called_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS court_calls_match_idx ON public.court_calls (match_id, called_at DESC);

ALTER TABLE public.court_calls ENABLE ROW LEVEL SECURITY;

-- Officials can see call history in the console; writes are service-role only.
DROP POLICY IF EXISTS "court calls readable" ON public.court_calls;
CREATE POLICY "court calls readable"
  ON public.court_calls FOR SELECT
  TO authenticated
  USING (true);
