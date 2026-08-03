CREATE OR REPLACE VIEW search_players_view AS
WITH player_status AS (
  SELECT 
    p.id,
    EXISTS (
      SELECT 1 FROM matches m 
      WHERE m.status = 'confirmed' 
      AND (m.player1_id = p.id OR m.player2_id = p.id OR m.team1_partner_id = p.id OR m.team2_partner_id = p.id)
    ) as has_played
  FROM players p
)
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  p.department,
  CASE 
    WHEN ps.has_played THEN 
      RANK() OVER (PARTITION BY ps.has_played ORDER BY COALESCE(p.elo_rating, 1200) DESC)
    ELSE NULL
  END as overall_rank
FROM players p
JOIN player_status ps ON p.id = ps.id
WHERE p.deleted_at IS NULL AND p.is_guest = false;
