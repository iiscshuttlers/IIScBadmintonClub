-- Run this query in Supabase SQL Editor to instantly fix all win/loss records for all players!
UPDATE players p
SET win_loss_record = (
  WITH p_stats AS (
    SELECT 
      COUNT(*) FILTER (
        WHERE ( (m.player1_id = p.id OR m.team1_partner_id = p.id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
           OR ( (m.player2_id = p.id OR m.team2_partner_id = p.id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
      ) as wins,
      COUNT(*) FILTER (
        WHERE ( (m.player1_id = p.id OR m.team1_partner_id = p.id) AND (m.winner_id = m.player2_id OR m.winner_id = m.team2_partner_id) )
           OR ( (m.player2_id = p.id OR m.team2_partner_id = p.id) AND (m.winner_id = m.player1_id OR m.winner_id = m.team1_partner_id) )
      ) as losses
    FROM matches m
    WHERE m.status = 'confirmed' 
      AND (m.player1_id = p.id OR m.player2_id = p.id OR m.team1_partner_id = p.id OR m.team2_partner_id = p.id)
  )
  SELECT COALESCE(wins, 0) || 'W - ' || COALESCE(losses, 0) || 'L' FROM p_stats
)
WHERE p.deleted_at IS NULL;
