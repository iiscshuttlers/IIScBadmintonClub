CREATE OR REPLACE VIEW search_players_view AS
SELECT 
  id,
  full_name,
  avatar_url,
  department,
  RANK() OVER (ORDER BY COALESCE(elo_rating, 1200) DESC) as overall_rank
FROM players
WHERE deleted_at IS NULL AND is_guest = false;

-- Grant permissions so the API can read it
GRANT SELECT ON search_players_view TO anon, authenticated;
