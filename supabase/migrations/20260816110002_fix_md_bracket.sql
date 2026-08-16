-- Fix for MD_R1_28 and MD_R2_14 bracket progression

UPDATE tournament_matches 
SET player1_id = NULL, winner_id = NULL, team1_label = 'Chandraprakash & Pramay' 
WHERE match_code = 'MD_R1_28';

UPDATE tournament_matches 
SET player2_id = NULL, team2_label = 'Chandraprakash & Pramay' 
WHERE match_code = 'MD_R2_14';
