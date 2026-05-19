-- 1. Drop existing tables if they exist to reset clean structure
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;

-- 2. Create the players table with TEXT id to support '1', '2', or custom SEO slugs!
CREATE TABLE players (
  id TEXT PRIMARY KEY, -- Changed from UUID to TEXT for slug & numeric compatibility!
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

-- 4. Create matches table (referencing TEXT id for players)
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  round TEXT NOT NULL,
  player1_id TEXT REFERENCES players(id),
  player2_id TEXT REFERENCES players(id),
  winner_id TEXT REFERENCES players(id),
  score TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- 6. Setup policies for public read access
CREATE POLICY "Allow public read access to players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read access to tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Allow public read access to matches" ON matches FOR SELECT USING (true);

-- 7. Insert the personal seed profile as ID '1'!
INSERT INTO players (
  id, full_name, nickname, avatar_url, department, joined_year, 
  playing_level, dominant_hand, playing_style, favorite_shot, 
  favorite_idol, quote, current_racket, nationality, home_state, 
  height, years_playing, coach, bio, current_ranking, highest_ranking, 
  shoes, apparel, instagram, email, racket_details, tournament_history, 
  achievements, stats, recent_form, recent_matches, frequent_partners, career_highlights, win_loss_record
) VALUES (
  '1', -- This now works perfectly because player ID is TEXT!
  'Raja Janmejay',
  'Jordan',
  'https://i.pravatar.cc/300?u=janmejay',
  'Aerospace Engineering',
  2022,
  'Advanced',
  'Right-handed',
  'Aggressive',
  'Net Cross Drop',
  'Viktor Axelsen',
  'Enjoying the Game is best strategy',
  'Apacs Finapi 232 Reborn',
  'Indian',
  'Bihar',
  '175 cm',
  8,
  'Self-coached',
  'PhD researcher at IISc Bengaluru. Started playing in 2018 — known for aggressive net play and quick reflexes at the front court.',
  3,
  2,
  'Yonex Power Cushion 65 Z3',
  'Yonex',
  '@raja_janmejay',
  'janmejay@iisc.ac.in',
  '[{"name": "Apacs Finapi 232 Reborn", "string": "Victor VBS66 Nano", "tension": "28 lbs"}]'::jsonb,
  ARRAY['Farewell 2026', 'BPL 2026', 'Spectrum 2026'],
  ARRAY['Men''s Doubles Winner - Farewell 2026'],
  '{"totalMatches": 30, "wins": 24, "losses": 6, "winPercentage": 80, "titlesWon": 2, "runnerUp": 1, "semifinals": 1, "currentStreak": "W4", "longestWinStreak": 8, "categoryStats": {"singles": {"wins": 8, "losses": 3}, "doubles": {"wins": 12, "losses": 2}, "mixed": {"wins": 4, "losses": 1}}}'::jsonb,
  ARRAY['W', 'W', 'L', 'W', 'W'],
  '[{"date": "2026-03-15", "tournament": "Farewell 2026", "category": "Men''s Doubles", "round": "Final", "opponent": "A. Kumar / R. Sharma", "partner": "Suresh K.", "score": "21-18, 19-21, 21-15", "result": "W"}]'::jsonb,
  '[{"name": "Suresh Kumar", "id": "5", "matchesTogether": 12, "winRate": 75}]'::jsonb,
  '[{"year": 2026, "title": "Farewell 2026 Champion", "description": "Won Men''s Doubles title"}, {"year": 2025, "title": "Mixed Doubles Winner", "description": "Open Tournament 2025"}]'::jsonb,
  '24W - 6L'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  nickname = EXCLUDED.nickname,
  avatar_url = EXCLUDED.avatar_url,
  department = EXCLUDED.department,
  joined_year = EXCLUDED.joined_year,
  playing_level = EXCLUDED.playing_level,
  dominant_hand = EXCLUDED.dominant_hand,
  playing_style = EXCLUDED.playing_style,
  favorite_shot = EXCLUDED.favorite_shot,
  favorite_idol = EXCLUDED.favorite_idol,
  quote = EXCLUDED.quote,
  current_racket = EXCLUDED.current_racket,
  nationality = EXCLUDED.nationality,
  home_state = EXCLUDED.home_state,
  height = EXCLUDED.height,
  years_playing = EXCLUDED.years_playing,
  coach = EXCLUDED.coach,
  bio = EXCLUDED.bio,
  current_ranking = EXCLUDED.current_ranking,
  highest_ranking = EXCLUDED.highest_ranking,
  shoes = EXCLUDED.shoes,
  apparel = EXCLUDED.apparel,
  instagram = EXCLUDED.instagram,
  email = EXCLUDED.email,
  racket_details = EXCLUDED.racket_details,
  tournament_history = EXCLUDED.tournament_history,
  achievements = EXCLUDED.achievements,
  stats = EXCLUDED.stats,
  recent_form = EXCLUDED.recent_form,
  recent_matches = EXCLUDED.recent_matches,
  frequent_partners = EXCLUDED.frequent_partners,
  career_highlights = EXCLUDED.career_highlights,
  win_loss_record = EXCLUDED.win_loss_record;
