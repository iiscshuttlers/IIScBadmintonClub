-- Run this in Supabase SQL Editor to add category-specific win/loss records

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS singles_record TEXT DEFAULT '0W - 0L',
ADD COLUMN IF NOT EXISTS doubles_record TEXT DEFAULT '0W - 0L',
ADD COLUMN IF NOT EXISTS mixed_record TEXT DEFAULT '0W - 0L';

-- Populate existing singles records (since all previous matches were singles)
UPDATE players p
SET singles_record = (
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
      AND m.category = 'Singles'
      AND (m.player1_id = p.id OR m.player2_id = p.id OR m.team1_partner_id = p.id OR m.team2_partner_id = p.id)
  )
  SELECT COALESCE(wins, 0) || 'W - ' || COALESCE(losses, 0) || 'L' FROM p_stats
)
WHERE p.deleted_at IS NULL;

-- Keep doubles and mixed records at default since none exist yet.
