-- Fix incorrect Manthan Panwar mapping to Arul Anand & Adithya

-- 1. Fix the participant record
UPDATE public.tournament_participants
SET player_id = 'fa88880c-e465-4f18-9dc3-35585be45df3', partner_id = NULL
WHERE id = 'e9c55620-40b1-400c-9d3c-dfc2700504b6';

-- 2. Fix the players in MD_R1_07 (Team 2)
UPDATE public.tournament_matches
SET player3_id = 'fa88880c-e465-4f18-9dc3-35585be45df3', player4_id = NULL,
    winner_id = 'fa88880c-e465-4f18-9dc3-35585be45df3'
WHERE match_code = 'MD_R1_07' AND tournament_id = '62c5341c-df12-4511-9253-a9a0e9546667';

-- 3. Fix the players and label in MD_R2_04 (Team 1)
UPDATE public.tournament_matches
SET player1_id = 'fa88880c-e465-4f18-9dc3-35585be45df3', player2_id = NULL,
    team1_label = 'Arul Anand & Adithya'
WHERE match_code = 'MD_R2_04' AND tournament_id = '62c5341c-df12-4511-9253-a9a0e9546667';
