-- Live match scoring for spectator mode (#2)
CREATE TABLE IF NOT EXISTS public.live_matches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id    TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player2_id    TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  scorer_id     TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  score_p1      INT         NOT NULL DEFAULT 0,
  score_p2      INT         NOT NULL DEFAULT 0,
  set_number    INT         NOT NULL DEFAULT 1,
  sets_p1       INT         NOT NULL DEFAULT 0,
  sets_p2       INT         NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'live' CHECK (status IN ('live','finished')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read live matches" ON public.live_matches;
DROP POLICY IF EXISTS "Scorer can insert"                          ON public.live_matches;
DROP POLICY IF EXISTS "Scorer can update"                          ON public.live_matches;

CREATE POLICY "Anyone authenticated can read live matches"
  ON public.live_matches FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Scorer can insert"
  ON public.live_matches FOR INSERT
  WITH CHECK (auth.uid() = scorer_id);

CREATE POLICY "Scorer can update"
  ON public.live_matches FOR UPDATE
  USING (auth.uid() = scorer_id);

CREATE INDEX IF NOT EXISTS idx_live_matches_status ON public.live_matches (status, started_at DESC) WHERE status = 'live';

-- Match predictions / bet-points game (#8)
CREATE TABLE IF NOT EXISTS public.match_predictions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id             UUID        NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id            UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  predicted_winner_id  UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  points_wagered       INT         NOT NULL DEFAULT 5 CHECK (points_wagered BETWEEN 1 AND 50),
  correct              BOOLEAN,
  points_earned        INT         NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);

ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read predictions"  ON public.match_predictions;
DROP POLICY IF EXISTS "Player can manage own predictions"          ON public.match_predictions;

CREATE POLICY "Anyone authenticated can read predictions"
  ON public.match_predictions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Player can manage own predictions"
  ON public.match_predictions FOR ALL
  USING (auth.uid() = player_id);

-- Prediction points leaderboard (#8)
CREATE TABLE IF NOT EXISTS public.prediction_points (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE UNIQUE,
  total_points INT         NOT NULL DEFAULT 100,
  predictions  INT         NOT NULL DEFAULT 0,
  correct      INT         NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prediction_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read prediction points" ON public.prediction_points;
DROP POLICY IF EXISTS "Player can manage own points"                    ON public.prediction_points;

CREATE POLICY "Anyone authenticated can read prediction points"
  ON public.prediction_points FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Player can manage own points"
  ON public.prediction_points FOR ALL
  USING (auth.uid() = player_id);

CREATE INDEX IF NOT EXISTS idx_predictions_match  ON public.match_predictions (match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_player ON public.match_predictions (player_id);
