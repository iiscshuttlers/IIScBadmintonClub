-- Adds is_cross_gender_singles, is_hybrid, is_mixed_category_doubles params
-- to submit_friendly_match so the client call succeeds.
-- Must DROP first because Postgres won't replace a function with a different signature.

DROP FUNCTION IF EXISTS public.submit_friendly_match(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);

CREATE OR REPLACE FUNCTION public.submit_friendly_match(
  submitter_id              TEXT,
  opponent_id               TEXT,
  match_winner_id           TEXT,
  match_score               TEXT,
  submitter_partner_id      TEXT    DEFAULT NULL,
  opponent_partner_id       TEXT    DEFAULT NULL,
  is_cross_gender_singles   BOOLEAN DEFAULT FALSE,
  is_hybrid                 BOOLEAN DEFAULT FALSE,
  is_mixed_category_doubles BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  new_match_id      UUID;
  existing_match_id UUID;
  derived_category  TEXT;
  submitter_uuid    UUID;
  opponent_uuid     UUID;
  winner_uuid       UUID;
  partner_uuid      UUID;
  opp_partner_uuid  UUID;
BEGIN
  -- Cast TEXT parameters to UUID
  submitter_uuid := submitter_id::UUID;
  opponent_uuid := opponent_id::UUID;
  winner_uuid := match_winner_id::UUID;
  partner_uuid := CASE WHEN submitter_partner_id IS NOT NULL THEN submitter_partner_id::UUID ELSE NULL END;
  opp_partner_uuid := CASE WHEN opponent_partner_id IS NOT NULL THEN opponent_partner_id::UUID ELSE NULL END;

  IF winner_uuid != submitter_uuid AND winner_uuid != opponent_uuid THEN
    RAISE EXCEPTION 'Winner must be one of the two players.';
  END IF;

  -- Dedup: return existing pending match if submitted in the last 2 hours
  SELECT id INTO existing_match_id
  FROM matches
  WHERE status = 'pending'
    AND created_at > now() - INTERVAL '2 hours'
    AND (
      (player1_id = submitter_uuid AND player2_id = opponent_uuid)
      OR (player1_id = opponent_uuid AND player2_id = submitter_uuid)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_match_id IS NOT NULL THEN
    RETURN existing_match_id;
  END IF;

  derived_category :=
    CASE
      WHEN is_hybrid THEN 'Hybrid'
      WHEN is_mixed_category_doubles THEN 'Mixed Doubles'
      WHEN partner_uuid IS NOT NULL OR opp_partner_uuid IS NOT NULL THEN 'Doubles'
      ELSE 'Singles'
    END;

  INSERT INTO matches (
    category,
    round,
    player1_id,
    player2_id,
    team1_partner_id,
    team2_partner_id,
    winner_id,
    score,
    date,
    is_friendly,
    status,
    submitted_by
  ) VALUES (
    derived_category,
    'Friendly',
    submitter_uuid,
    opponent_uuid,
    partner_uuid,
    opp_partner_uuid,
    winner_uuid,
    match_score,
    CURRENT_DATE,
    true,
    'pending',
    submitter_uuid
  ) RETURNING id INTO new_match_id;

  RETURN new_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
