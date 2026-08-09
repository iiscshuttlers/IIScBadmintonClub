-- 1. Update get_match_dominance to include strict validation
CREATE OR REPLACE FUNCTION get_match_dominance(p_sets TEXT[]) RETURNS NUMERIC AS $$
DECLARE
  set_str TEXT;
  scores TEXT[];
  score1 INTEGER;
  score2 INTEGER;
  margin INTEGER;
  avg_margin NUMERIC;
  total_margin INTEGER := 0;
  valid_sets INTEGER := 0;
BEGIN
  IF p_sets IS NULL OR array_length(p_sets, 1) = 0 THEN
    RETURN 1.0;
  END IF;

  FOREACH set_str IN ARRAY p_sets LOOP
    -- Validation: must match digits-digits
    IF set_str ~ '^\d+-\d+$' THEN
      scores := string_to_array(set_str, '-');
      BEGIN
        score1 := scores[1]::INTEGER;
        score2 := scores[2]::INTEGER;
        margin := abs(score1 - score2);
        total_margin := total_margin + margin;
        valid_sets := valid_sets + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Ignore parsing errors
      END;
    END IF;
  END LOOP;

  IF valid_sets = 0 THEN
    RETURN 1.0;
  END IF;

  avg_margin := total_margin::NUMERIC / valid_sets;

  IF avg_margin >= 10 THEN
    RETURN 1.15; -- Domination (e.g., 21-11 or worse)
  ELSIF avg_margin >= 6 THEN
    RETURN 1.05; -- Solid win (e.g., 21-15)
  ELSIF avg_margin <= 3 THEN
    RETURN 0.90; -- Grind/close match (e.g., 21-19, 21-18)
  ELSE
    RETURN 1.0;  -- Standard win (e.g., 21-17)
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update confirm_friendly_match to NOT update ELO
CREATE OR REPLACE FUNCTION confirm_friendly_match(
  match_uuid UUID, 
  confirmer_id TEXT
) RETURNS JSONB AS $$
DECLARE
  m_record RECORD;
BEGIN
  SELECT * INTO m_record FROM matches WHERE id = match_uuid;
  
  IF m_record IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m_record.status != 'pending' THEN RAISE EXCEPTION 'Match is already %', m_record.status; END IF;
  
  -- Validation checks unless umpire_bypass is passed or system
  IF confirmer_id IS NULL OR (confirmer_id != 'umpire_bypass' AND confirmer_id != 'system') THEN
    IF (confirmer_id::uuid) = m_record.submitted_by THEN
      RAISE EXCEPTION 'You cannot confirm a match you submitted yourself to prevent fraud.';
    END IF;
    
    IF (confirmer_id::uuid) IS DISTINCT FROM m_record.player1_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.player2_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team1_partner_id
      AND (confirmer_id::uuid) IS DISTINCT FROM m_record.team2_partner_id THEN
      RAISE EXCEPTION 'You were not a part of this match.';
    END IF;
  END IF;

  -- User feedback: Friendly matches DO NOT affect ELO.
  -- We just update the status to completed and return.
  
  -- Mark match as completed
  UPDATE matches 
  SET status = 'completed',
      elo_change_p1 = 0,
      elo_change_p2 = 0,
      elo_change_p3 = 0,
      elo_change_p4 = 0
  WHERE id = match_uuid;

  RETURN jsonb_build_object('success', true, 'match_id', match_uuid, 'status', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION confirm_friendly_match(UUID, TEXT) TO authenticated;
