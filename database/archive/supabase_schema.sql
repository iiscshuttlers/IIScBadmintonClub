-- ============================================================
-- IISc Badminton Club — Full Schema + Seed Data
-- Run this FIRST in Supabase SQL Editor, then run supabase_auth.sql
-- ============================================================

-- 1. Drop existing tables if they exist to reset clean structure
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;

-- 2. Create the players table
CREATE TABLE players (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  department TEXT,
  joined_year INTEGER,
  playing_level TEXT,
  dominant_hand TEXT,
  playing_style TEXT,
  favorite_shot TEXT,
  favorite_idol TEXT,
  quote TEXT,
  current_racket TEXT,
  nationality TEXT,
  home_state TEXT,
  height TEXT,
  years_playing INTEGER,
  coach TEXT,
  bio TEXT,
  current_ranking INTEGER,
  highest_ranking INTEGER,
  shoes TEXT,
  apparel TEXT,
  instagram TEXT,
  email TEXT,
  racket_details JSONB,
  tournament_history TEXT[],
  achievements TEXT[],
  stats JSONB,
  recent_form TEXT[],
  recent_matches JSONB,
  frequent_partners JSONB,
  career_highlights JSONB,
  win_loss_record TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create tournaments table
CREATE TABLE tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create matches table
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  round TEXT NOT NULL,
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  team1_partner_id UUID REFERENCES players(id),
  team2_partner_id UUID REFERENCES players(id),
  winner_id UUID REFERENCES players(id),
  score TEXT NOT NULL,
  date DATE NOT NULL,
  is_friendly BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'confirmed',
  submitted_by UUID REFERENCES players(id),
  elo_change_p1 INTEGER,
  elo_change_p2 INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Allow public read access to players"     ON players     FOR SELECT USING (true);
CREATE POLICY "Allow public read access to tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Allow public read access to matches"     ON matches     FOR SELECT USING (status IS DISTINCT FROM 'pending');
CREATE POLICY "Players can read their pending matches"  ON matches     FOR SELECT USING (
  status = 'pending'
  AND auth.uid() IN (player1_id, player2_id, team1_partner_id, team2_partner_id)
);
CREATE POLICY "Users can create their own profile"      ON players     FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"      ON players     FOR UPDATE USING (auth.uid() = id);

-- 7. Unique email constraint
ALTER TABLE players ADD CONSTRAINT players_email_key UNIQUE (email);


