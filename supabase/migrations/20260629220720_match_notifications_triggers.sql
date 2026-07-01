-- Trigger: auto-create in-app notifications on every match INSERT
CREATE OR REPLACE FUNCTION notify_players_on_match_insert()
RETURNS TRIGGER AS $$
DECLARE
  submitter_name TEXT;
  is_friendly    BOOLEAN;
  notif_title    TEXT;
  notif_message  TEXT;
  recipient      UUID;
  recipients     UUID[];
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
    VALUES (recipient, notif_title, notif_message, 'match_logged', '/feed/my-matches', false);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_match_insert_notify ON public.matches;
CREATE TRIGGER on_match_insert_notify
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_players_on_match_insert();


-- Trigger: auto-create in-app notifications when a match is confirmed
CREATE OR REPLACE FUNCTION notify_players_on_match_confirm()
RETURNS TRIGGER AS $$
DECLARE
  notif_title    TEXT;
  notif_message  TEXT;
  recipient      UUID;
  recipients     UUID[];
BEGIN
  -- Check if status changed from pending to confirmed
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    notif_title   := CASE WHEN NEW.is_friendly THEN '🏸 Friendly Match Accepted' ELSE '🏸 Tournament Match Accepted' END;
    notif_message := 'Your match was confirmed! ELO and Stats updated.';

    -- Collect all involved player IDs
    recipients := ARRAY(
      SELECT DISTINCT pid
      FROM unnest(ARRAY[
        NEW.player1_id,
        NEW.player2_id,
        NEW.team1_partner_id,
        NEW.team2_partner_id
      ]) AS pid
      WHERE pid IS NOT NULL
    );

    -- Insert one notification per recipient
    FOREACH recipient IN ARRAY recipients LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link, is_read)
      VALUES (recipient, notif_title, notif_message, 'match_confirmation', '/feed/my-matches', false);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_match_update_notify ON public.matches;
CREATE TRIGGER on_match_update_notify
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_players_on_match_confirm();
