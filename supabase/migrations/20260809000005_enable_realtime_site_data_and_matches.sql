-- Enable Supabase Realtime for site_data, matches, and tournament_matches tables
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'site_data'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE site_data;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_matches'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE tournament_matches;
    END IF;
  END
  $$;
COMMIT;
