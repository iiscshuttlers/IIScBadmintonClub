-- Update MD Round 1 and Round 2 to be 30-point, 1-set games
UPDATE public.tournament_matches
SET points_to_win = 30, best_of_sets = 1, golden_point = 30
WHERE tournament_id = '62c5341c-df12-4511-9253-a9a0e9546667'
  AND category = 'MD'
  AND round IN (1, 2);
