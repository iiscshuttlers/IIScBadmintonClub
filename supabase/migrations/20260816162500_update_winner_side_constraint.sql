-- Update winner_side check constraint to allow 0 (Double Walkover)

ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_winner_side_check;
ALTER TABLE tournament_matches ADD CONSTRAINT tournament_matches_winner_side_check CHECK (winner_side = ANY (ARRAY[0, 1, 2]));
