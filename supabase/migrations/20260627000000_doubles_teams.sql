-- Migration for Doubles Teams

CREATE TABLE IF NOT EXISTS doubles_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player2_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('MD', 'WD', 'XD')),
    elo_rating INTEGER NOT NULL DEFAULT 1200,
    matches_played INTEGER NOT NULL DEFAULT 0,
    matches_won INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(player1_id, player2_id)
);

-- Enable RLS
ALTER TABLE doubles_teams ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can read doubles_teams" ON doubles_teams;
CREATE POLICY "Anyone can read doubles_teams" ON doubles_teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Players can create teams they are part of" ON doubles_teams;
CREATE POLICY "Players can create teams they are part of" ON doubles_teams FOR INSERT 
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);
DROP POLICY IF EXISTS "Players can update their own teams" ON doubles_teams;
CREATE POLICY "Players can update their own teams" ON doubles_teams FOR UPDATE 
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);
DROP POLICY IF EXISTS "Players can delete their own teams" ON doubles_teams;
CREATE POLICY "Players can delete their own teams" ON doubles_teams FOR DELETE 
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);
