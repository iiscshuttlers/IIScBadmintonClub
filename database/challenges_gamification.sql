-- Weekly/Daily Challenges gamification
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start  DATE        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('wins','matches','singles','doubles','streak')),
  target      INT         NOT NULL,
  points      INT         NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID        NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
  player_id    TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  progress     INT         NOT NULL DEFAULT 0,
  completed    BOOLEAN     NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, player_id)
);

ALTER TABLE public.weekly_challenges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read challenges" ON public.weekly_challenges;
DROP POLICY IF EXISTS "Anyone authenticated can read progress"  ON public.challenge_progress;
DROP POLICY IF EXISTS "Player can manage own progress"          ON public.challenge_progress;
DROP POLICY IF EXISTS "Anyone authenticated can insert challenges" ON public.weekly_challenges;

CREATE POLICY "Anyone authenticated can read challenges"
  ON public.weekly_challenges FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can insert challenges"
  ON public.weekly_challenges FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can read progress"
  ON public.challenge_progress FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Player can manage own progress"
  ON public.challenge_progress FOR ALL
  USING (auth.uid() = player_id);

CREATE INDEX IF NOT EXISTS idx_weekly_challenges_week      ON public.weekly_challenges (week_start DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_player   ON public.challenge_progress (player_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge ON public.challenge_progress (challenge_id);
