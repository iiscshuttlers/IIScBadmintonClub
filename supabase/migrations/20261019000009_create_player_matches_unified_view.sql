-- Unified view combining friendly matches and tournament matches for player history
CREATE OR REPLACE VIEW public.player_matches_unified AS
SELECT
  id,
  category,
  player1_id, player2_id,
  team1_partner_id AS player3_id,
  team2_partner_id AS player4_id,
  winner_id,
  NULL::smallint AS winner_side,
  status, score, created_at,
  ended_at, NULL::timestamptz AS scheduled_at, date,
  TRUE  AS is_friendly,
  NULL::boolean AS counts_for_elo
FROM matches
WHERE status IN ('confirmed', 'pending')

UNION ALL

SELECT
  tm.id,
  tm.category,
  tm.player1_id, tm.player2_id,
  tm.player3_id, tm.player4_id,
  tm.winner_id,
  tm.winner_side,
  tm.status, tm.score, tm.created_at,
  tm.ended_at, tm.scheduled_at,
  NULL AS date,
  FALSE AS is_friendly,
  t.counts_for_elo
FROM tournament_matches tm
JOIN tournaments t ON t.id = tm.tournament_id
WHERE tm.status IN ('completed', 'scheduled', 'in_progress', 'walkover')
  AND t.status <> 'deleted';

GRANT SELECT ON public.player_matches_unified TO anon, authenticated;
