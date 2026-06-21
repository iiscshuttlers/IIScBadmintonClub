-- Doubles matches now require 3 players to agree before they confirm.
-- The submitter implicitly agrees (they entered the score), so a doubles match
-- confirms once 2 of the other 3 players accept. Singles are unchanged
-- (submitter + the single opponent = 2 agreeing players).
--
-- Implementation note: we DO NOT modify confirm_friendly_match (the ELO routine).
-- accept_friendly_match records each acceptance and, only once quorum is reached,
-- calls confirm_friendly_match with the umpire bypass to finalize + apply ELO.
-- This keeps all the existing ELO logic untouched.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS confirmed_by TEXT[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION accept_friendly_match(
  match_uuid UUID,
  confirmer_id UUID
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
  is_doubles BOOLEAN;
  required INTEGER;
  new_confirmed TEXT[];
  agreed INTEGER;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;

  -- Must be a participant in the match
  IF confirmer_id IS DISTINCT FROM m_record.player1_id
     AND confirmer_id IS DISTINCT FROM m_record.player2_id
     AND confirmer_id IS DISTINCT FROM m_record.team1_partner_id
     AND confirmer_id IS DISTINCT FROM m_record.team2_partner_id THEN
    RAISE EXCEPTION 'You were not a part of this match.';
  END IF;

  -- The submitter already implicitly agrees with the score they entered
  IF confirmer_id = m_record.submitted_by THEN
    RAISE EXCEPTION 'You submitted this match, so you have already agreed to the score.';
  END IF;

  -- Idempotent: a player can only accept once
  IF m_record.confirmed_by @> ARRAY[confirmer_id::text] THEN
    RAISE EXCEPTION 'You have already accepted this match.';
  END IF;

  new_confirmed := array_append(COALESCE(m_record.confirmed_by, '{}'), confirmer_id::text);

  is_doubles := m_record.team1_partner_id IS NOT NULL OR m_record.team2_partner_id IS NOT NULL;
  required := CASE WHEN is_doubles THEN 3 ELSE 2 END;

  -- submitter (1) + everyone who has now accepted
  agreed := 1 + COALESCE(array_length(new_confirmed, 1), 0);

  UPDATE matches SET confirmed_by = new_confirmed WHERE id = match_uuid;

  IF agreed >= required THEN
    -- Quorum reached -> finalize through the existing ELO routine.
    -- 'umpire_bypass' skips the per-player auth check; status is still 'pending' here.
    RETURN confirm_friendly_match(match_uuid, 'umpire_bypass')
           || jsonb_build_object('confirmed', true, 'accepted', agreed, 'required', required);
  END IF;

  RETURN jsonb_build_object('confirmed', false, 'accepted', agreed, 'required', required);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_friendly_match(UUID, UUID) TO authenticated;
