-- Supabase-native tournament system
-- Replaces Firebase bracket data entirely

-- ─────────────────────────────────────────────
-- tournaments
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  tournament_type TEXT NOT NULL DEFAULT 'open',          -- open | invitational | internal
  bracket_format  TEXT NOT NULL DEFAULT 'single_elim',   -- single_elim (only for now)
  categories      TEXT[] DEFAULT '{}',                   -- ['MS','WS','MD','WD','XD']
  status          TEXT NOT NULL DEFAULT 'draft',         -- draft | active | completed | archived
  start_date      DATE,
  end_date        DATE,
  venue           TEXT,
  description     TEXT,
  eligibility     TEXT,
  form_url        TEXT,
  form_status     TEXT DEFAULT 'disabled',               -- open | closing_soon | closed | disabled
  form_close_date DATE,
  archived_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES players(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Public can see non-draft tournaments
CREATE POLICY "tournaments_public_read" ON tournaments
  FOR SELECT USING (status <> 'draft');

-- Admins/master_admins can see all including drafts
CREATE POLICY "tournaments_admin_read" ON tournaments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

CREATE POLICY "tournaments_admin_write" ON tournaments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- ─────────────────────────────────────────────
-- tournament_participants
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  player_id     UUID REFERENCES players(id),    -- NULL for external players
  partner_id    UUID REFERENCES players(id),    -- NULL for singles or external doubles
  display_name  TEXT,                           -- free-text for external entries or name override
  seed          INT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tp_public_read" ON tournament_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.status <> 'draft')
  );

CREATE POLICY "tp_admin_all" ON tournament_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- ─────────────────────────────────────────────
-- tournament_round_rules
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_round_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,   -- MS | WS | MD | WD | XD | * (all)
  round         INT NOT NULL,
  round_name    TEXT,
  points_to_win INT NOT NULL DEFAULT 21,
  best_of_sets  INT NOT NULL DEFAULT 3,
  golden_point  INT NOT NULL DEFAULT 30,
  UNIQUE(tournament_id, category, round)
);

ALTER TABLE tournament_round_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trr_public_read" ON tournament_round_rules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.status <> 'draft')
  );

CREATE POLICY "trr_admin_all" ON tournament_round_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin'))
  );

-- ─────────────────────────────────────────────
-- tournament_matches
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_matches (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id        UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  category             TEXT NOT NULL,
  match_code           TEXT NOT NULL,     -- 'MS_R1_01', 'WS_SF_01', 'XD_F_01'
  round                INT NOT NULL,
  round_name           TEXT NOT NULL,
  match_number         INT NOT NULL,

  -- Team 1
  player1_id           UUID REFERENCES players(id),
  player3_id           UUID REFERENCES players(id),   -- doubles partner of team 1
  team1_label          TEXT,                          -- display name or "Winner of MS_R1_01"

  -- Team 2
  player2_id           UUID REFERENCES players(id),
  player4_id           UUID REFERENCES players(id),   -- doubles partner of team 2
  team2_label          TEXT,

  -- Admin scheduling (set after bracket is active)
  court_number         TEXT,
  scheduled_at         TIMESTAMPTZ,

  -- Scoring rules (inherited from tournament_round_rules; admin can override per match)
  points_to_win        INT DEFAULT 21,
  best_of_sets         INT DEFAULT 3,
  golden_point         INT DEFAULT 30,

  -- Result
  winner_side          SMALLINT CHECK (winner_side IN (1, 2)),
  winner_id            UUID REFERENCES players(id),   -- player1_id or player2_id (team rep)
  score                TEXT,                          -- "21-15, 21-18"
  sets_history         TEXT[],

  -- Status
  status               TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | in_progress | completed | walkover
  locked               BOOLEAN DEFAULT FALSE,              -- only master_admin can edit after lock

  -- Bracket progression
  advances_to_match    TEXT,                          -- match_code of the next match
  advances_to_position SMALLINT CHECK (advances_to_position IN (1, 2)),

  -- Audit
  umpired_by           UUID REFERENCES players(id),
  scored_by            UUID REFERENCES players(id),
  scored_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tournament_id, match_code)
);

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tm_public_read" ON tournament_matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.status <> 'draft')
  );

CREATE POLICY "tm_admin_read" ON tournament_matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin','umpire'))
  );

CREATE POLICY "tm_admin_write" ON tournament_matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin','umpire'))
  );

