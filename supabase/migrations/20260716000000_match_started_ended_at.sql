-- Persist real match start/end timestamps instead of the client having to guess
-- a Health Connect sync window ("assume 30 minutes before completion" for
-- tournament matches, or estimate from motion sample count for practice).
-- matches.started_at/ended_at and tournament_matches.started_at/ended_at were
-- already added (nullable) by 20260710010002_match_health_data.sql; this
-- migration is what actually writes them.

-- Friendly matches: the umpire client already derives the real start/end from
-- the first and last scored point (match.pointLog), so just thread those
-- through to the one place a friendly match row is created.
DROP FUNCTION IF EXISTS umpire_submit_match(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[]);

CREATE OR REPLACE FUNCTION umpire_submit_match(
  umpire_id TEXT,
  player1_id TEXT,
  player2_id TEXT,
  team1_partner_id TEXT,
  team2_partner_id TEXT,
  winner_id TEXT,
  match_score TEXT,
  match_category TEXT,
  match_round TEXT,
  is_friendly BOOLEAN,
  sets_history TEXT[] DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NULL,
  ended_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_match_id UUID;
  inferred_category TEXT;
BEGIN
  IF (team1_partner_id IS NULL OR team1_partner_id = '') AND (team2_partner_id IS NULL OR team2_partner_id = '') THEN
    inferred_category := 'Singles';
  ELSIF (team1_partner_id IS NOT NULL AND team1_partner_id != '') AND (team2_partner_id IS NOT NULL AND team2_partner_id != '') THEN
    inferred_category := 'Doubles';
  ELSE
    inferred_category := 'Hybrid';
  END IF;

  INSERT INTO matches (
    category, round, player1_id, player2_id,
    team1_partner_id, team2_partner_id, winner_id,
    score, sets_history, date, is_friendly, status, submitted_by,
    started_at, ended_at
  ) VALUES (
    inferred_category, match_round, player1_id, player2_id,
    NULLIF(team1_partner_id, ''), NULLIF(team2_partner_id, ''),
    NULLIF(winner_id, ''), match_score, sets_history,
    CURRENT_DATE, is_friendly, 'pending', NULLIF(umpire_id, ''),
    started_at, ended_at
  ) RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tournament matches: submit_tournament_match's ELO-calculation body is large
-- and version-sensitive, so rather than duplicate/retype it just to add two
-- columns, use a small dedicated RPC with the same authorization check that
-- the umpire client calls right after submit_tournament_match succeeds.
CREATE OR REPLACE FUNCTION set_tournament_match_times(
  p_match_id UUID,
  p_started_at TIMESTAMPTZ,
  p_ended_at TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid()
    AND role IN ('admin','master_admin','umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE tournament_matches
  SET started_at = COALESCE(started_at, p_started_at),
      ended_at = p_ended_at
  WHERE id = p_match_id;
END;
$$;
