-- Run this SQL in your Supabase SQL Editor to set up the database tables

-- 1. Create the players table
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create tournaments table
CREATE TABLE tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create matches table
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- e.g., Men's Singles, Mixed Doubles
  round TEXT NOT NULL, -- e.g., Final, Semi-Final
  player1_id UUID REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  winner_id UUID REFERENCES players(id), -- To easily calculate win/loss
  score TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup Row Level Security (RLS) to allow public read access
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read access to tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Allow public read access to matches" ON matches FOR SELECT USING (true);
