-- Reset MD_QF_02 back to scheduled so it can be played/scored correctly
UPDATE tournament_matches
SET 
  status = 'scheduled',
  winner_side = null,
  winner_id = null,
  score = '',
  sets_history = '{}',
  ended_at = null,
  locked = false
WHERE match_code = 'MD_QF_02';

-- Recalculate ELO to remove the phantom win
SELECT recalculate_all_elo();
