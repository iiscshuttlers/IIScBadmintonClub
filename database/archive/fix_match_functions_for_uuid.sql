-- ============================================================
-- Fix Match Functions and Triggers for UUID Migration
-- ============================================================

-- 1. Fix trigger for new matches (fixes "column p.user_id does not exist" and "uuid = text" errors)
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
    SELECT p.id, notif_title, notif_message, 'match_logged', '/feed/my-matches', false
    FROM public.players p
    WHERE p.id = recipient;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Fix confirm_friendly_match to accept UUID and avoid UUID = TEXT errors
DROP FUNCTION IF EXISTS confirm_friendly_match(UUID, TEXT);
CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id UUID
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
  p1_elo INTEGER;
  p2_elo INTEGER;
  p1_matches INTEGER;
  p2_matches INTEGER;
  p1_expected NUMERIC;
  p2_expected NUMERIC;
  p1_actual NUMERIC;
  p2_actual NUMERIC;
  k_p1 INTEGER;
  k_p2 INTEGER;
  new_p1_elo INTEGER;
  new_p2_elo INTEGER;
  change_p1 INTEGER;
  change_p2 INTEGER;
BEGIN
  -- Fetch the match
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF m_record.status != 'pending' THEN
    RAISE EXCEPTION 'Match is already %', m_record.status;
  END IF;

  -- Ensure the confirmer is the OTHER player (not the submitter)
  IF confirmer_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
  END IF;
  
  IF confirmer_id IS DISTINCT FROM m_record.player1_id
    AND confirmer_id IS DISTINCT FROM m_record.player2_id
    AND confirmer_id IS DISTINCT FROM m_record.team1_partner_id
    AND confirmer_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  -- Get current Elo ratings
  SELECT elo_rating, total_friendly_matches INTO p1_elo, p1_matches FROM players WHERE id = m_record.player1_id;
  SELECT elo_rating, total_friendly_matches INTO p2_elo, p2_matches FROM players WHERE id = m_record.player2_id;

  -- Dynamic K-Factor
  k_p1 := CASE WHEN p1_matches < 10 THEN 40 ELSE 20 END;
  k_p2 := CASE WHEN p2_matches < 10 THEN 40 ELSE 20 END;

  -- Elo Expected Score
  p1_expected := 1.0 / (1.0 + power(10.0, (p2_elo - p1_elo) / 400.0));
  p2_expected := 1.0 / (1.0 + power(10.0, (p1_elo - p2_elo) / 400.0));

  -- Actual Score
  p1_actual := CASE WHEN m_record.winner_id = m_record.player1_id THEN 1.0 ELSE 0.0 END;
  p2_actual := CASE WHEN m_record.winner_id = m_record.player2_id THEN 1.0 ELSE 0.0 END;

  -- Calculate new Elo ratings
  new_p1_elo := round(p1_elo + k_p1 * (p1_actual - p1_expected));
  new_p2_elo := round(p2_elo + k_p2 * (p2_actual - p2_expected));
  
  change_p1 := new_p1_elo - p1_elo;
  change_p2 := new_p2_elo - p2_elo;

  -- Update Players
  UPDATE players SET elo_rating = new_p1_elo, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player1_id;
  UPDATE players SET elo_rating = new_p2_elo, total_friendly_matches = total_friendly_matches + 1 WHERE id = m_record.player2_id;

  -- Update Match Record
  UPDATE matches SET 
    status = 'confirmed', 
    elo_change_p1 = change_p1, 
    elo_change_p2 = change_p2 
  WHERE id = match_uuid;

  -- Recalculate win_loss_record for player 1
  WITH p1_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE winner_id = m_record.player1_id) as wins,
      COUNT(*) FILTER (WHERE winner_id != m_record.player1_id) as losses
    FROM matches 
    WHERE status = 'confirmed' AND (player1_id = m_record.player1_id OR player2_id = m_record.player1_id OR team1_partner_id = m_record.player1_id OR team2_partner_id = m_record.player1_id)
  )
  UPDATE players 
  SET win_loss_record = (SELECT wins FROM p1_stats) || 'W - ' || (SELECT losses FROM p1_stats) || 'L'
  WHERE id = m_record.player1_id;

  -- Recalculate win_loss_record for player 2
  WITH p2_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE winner_id = m_record.player2_id) as wins,
      COUNT(*) FILTER (WHERE winner_id != m_record.player2_id) as losses
    FROM matches 
    WHERE status = 'confirmed' AND (player1_id = m_record.player2_id OR player2_id = m_record.player2_id OR team1_partner_id = m_record.player2_id OR team2_partner_id = m_record.player2_id)
  )
  UPDATE players 
  SET win_loss_record = (SELECT wins FROM p2_stats) || 'W - ' || (SELECT losses FROM p2_stats) || 'L'
  WHERE id = m_record.player2_id;

  RETURN jsonb_build_object(
    'p1_elo_change', change_p1,
    'p2_elo_change', change_p2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Fix reject_friendly_match to accept UUID
DROP FUNCTION IF EXISTS reject_friendly_match(UUID, TEXT);
CREATE OR REPLACE FUNCTION reject_friendly_match(
  match_uuid UUID, 
  rejecter_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  m_record RECORD;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF rejecter_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You cannot reject your own submission.';
  END IF;
  
  IF rejecter_id IS DISTINCT FROM m_record.player1_id
    AND rejecter_id IS DISTINCT FROM m_record.player2_id
    AND rejecter_id IS DISTINCT FROM m_record.team1_partner_id
    AND rejecter_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  UPDATE matches SET status = 'rejected' WHERE id = match_uuid;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
