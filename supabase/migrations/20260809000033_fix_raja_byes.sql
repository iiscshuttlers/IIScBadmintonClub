-- Fix MD_R1_03 to mark Raja (Side 1) as winner instead of BYE (Side 2)
UPDATE tournament_matches
SET winner_side = 1, winner_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b'
WHERE match_code = 'MD_R1_03';

-- Advance Raja to the next round in Men's Doubles
UPDATE tournament_matches
SET player1_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b'
WHERE match_code = 'MD_QF_02';

-- Fix XD_R1_11 to mark Raja (Side 1) as winner instead of BYE (Side 2)
UPDATE tournament_matches
SET winner_side = 1, winner_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b'
WHERE match_code = 'XD_R1_11';

-- Advance Raja to the next round in Mixed Doubles
UPDATE tournament_matches
SET player1_id = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b'
WHERE match_code = 'XD_R2_06';

-- Recalculate all ELOs and player stats based on the corrected matches
SELECT recalculate_all_elo();
