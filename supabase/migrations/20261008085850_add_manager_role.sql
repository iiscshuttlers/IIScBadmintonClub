ALTER TABLE tournament_team_members DROP CONSTRAINT IF EXISTS tournament_team_members_role_check;
ALTER TABLE tournament_team_members ADD CONSTRAINT tournament_team_members_role_check CHECK (role IN ('CAPTAIN', 'VICE_CAPTAIN', 'MANAGER', 'PLAYER'));
