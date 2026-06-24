-- ============================================================
-- site_data: Dynamic key-value store for site content
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS site_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update timestamp on edits
CREATE OR REPLACE FUNCTION update_site_data_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_data_updated_at ON site_data;
CREATE TRIGGER site_data_updated_at
  BEFORE UPDATE ON site_data
  FOR EACH ROW
  EXECUTE FUNCTION update_site_data_timestamp();

-- RLS: anyone can read, only admins can write
ALTER TABLE site_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site_data" ON site_data;
CREATE POLICY "Anyone can read site_data" ON site_data
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage site_data" ON site_data;
CREATE POLICY "Admins can manage site_data" ON site_data
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      'rajajanmejaya@gmail.com',
      'iiscbadmintonclub@gmail.com',
      'janmejayraja@iisc.ac.in',
      'raja79sharma@gmail.com'
    )
  ) WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'rajajanmejaya@gmail.com',
      'iiscbadmintonclub@gmail.com',
      'janmejayraja@iisc.ac.in',
      'raja79sharma@gmail.com'
    )
  );

-- ============================================================
-- Seed data (from your current static JSON files)
-- ============================================================

INSERT INTO site_data (key, value) VALUES
('holidays', '[
  {"date":"2026-01-26","name":"Republic Day"},
  {"date":"2026-03-19","name":"Ugadi"},
  {"date":"2026-05-28","name":"Id-ul-Zuha"},
  {"date":"2026-08-15","name":"Independence Day"},
  {"date":"2026-08-28","name":"Varamahalakshmi Festival"},
  {"date":"2026-09-14","name":"Ganesha Chaturthi"},
  {"date":"2026-10-02","name":"Gandhi Jayanti"},
  {"date":"2026-10-20","name":"Dussehra"},
  {"date":"2026-11-09","name":"Diwali"},
  {"date":"2026-12-25","name":"Christmas"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO site_data (key, value) VALUES
('announcements', '{
  "recent": [
    {
      "title": "INVICTA Open Tournament",
      "date": "2026-05-19",
      "startDate": "2026-06-01",
      "endDate": "2026-06-30",
      "category": "tournament",
      "priority": "high",
      "location": "IISc Badminton Hall",
      "content": "Get ready for the badminton showdown! <strong>INVICTA Open Tournament</strong> is tentatively scheduled from <strong>1st June to 21st June</strong>.<br><br>Registrations are Closed !! <a href=''/invicta'' style=''color:#10b981;font-weight:bold;text-decoration:underline;''>Click here to register.</a> Open to all IISc members."
    },
    {
      "title": "Farewell Badminton Match 🏸",
      "date": "2026-05-05",
      "category": "event",
      "priority": "high",
      "location": "IISc Badminton Hall",
      "content": "The Farewell Badminton Tournament has concluded and the official results are now available.<br><br>🏆 MS: Jalaj (RBCCPS)<br>🏆 MD: Kaling Danggen (CES) & Raja Janmejay (AE)<br>🏆 WS: Radhika Dutt (CES)<br>🏆 XD: Radhika Dutt (CES) & Kaling Danggen (CES)"
    },
    {
      "title": "Court Booked for RBCCPS Intra-department Tournament",
      "date": "2026-05-02",
      "startDate": "2026-05-02",
      "endDate": "2026-05-03",
      "category": "facility",
      "priority": "high",
      "location": "Court C3",
      "contact": "RBCCPS Coordinator",
      "content": "Court C3 is reserved for the RBCCPS Intra-department Tournament.<br><br><strong>📅 Saturday, 2 May 2026</strong><br>⏰ 1:30 PM – 5:30 PM<br><br><strong>📅 Sunday, 3 May 2026</strong><br>⏰ 9:30 AM – 1:30 PM"
    },
    {
      "title": "Spectrum 2026 Tournament",
      "date": "2026-04-12",
      "category": "tournament",
      "priority": "high",
      "location": "IISc Badminton Hall",
      "content": "Spectrum 2026 has successfully concluded. Thanks to all participants and organizers for making it a great event!"
    },
    {
      "title": "Court Maintenance Notice",
      "date": "2026-04-03",
      "category": "facility",
      "priority": "medium",
      "location": "All Courts",
      "content": "All courts will remain closed from <strong>3 April 2026 (9 AM)</strong> to <strong>4 April 2026 (12 PM)</strong> for maintenance."
    }
  ]
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO site_data (key, value) VALUES
('events', '[]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO site_data (key, value) VALUES
('videos', '[
  {"id":"v1","title":"Radhika and Kaling vs Tanisha and Aneesh || XD Finals","videoId":"h7rF4ZoDOXo","category":"Farewell Matches 2026"},
  {"id":"v2","title":"Radhika vs Tanisha || WS Finals","videoId":"_ohHNia6D80","category":"Farewell Matches 2026"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
