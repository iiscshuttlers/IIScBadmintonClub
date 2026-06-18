-- ============================================================
-- Fixes for three 400/406 errors visible in the browser console
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. live_matches: add partner1_id / partner2_id ──────────
-- The LiveScoreWidget joins players!partner1_id and players!partner2_id,
-- and StartLiveScoringButton inserts these for doubles matches.
-- Neither column existed in the original schema.

ALTER TABLE public.live_matches
  ADD COLUMN IF NOT EXISTS partner1_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner2_id UUID REFERENCES public.players(id) ON DELETE SET NULL;


-- ── 2. challenge_progress: restore UNIQUE(challenge_id, player_id) ──
-- The UUID migration renamed _player_id → player_id but never recreated
-- the unique constraint that the upsert onConflict depends on.

ALTER TABLE public.challenge_progress
  DROP CONSTRAINT IF EXISTS challenge_progress_challenge_id_player_id_key;

ALTER TABLE public.challenge_progress
  ADD CONSTRAINT challenge_progress_challenge_id_player_id_key
  UNIQUE (challenge_id, player_id);


-- ── 3. matches: ensure the public read policy exists ─────────
-- The UUID migration may have left the confirmed-matches read policy
-- missing. Recreate it idempotently so leaderboard / weekly-challenges
-- queries against confirmed matches always succeed.

DROP POLICY IF EXISTS "Allow public read access to matches" ON public.matches;

CREATE POLICY "Allow public read access to matches"
  ON public.matches FOR SELECT
  USING (status IS DISTINCT FROM 'pending');


-- ── 4. weekly_challenges: ensure insert policy exists ────────
-- WeeklyChallenges auto-creates rows for the current week; anyone
-- authenticated needs INSERT permission.

DROP POLICY IF EXISTS "Anyone authenticated can insert challenges" ON public.weekly_challenges;

CREATE POLICY "Anyone authenticated can insert challenges"
  ON public.weekly_challenges FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
