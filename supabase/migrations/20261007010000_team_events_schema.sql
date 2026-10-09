-- Migration: Team Events Schema (Phase 1)
-- Supersedes open-event only architecture. Adds leagues, team knockouts, and tie-based formats.

-- 1. Modify `tournaments`
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS format_family text NOT NULL DEFAULT 'OPEN_EVENT' CHECK (format_family IN ('OPEN_EVENT', 'TEAM')),
ADD COLUMN IF NOT EXISTS tie_format_config jsonb,
ADD COLUMN IF NOT EXISTS max_rubbers_per_player int DEFAULT 2 CHECK (max_rubbers_per_player > 0),
ADD COLUMN IF NOT EXISTS team_roster_min int DEFAULT 4,
ADD COLUMN IF NOT EXISTS team_roster_max int DEFAULT 10,
ADD COLUMN IF NOT EXISTS team_self_registration boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS tie_points_win int DEFAULT 2,
ADD COLUMN IF NOT EXISTS tie_points_draw int DEFAULT 1,
ADD COLUMN IF NOT EXISTS counts_for_elo boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS ignore_gender_rules boolean NOT NULL DEFAULT false;

ALTER TABLE tournaments ADD CONSTRAINT check_team_format 
CHECK (format_family = 'TEAM' OR tie_format_config IS NULL);

-- 2. Create `tournament_teams`
CREATE TABLE IF NOT EXISTS tournament_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name text NOT NULL,
    short_name text NOT NULL CHECK (char_length(short_name) <= 5),
    logo_url text,
    captain_id uuid NOT NULL REFERENCES players(id),
    pool text,
    seed int,
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WITHDRAWN')),
    created_at timestamptz DEFAULT now(),
    UNIQUE (tournament_id, captain_id)
);

CREATE UNIQUE INDEX idx_tournament_teams_name ON tournament_teams (tournament_id, lower(name));
CREATE UNIQUE INDEX idx_tournament_teams_short_name ON tournament_teams (tournament_id, lower(short_name));
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);

