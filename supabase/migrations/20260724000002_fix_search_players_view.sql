CREATE OR REPLACE VIEW search_players_view AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  p.department,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM matches m 
      WHERE m.status = 'confirmed' 
      AND (m.player1_id = p.id OR m.player2_id = p.id OR m.team1_partner_id = p.id OR m.team2_partner_id = p.id)
    ) THEN 
      RANK() OVER (ORDER BY COALESCE(p.elo_rating, 1200) DESC)
    ELSE NULL
  END as overall_rank
FROM players p
WHERE p.deleted_at IS NULL AND p.is_guest = false;
