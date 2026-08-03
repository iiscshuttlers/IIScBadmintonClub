-- Secure Exposed RPCs (Strict RBAC and Identity Checks)

-- 1. accept_friendly_match: Stop identity forgery
DROP FUNCTION IF EXISTS accept_friendly_match(uuid, text);
DROP FUNCTION IF EXISTS accept_friendly_match(uuid, uuid);

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
  -- IDENTITY CHECK: Ensure the caller is actually the confirmer_id they claim to be
  IF confirmer_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only accept matches for yourself.';
  END IF;

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
    RETURN confirm_friendly_match(match_uuid, confirmer_id)
           || jsonb_build_object('confirmed', true, 'accepted', agreed, 'required', required);
  END IF;

  RETURN jsonb_build_object('confirmed', false, 'accepted', agreed, 'required', required);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION accept_friendly_match(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_friendly_match(UUID, UUID) TO authenticated;


-- 2. increment_match_score: Enforce Admin/Umpire RBAC
CREATE OR REPLACE FUNCTION increment_match_score(match_id UUID, p1_increment INT, p2_increment INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- RBAC CHECK: Only Admins and Umpires can manipulate live match scores
  IF NOT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only Umpires and Admins can manipulate match scores.';
  END IF;

  UPDATE matches
  SET score = jsonb_set(
                jsonb_set(COALESCE(score, '{"p1":0, "p2":0}'::jsonb), '{p1}', (COALESCE((score->>'p1')::int, 0) + p1_increment)::text::jsonb),
                '{p2}', (COALESCE((score->>'p2')::int, 0) + p2_increment)::text::jsonb
              )
  WHERE id = match_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_match_score(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_match_score(UUID, INT, INT) TO authenticated;


-- 3. umpire_submit_match: Enforce Admin/Umpire RBAC
DROP FUNCTION IF EXISTS umpire_submit_match(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ);

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
  -- RBAC CHECK: Only Admins and Umpires can submit umpire-driven matches
  IF NOT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = auth.uid() AND role IN ('admin', 'master_admin', 'umpire')
  ) THEN
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
    inferred_category, match_round, player1_id, player2_id,
    NULLIF(team1_partner_id, ''), NULLIF(team2_partner_id, ''),
    NULLIF(winner_id, ''), match_score, sets_history,
    CURRENT_DATE, is_friendly, 'pending', NULLIF(umpire_id, ''),
    started_at, ended_at
  ) RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION umpire_submit_match(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION umpire_submit_match(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