-- ─────────────────────────────────────────────
-- RPC: advance_tournament_winner (internal helper)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION advance_tournament_winner(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match        tournament_matches%ROWTYPE;
  v_next         tournament_matches%ROWTYPE;
  v_winner_label TEXT;
  v_winner_p1    UUID;
  v_winner_p3    UUID;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.advances_to_match IS NULL THEN RETURN; END IF;

  SELECT * INTO v_next FROM tournament_matches
  WHERE tournament_id = v_match.tournament_id AND match_code = v_match.advances_to_match;
  IF NOT FOUND THEN RETURN; END IF;

  -- Determine winning team's players and label
  IF v_match.winner_side = 1 THEN
    v_winner_p1    := v_match.player1_id;
    v_winner_p3    := v_match.player3_id;
    v_winner_label := COALESCE(v_match.team1_label,
                        (SELECT full_name FROM players WHERE id = v_match.player1_id));
  ELSE
    v_winner_p1    := v_match.player2_id;
    v_winner_p3    := v_match.player4_id;
    v_winner_label := COALESCE(v_match.team2_label,
                        (SELECT full_name FROM players WHERE id = v_match.player2_id));
  END IF;

  -- Slot winner into the next match
  IF v_match.advances_to_position = 1 THEN
    UPDATE tournament_matches
    SET player1_id = v_winner_p1,
        player3_id = v_winner_p3,
        team1_label = v_winner_label
    WHERE id = v_next.id;
  ELSE
    UPDATE tournament_matches
    SET player2_id = v_winner_p1,
        player4_id = v_winner_p3,
        team2_label = v_winner_label
    WHERE id = v_next.id;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────
-- RPC: submit_tournament_match
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_tournament_match(
  p_match_id    UUID,
  p_winner_side SMALLINT,
  p_score       TEXT,
  p_sets        TEXT[],
  p_umpire_id   UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id UUID;
  v_match     tournament_matches%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid()
    AND role IN ('admin','master_admin','umpire')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.locked THEN RAISE EXCEPTION 'Match is locked; only master_admin can edit'; END IF;

  IF p_winner_side = 1 THEN v_winner_id := v_match.player1_id;
  ELSE                       v_winner_id := v_match.player2_id;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    locked       = TRUE,
    umpired_by   = p_umpire_id,
    scored_by    = auth.uid(),
    scored_at    = NOW()
  WHERE id = p_match_id;

  PERFORM advance_tournament_winner(p_match_id);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_tournament_match(UUID, SMALLINT, TEXT, TEXT[], UUID) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: admin_edit_tournament_match (master_admin only)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_edit_tournament_match(
  p_match_id    UUID,
  p_winner_side SMALLINT,
  p_score       TEXT,
  p_sets        TEXT[]
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id UUID;
  v_match     tournament_matches%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role = 'master_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only master_admin can edit locked matches';
  END IF;

  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF p_winner_side = 1 THEN v_winner_id := v_match.player1_id;
  ELSE                       v_winner_id := v_match.player2_id;
  END IF;

  UPDATE tournament_matches SET
    winner_side  = p_winner_side,
    winner_id    = v_winner_id,
    score        = p_score,
    sets_history = p_sets,
    status       = 'completed',
    locked       = TRUE,
    scored_by    = auth.uid(),
    scored_at    = NOW()
  WHERE id = p_match_id;

  PERFORM advance_tournament_winner(p_match_id);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_edit_tournament_match(UUID, SMALLINT, TEXT, TEXT[]) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: admin_move_player_in_bracket (master_admin, draft only)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_move_player_in_bracket(
  p_match_id    UUID,
  p_slot        SMALLINT,       -- 1 or 2
  p_player_id   UUID,
  p_partner_id  UUID,
  p_label       TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role = 'master_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Only allowed when tournament is in draft status
  IF NOT EXISTS (
    SELECT 1 FROM tournaments t
    JOIN tournament_matches m ON m.tournament_id = t.id
    WHERE m.id = p_match_id AND t.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Bracket moves only allowed while tournament is in draft status';
  END IF;

  IF p_slot = 1 THEN
    UPDATE tournament_matches
    SET player1_id = p_player_id, player3_id = p_partner_id, team1_label = p_label
    WHERE id = p_match_id;
  ELSE
    UPDATE tournament_matches
    SET player2_id = p_player_id, player4_id = p_partner_id, team2_label = p_label
    WHERE id = p_match_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_move_player_in_bracket(UUID, SMALLINT, UUID, UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: archive_tournament
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION archive_tournament(p_tournament_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin','master_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE tournaments
  SET status = 'archived', archived_at = NOW()
  WHERE id = p_tournament_id AND status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament must be in completed status to archive';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_tournament(UUID) TO authenticated;
