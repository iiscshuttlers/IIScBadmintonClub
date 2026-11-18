-- Sports-site plan item 10: weekly club-rank snapshots for BWF-style
-- movement arrows (▲3 / ▼1 / NEW / RE).
--
-- Owner decision 2 (14 Nov 2026): no backfill. The first snapshot is taken
-- when this migration runs; arrows appear from the second weekly snapshot.
--
-- Rank rule mirrors client/src/lib/rankingUtils.ts::calculateRanksMap, which
-- the players directory shows today: per list, players with a non-null rating
-- other than the untouched 1200 baseline, ordered by rating desc then win %
-- desc (records "5W - 3L" or "5-3"; anything else counts as -1), ties share a
-- rank and the next rank skips (RANK()). Keep both in step — see
-- client/src/lib/rankMovement.test.ts ("club rank rule").

CREATE TABLE IF NOT EXISTS public.ranking_snapshots (
  snapshot_date date    NOT NULL,
  list          text    NOT NULL CHECK (list IN ('overall', 'singles', 'doubles', 'mixed')),
  player_id     uuid    NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rank          integer NOT NULL CHECK (rank > 0),
  rating        numeric NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, list, player_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_player ON public.ranking_snapshots (player_id, list, snapshot_date DESC);

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_snapshots_public_read" ON public.ranking_snapshots;
CREATE POLICY "ranking_snapshots_public_read" ON public.ranking_snapshots
  FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.ranking_snapshots FROM anon, authenticated;
GRANT SELECT ON public.ranking_snapshots TO anon, authenticated;

-- Win % exactly as rankingUtils.getWinPct: -1 when unknown or 0 matches.
CREATE OR REPLACE FUNCTION public.record_win_pct(p_record text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  m text[];
  w numeric;
  l numeric;
BEGIN
  IF p_record IS NULL THEN RETURN -1; END IF;
  m := regexp_match(upper(p_record), '(\d+)\s*W\s*-?\s*(\d+)\s*L');
  IF m IS NULL THEN
    m := regexp_match(upper(p_record), '^(\d+)\s*-\s*(\d+)$');
  END IF;
  IF m IS NULL THEN RETURN -1; END IF;
  w := m[1]::numeric;
  l := m[2]::numeric;
  IF w + l = 0 THEN RETURN -1; END IF;
  RETURN w / (w + l);
END;
$$;

-- Current club ranks for every list (same rule as the directory).
CREATE OR REPLACE FUNCTION public.current_club_ranks()
RETURNS TABLE (list text, player_id uuid, rank integer, rating numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH src AS (
    SELECT p.id,
           x.list,
           x.rating,
           public.record_win_pct(x.record) AS pct
    FROM public.players p
    CROSS JOIN LATERAL (VALUES
      ('overall', p.elo_rating::numeric,  p.win_loss_record::text),
      ('singles', p.singles_elo::numeric, p.singles_record::text),
      ('doubles', p.doubles_elo::numeric, p.doubles_record::text),
      ('mixed',   p.mixed_elo::numeric,   p.mixed_record::text)
    ) AS x(list, rating, record)
    WHERE p.deleted_at IS NULL
      AND x.rating IS NOT NULL
      AND x.rating <> 1200
  )
  SELECT list, id, (RANK() OVER (PARTITION BY list ORDER BY rating DESC, pct DESC))::integer, rating
  FROM src
$$;

GRANT EXECUTE ON FUNCTION public.current_club_ranks() TO anon, authenticated;

-- Idempotent per date: re-running the same day changes nothing.
CREATE OR REPLACE FUNCTION public.take_ranking_snapshot(p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date))
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.ranking_snapshots (snapshot_date, list, player_id, rank, rating)
  SELECT p_date, r.list, r.player_id, r.rank, r.rating
  FROM public.current_club_ranks() r
  ON CONFLICT (snapshot_date, list, player_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.take_ranking_snapshot(date) FROM PUBLIC, anon, authenticated;

-- Movement for the latest snapshot at least 6 days old (plain rows).
--   status: 'new'  never ranked in any earlier snapshot of this list
--           're'   ranked before, but not in the comparison snapshot
--           'moved' rank known in the comparison snapshot (delta may be 0)
CREATE OR REPLACE FUNCTION public.ranking_movement(p_list text DEFAULT 'overall')
RETURNS TABLE (player_id uuid, rank integer, previous_rank integer, delta integer, status text, since date, peak_rank integer)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH base AS (
    SELECT max(snapshot_date) AS d
    FROM public.ranking_snapshots
    WHERE list = p_list AND snapshot_date <= ((now() AT TIME ZONE 'Asia/Kolkata')::date - 6)
  ),
  cur AS (SELECT * FROM public.current_club_ranks() WHERE list = p_list)
  SELECT c.player_id,
         c.rank,
         prev.rank,
         CASE WHEN prev.rank IS NULL THEN NULL ELSE prev.rank - c.rank END,
         CASE
           WHEN (SELECT d FROM base) IS NULL THEN 'none'
           WHEN prev.rank IS NOT NULL THEN 'moved'
           WHEN EXISTS (
             SELECT 1 FROM public.ranking_snapshots s
             WHERE s.list = p_list AND s.player_id = c.player_id AND s.snapshot_date < (SELECT d FROM base)
           ) THEN 're'
           ELSE 'new'
         END,
         (SELECT d FROM base),
         LEAST(c.rank, (SELECT min(s.rank) FROM public.ranking_snapshots s WHERE s.list = p_list AND s.player_id = c.player_id))
  FROM cur c
  LEFT JOIN public.ranking_snapshots prev
    ON prev.list = p_list AND prev.player_id = c.player_id AND prev.snapshot_date = (SELECT d FROM base)
$$;

GRANT EXECUTE ON FUNCTION public.ranking_movement(text) TO anon, authenticated;

-- First snapshot now (decision 2), then every Monday 00:05 IST (18:35 UTC Sunday).
SELECT public.take_ranking_snapshot();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('weekly-ranking-snapshot')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-ranking-snapshot');
    PERFORM cron.schedule('weekly-ranking-snapshot', '35 18 * * 0', 'SELECT public.take_ranking_snapshot();');
  END IF;
END $$;
