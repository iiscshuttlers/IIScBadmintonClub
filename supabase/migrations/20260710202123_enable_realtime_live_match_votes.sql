-- Add live_match_votes to supabase_realtime publication
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'live_match_votes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE live_match_votes;
    END IF;
  END
  $$;
COMMIT;