-- 3. Create `tournament_team_members`
CREATE TABLE IF NOT EXISTS tournament_team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id),
    role text NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('VICE_CAPTAIN', 'PLAYER')),
    status text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'DECLINED', 'REMOVED')),
    invited_by uuid REFERENCES players(id),
    created_at timestamptz DEFAULT now(),
    responded_at timestamptz,
    UNIQUE (team_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_ttm_team_id ON tournament_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_ttm_player_id ON tournament_team_members(player_id);
-- Partial unique index: A player can only be ACTIVE or INVITED to one team per tournament
CREATE UNIQUE INDEX IF NOT EXISTS idx_ttm_unique_active_player_per_tournament 
ON tournament_team_members(tournament_id, player_id) 
WHERE status IN ('INVITED', 'ACTIVE');

-- 4. Create `tournament_ties`
CREATE TABLE IF NOT EXISTS tournament_ties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    tie_code text NOT NULL,
    team_a_id uuid REFERENCES tournament_teams(id),
    team_b_id uuid REFERENCES tournament_teams(id),
    stage text CHECK (stage IN ('POOL', 'KNOCKOUT')),
    round_name text,
    round_number int,
    state text NOT NULL DEFAULT 'SCHEDULED' CHECK (state IN ('SCHEDULED', 'AWAITING_LINEUPS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    scheduled_at timestamptz,
    lineup_deadline timestamptz,
    lineup_locked_a boolean NOT NULL DEFAULT false,
    lineup_locked_b boolean NOT NULL DEFAULT false,
    score_team_a int NOT NULL DEFAULT 0,
    score_team_b int NOT NULL DEFAULT 0,
    winner_team_id uuid REFERENCES tournament_teams(id),
    result_type text NOT NULL DEFAULT 'NORMAL' CHECK (result_type IN ('NORMAL', 'WALKOVER', 'FORFEIT', 'ADMIN_DECISION')),
    needs_admin_decision boolean NOT NULL DEFAULT false,
    advances_to_tie uuid REFERENCES tournament_ties(id),
    advances_to_slot text CHECK (advances_to_slot IN ('A', 'B')),
    loser_advances_to_tie uuid REFERENCES tournament_ties(id),
    loser_advances_to_slot text CHECK (loser_advances_to_slot IN ('A', 'B')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tournament_id, tie_code),
    CHECK (team_a_id IS NULL OR team_b_id IS NULL OR team_a_id <> team_b_id)
);
CREATE INDEX IF NOT EXISTS idx_ties_tournament_state ON tournament_ties(tournament_id, state);
CREATE INDEX IF NOT EXISTS idx_ties_team_a ON tournament_ties(team_a_id);
CREATE INDEX IF NOT EXISTS idx_ties_team_b ON tournament_ties(team_b_id);

-- 5. Modify `tournament_matches`
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS tie_id uuid REFERENCES tournament_ties(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS rubber_order int,
ADD COLUMN IF NOT EXISTS rubber_label text;

ALTER TABLE tournament_matches ADD CONSTRAINT check_rubber_nulls 
CHECK ((tie_id IS NULL) = (rubber_order IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_unique_rubber 
ON tournament_matches(tie_id, rubber_order) 
WHERE tie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_tie_id ON tournament_matches(tie_id);

-- 6. Create `tie_lineups` (Private Lineups)
CREATE TABLE IF NOT EXISTS tie_lineups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tie_id uuid NOT NULL REFERENCES tournament_ties(id) ON DELETE CASCADE,
    side text NOT NULL CHECK (side IN ('A', 'B')),
    rubber_order int NOT NULL,
    player1_id uuid NOT NULL REFERENCES players(id),
    player2_id uuid REFERENCES players(id),
    submitted_by uuid NOT NULL REFERENCES players(id),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (tie_id, side, rubber_order)
);
CREATE INDEX IF NOT EXISTS idx_lineups_tie_id ON tie_lineups(tie_id);

-- 7. Helper Security Functions (For RLS & RPCs)
CREATE OR REPLACE FUNCTION is_tournament_manager(t_id uuid) RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM tournaments t
        JOIN players p ON p.id = auth.uid()
        WHERE t.id = t_id 
        AND (t.created_by = auth.uid() OR p.role IN ('admin', 'master_admin'))
    );
$$;

CREATE OR REPLACE FUNCTION is_team_captain(t_team_id uuid) RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM tournament_teams WHERE id = t_team_id AND captain_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION is_team_staff(t_team_id uuid) RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM tournament_team_members 
        WHERE team_id = t_team_id 
        AND player_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('CAPTAIN', 'VICE_CAPTAIN')
    ) OR is_team_captain(t_team_id);
$$;

CREATE OR REPLACE FUNCTION is_active_team_member(t_team_id uuid) RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM tournament_team_members 
        WHERE team_id = t_team_id 
        AND player_id = auth.uid() 
        AND status = 'ACTIVE'
    );
$$;

-- 8. Row Level Security (RLS) Policies

ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view teams" ON tournament_teams FOR SELECT USING (true);

ALTER TABLE tournament_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active members" ON tournament_team_members FOR SELECT 
USING (status = 'ACTIVE');
CREATE POLICY "Staff and managers can view all members" ON tournament_team_members FOR SELECT 
USING (
    player_id = auth.uid() 
    OR is_team_staff(team_id) 
    OR is_tournament_manager(tournament_id)
);

ALTER TABLE tournament_ties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view ties" ON tournament_ties FOR SELECT USING (true);

ALTER TABLE tie_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view all lineups" ON tie_lineups FOR SELECT 
USING (is_tournament_manager((SELECT tournament_id FROM tournament_ties WHERE id = tie_id)));

CREATE POLICY "Staff can view own lineups" ON tie_lineups FOR SELECT 
USING (
    (side = 'A' AND is_team_staff((SELECT team_a_id FROM tournament_ties WHERE id = tie_id)))
    OR 
    (side = 'B' AND is_team_staff((SELECT team_b_id FROM tournament_ties WHERE id = tie_id)))
);

CREATE POLICY "Public can view locked lineups" ON tie_lineups FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM tournament_ties 
        WHERE id = tie_lineups.tie_id 
        AND lineup_locked_a = true 
        AND lineup_locked_b = true
    )
);
