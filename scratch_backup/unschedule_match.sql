UPDATE public.tournament_matches
SET status = 'pending', scheduled_at = NULL, court_number = NULL
WHERE match_code = 'MS_R4_01' AND tournament_id = '62c5341c-df12-4511-9253-a9a0e9546667';
