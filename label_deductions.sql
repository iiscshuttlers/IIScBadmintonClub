BEGIN;

UPDATE tournament_matches SET player3_id = '7111852d-627a-4159-9b5e-3bca63ed9666' WHERE id = '759628b8-9933-456e-9150-9977311a74a3';
UPDATE tournament_matches SET player4_id = 'd4fd7cb0-a910-4d9f-8f50-e9123748de85' WHERE id = 'f140bd03-1837-42c5-bf7e-24d5ce18b6a0';
UPDATE tournament_matches SET player4_id = 'd4fd7cb0-a910-4d9f-8f50-e9123748de85' WHERE id = 'efc8f8f6-171a-4806-835d-85f3d0289f96';
UPDATE tournament_matches SET player3_id = '7111852d-627a-4159-9b5e-3bca63ed9666' WHERE id = '48ac1b3e-779b-4b37-8556-108d6cb0c633';
UPDATE tournament_matches SET player3_id = '4a48582c-b3dd-491c-a792-c99ac8a6408b' WHERE id = '08a72c95-282a-4158-a6eb-9ba82ef6b3b8';
UPDATE tournament_matches SET player3_id = '196ba895-83b6-4f69-9957-755ad6406707' WHERE id = '1399e350-096a-4756-ba13-9daac4c71dad';
UPDATE tournament_matches SET player3_id = 'a4a8b2cd-781f-40d9-91f0-534a70f5335a' WHERE id = '59c7fc1d-eba2-46cc-befb-2cb988cd7c80';
UPDATE tournament_matches SET player3_id = '4a48582c-b3dd-491c-a792-c99ac8a6408b' WHERE id = 'f91665dd-ddea-41b1-ab8b-d27b1ea3faee';

-- Recalculate stats
SELECT recalculate_player_all_records('7111852d-627a-4159-9b5e-3bca63ed9666');
SELECT recalculate_player_all_records('d4fd7cb0-a910-4d9f-8f50-e9123748de85');
SELECT recalculate_player_all_records('4a48582c-b3dd-491c-a792-c99ac8a6408b');
SELECT recalculate_player_all_records('196ba895-83b6-4f69-9957-755ad6406707');
SELECT recalculate_player_all_records('a4a8b2cd-781f-40d9-91f0-534a70f5335a');
COMMIT;
