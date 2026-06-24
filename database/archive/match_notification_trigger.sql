-- Trigger: auto-create in-app notifications on every match INSERT
-- Fires server-side, works regardless of client connectivity (gym mode, offline sync, etc.)

CREATE OR REPLACE FUNCTION notify_players_on_match_insert()
RETURNS TRIGGER AS $$
DECLARE
  submitter_name TEXT;
  is_friendly    BOOLEAN;
  notif_title    TEXT;
  notif_message  TEXT;
  recipient      TEXT;
  recipients     TEXT[];
BEGIN
  -- Look up submitter name
  SELECT full_name INTO submitter_name
  FROM public.players
  WHERE id = NEW.submitted_by;

  submitter_name := COALESCE(submitter_name, 'Someone');
  is_friendly    := COALESCE(NEW.is_friendly, true);

  notif_title   := CASE WHEN is_friendly THEN '🏸 Friendly Match Logged' ELSE '🏸 Tournament Match Logged' END;
  notif_message := submitter_name || ' logged a '
                   || CASE WHEN is_friendly THEN 'friendly' ELSE 'tournament' END
                   || ' match against you. Tap to confirm.';

  -- Collect all involved player IDs except the submitter
  recipients := ARRAY(
    SELECT DISTINCT pid
    FROM unnest(ARRAY[
      NEW.player1_id,
      NEW.player2_id,
      NEW.team1_partner_id,
      NEW.team2_partner_id
    ]) AS pid
    WHERE pid IS NOT NULL
      AND pid <> NEW.submitted_by
  );

  -- Insert one notification per recipient
  FOREACH recipient IN ARRAY recipients LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link, is_read)
    SELECT p.id, notif_title, notif_message, 'match_logged', '/feed/my-matches', false
    FROM public.players p
    WHERE p.id = recipient;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_match_insert_notify ON public.matches;
CREATE TRIGGER on_match_insert_notify
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_players_on_match_insert();
