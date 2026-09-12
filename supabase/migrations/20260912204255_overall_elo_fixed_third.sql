-- Update overall ELO calculation to a strict 1/3 fixed average across all formats
-- Defaults unplayed formats to 1200
CREATE OR REPLACE FUNCTION calculate_overall_elo(
  p_singles_elo INTEGER, p_singles_matches INTEGER,
  p_doubles_elo INTEGER, p_doubles_matches INTEGER,
  p_mixed_elo INTEGER, p_mixed_matches INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN ROUND((COALESCE(p_singles_elo, 1200) + COALESCE(p_doubles_elo, 1200) + COALESCE(p_mixed_elo, 1200)) / 3.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Immediately recalculate all ELOs to apply the new formula
SELECT recalculate_all_elo();
