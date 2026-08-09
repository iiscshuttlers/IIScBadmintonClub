-- Restore real player names for tournament matches where label was mistakenly set to BYE
UPDATE tournament_matches tm
SET team1_label = p.full_name
FROM players p
WHERE tm.player1_id = p.id
  AND (tm.team1_label = 'BYE' OR tm.team1_label ILIKE '%BYE%');

UPDATE tournament_matches tm
SET team2_label = p.full_name
FROM players p
WHERE tm.player2_id = p.id
  AND (tm.team2_label = 'BYE' OR tm.team2_label ILIKE '%BYE%');
