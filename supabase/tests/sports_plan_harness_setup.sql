\set ON_ERROR_STOP on
-- Extra base schema for the sports-site plan migrations (point logs, ranking
-- snapshots), on top of result_revision_bootstrap.sql. Isolated harness only.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS elo_rating numeric,
  ADD COLUMN IF NOT EXISTS singles_elo numeric,
  ADD COLUMN IF NOT EXISTS doubles_elo numeric,
  ADD COLUMN IF NOT EXISTS mixed_elo numeric,
  ADD COLUMN IF NOT EXISTS win_loss_record text,
  ADD COLUMN IF NOT EXISTS singles_record text,
  ADD COLUMN IF NOT EXISTS doubles_record text,
  ADD COLUMN IF NOT EXISTS mixed_record text;

CREATE TABLE IF NOT EXISTS public.site_data (
  key text PRIMARY KEY,
  value jsonb
);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.tournament_matches, public.players TO anon, authenticated;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS harness_read_matches ON public.tournament_matches;
CREATE POLICY harness_read_matches ON public.tournament_matches FOR SELECT USING (true);
