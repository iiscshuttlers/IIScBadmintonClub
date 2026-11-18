-- Live definitions of the Elo helper functions, read from the hosted project on 14 Nov 2026 (read-only),
-- used as fixtures by elo_replay_check.sql. Do not apply to any database except a test harness.

CREATE OR REPLACE FUNCTION public.calculate_overall_elo(p_singles_elo integer, p_singles_matches integer, p_doubles_elo integer, p_doubles_matches integer, p_mixed_elo integer, p_mixed_matches integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN ROUND((COALESCE(p_singles_elo, 1200) + COALESCE(p_doubles_elo, 1200) + COALESCE(p_mixed_elo, 1200)) / 3.0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_k_factor(p_matches integer, p_config jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_prov_thresh INTEGER := COALESCE((p_config->>'provisional_threshold')::INTEGER, 10);
  v_vet_thresh  INTEGER := COALESCE((p_config->>'veteran_threshold')::INTEGER, 30);
BEGIN
  IF p_matches < v_prov_thresh THEN RETURN COALESCE((p_config->>'k_factor_provisional')::NUMERIC, 40.0); END IF;
  IF p_matches > v_vet_thresh THEN RETURN COALESCE((p_config->>'k_factor_veteran')::NUMERIC, 24.0); END IF;
  RETURN COALESCE((p_config->>'k_factor_established')::NUMERIC, 32.0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_match_dominance(p_sets text[])
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_set_multiplier(p_sets text[])
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
$function$;

