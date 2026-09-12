
-- Update search_players_view to match frontend ranking logic (elo != 1200)

CREATE OR REPLACE VIEW search_players_view WITH (security_invoker = on) AS
WITH ranked_players AS (
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.department,
    (p.elo_rating IS NOT NULL AND p.elo_rating != 1200) as is_ranked,
    p.elo_rating
  FROM players p
  WHERE p.deleted_at IS NULL AND p.is_guest = false
)
SELECT 
  r.id,
  r.full_name,
  r.avatar_url,
  r.department,
  CASE 
    WHEN r.is_ranked THEN 
      RANK() OVER (PARTITION BY r.is_ranked ORDER BY r.elo_rating DESC)
    ELSE NULL
  END as overall_rank
FROM ranked_players r;
