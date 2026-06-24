-- Performance Optimization: Adding appropriate indexes to speed up queries
-- These indexes target the most common query patterns for matches and players

-- Indexes for 'matches' table foreign keys and commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_matches_player1_id ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2_id ON matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_team1_partner_id ON matches(team1_partner_id);
CREATE INDEX IF NOT EXISTS idx_matches_team2_partner_id ON matches(team2_partner_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_is_friendly ON matches(is_friendly);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date DESC);

-- Indexes for 'players' table
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_full_name ON players(full_name);

-- Index for 'elo_calculation_logs' table (useful for analytics if needed)
CREATE INDEX IF NOT EXISTS idx_elo_logs_match_uuid ON elo_calculation_logs(match_uuid);
CREATE INDEX IF NOT EXISTS idx_elo_logs_player_id ON elo_calculation_logs(player_id);
