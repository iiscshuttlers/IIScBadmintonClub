-- Migration for Live Court Assignments
CREATE TABLE IF NOT EXISTS club_courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'occupied', 'maintenance')),
  current_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(court_number)
);

ALTER TABLE club_courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read courts" ON club_courts;
CREATE POLICY "Anyone can read courts" ON club_courts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can update courts" ON club_courts;
CREATE POLICY "Auth users can update courts" ON club_courts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can insert courts" ON club_courts;
CREATE POLICY "Auth users can insert courts" ON club_courts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Seed some default courts for the club
INSERT INTO club_courts (court_number, status) VALUES 
(1, 'open'),
(2, 'open'),
(3, 'open'),
(4, 'open')
ON CONFLICT (court_number) DO NOTHING;
