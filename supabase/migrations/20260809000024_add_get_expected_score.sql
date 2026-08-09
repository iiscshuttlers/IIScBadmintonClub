-- Add missing get_expected_score helper function

CREATE OR REPLACE FUNCTION get_expected_score(p_team_elo NUMERIC, p_opponent_elo NUMERIC) RETURNS NUMERIC AS $$
BEGIN
  RETURN 1.0 / (1.0 + POWER(10.0, (p_opponent_elo - p_team_elo) / 400.0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
