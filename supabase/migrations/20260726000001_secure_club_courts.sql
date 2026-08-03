-- Secure Club Courts Table (Strict RBAC)

CREATE TABLE IF NOT EXISTS club_courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'occupied', 'maintenance')),
  current_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(court_number)
);

ALTER TABLE club_courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Umpires can update courts" ON club_courts;
CREATE POLICY "Admins and Umpires can update courts" ON club_courts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire'))
  );

DROP POLICY IF EXISTS "Admins and Umpires can insert courts" ON club_courts;
CREATE POLICY "Admins and Umpires can insert courts" ON club_courts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire'))
  );
