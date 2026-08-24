-- 1. Update Set Multiplier (Reward 3-set matches instead of 2-set sweeps)
CREATE OR REPLACE FUNCTION get_set_multiplier(p_sets TEXT[]) RETURNS NUMERIC AS $$
DECLARE
  num_sets INTEGER;
BEGIN
  IF p_sets IS NULL OR array_length(p_sets, 1) = 0 THEN
    RETURN 1.0; -- Default
  END IF;
  num_sets := array_length(p_sets, 1);
  IF num_sets = 1 THEN RETURN 0.75; END IF;
  IF num_sets = 2 THEN RETURN 1.00; END IF; -- Neutral for straight sets
  RETURN 1.10; -- Bonus for 3-set matches
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update Match Dominance (Remove penalty for close matches)
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
    RETURN 1.00; -- Close match (no more penalty)
  ELSE
    RETURN 1.00;  -- Standard win (e.g., 21-17)
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


