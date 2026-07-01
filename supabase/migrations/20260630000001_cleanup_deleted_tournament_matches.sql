-- 1. Delete all matches that belong to tournaments that have been soft-deleted
DELETE FROM tournament_matches 
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE status = 'deleted'
);

-- 2. Add a trigger to automatically delete matches when a tournament is soft-deleted in the future
CREATE OR REPLACE FUNCTION handle_deleted_tournament()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'deleted' AND OLD.status != 'deleted' THEN
    DELETE FROM tournament_matches WHERE tournament_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_deleted_tournament ON tournaments;

CREATE TRIGGER trg_handle_deleted_tournament
AFTER UPDATE OF status ON tournaments
FOR EACH ROW
EXECUTE FUNCTION handle_deleted_tournament();