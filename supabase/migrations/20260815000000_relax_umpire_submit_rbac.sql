-- Relax RBAC check for umpire_submit_match to support admins without a linked players row

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
  v_is_authorized BOOLEAN := false;
BEGIN
  -- RBAC CHECK: Only Admins and Umpires can submit umpire-driven matches
  IF (auth.jwt()->>'email') IN ('raja79sharma@gmail.com', 'iiscbadmintonclub@gmail.com') THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.players 
    WHERE (id = auth.uid() OR email = (auth.jwt()->>'email') OR iisc_email = (auth.jwt()->>'email'))
    AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can submit matches as an umpire.';
  END IF;

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
    inferred_category, match_round, player1_id::uuid, player2_id::uuid,
    NULLIF(team1_partner_id, '')::uuid, NULLIF(team2_partner_id, '')::uuid,
    NULLIF(winner_id, '')::uuid, match_score, sets_history,
    CURRENT_DATE, is_friendly, 'pending', NULLIF(umpire_id, '')::uuid,
    started_at, ended_at
  ) RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION umpire_submit_match(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION umpire_submit_match(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
