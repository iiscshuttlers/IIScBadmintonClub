-- Allow tournament managers to manage teams
CREATE POLICY "Managers can insert teams" ON tournament_teams
FOR INSERT WITH CHECK (is_tournament_manager(tournament_id));

CREATE POLICY "Managers can update teams" ON tournament_teams
FOR UPDATE USING (is_tournament_manager(tournament_id));

CREATE POLICY "Managers can delete teams" ON tournament_teams
FOR DELETE USING (is_tournament_manager(tournament_id));

-- Allow tournament managers to manage team members
CREATE POLICY "Managers can insert team members" ON tournament_team_members
FOR INSERT WITH CHECK (is_tournament_manager(tournament_id));

CREATE POLICY "Managers can update team members" ON tournament_team_members
FOR UPDATE USING (is_tournament_manager(tournament_id));

CREATE POLICY "Managers can delete team members" ON tournament_team_members
FOR DELETE USING (is_tournament_manager(tournament_id));
