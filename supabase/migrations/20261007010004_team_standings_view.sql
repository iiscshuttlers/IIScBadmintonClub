-- 20261007010004_team_standings_view.sql
CREATE OR REPLACE VIEW tournament_team_standings WITH (security_invoker = on) AS
WITH team_stats AS (
    SELECT 
        t.tournament_id,
        t.id as team_id,
        t.name as team_name,
        t.pool,
        COUNT(tie.id) FILTER (WHERE tie.state = 'COMPLETED') as played,
        COUNT(tie.id) FILTER (WHERE tie.state = 'COMPLETED' AND tie.winner_team_id = t.id) as won,
        COUNT(tie.id) FILTER (WHERE tie.state = 'COMPLETED' AND tie.winner_team_id IS NULL AND tie.score_team_a = tie.score_team_b) as drawn,
        COUNT(tie.id) FILTER (WHERE tie.state = 'COMPLETED' AND tie.winner_team_id IS NOT NULL AND tie.winner_team_id != t.id) as lost,
        COALESCE(SUM(
            CASE 
                WHEN tie.team_a_id = t.id THEN tie.score_team_a 
                WHEN tie.team_b_id = t.id THEN tie.score_team_b 
                ELSE 0 
            END
        ) FILTER (WHERE tie.state = 'COMPLETED'), 0) as rubbers_for,
        COALESCE(SUM(
            CASE 
                WHEN tie.team_a_id = t.id THEN tie.score_team_b 
                WHEN tie.team_b_id = t.id THEN tie.score_team_a 
                ELSE 0 
            END
        ) FILTER (WHERE tie.state = 'COMPLETED'), 0) as rubbers_against
    FROM tournament_teams t
    LEFT JOIN tournament_ties tie 
        ON (tie.team_a_id = t.id OR tie.team_b_id = t.id) 
        AND tie.stage = 'POOL'
    GROUP BY t.tournament_id, t.id, t.name, t.pool
)
SELECT 
    ts.tournament_id,
    ts.team_id,
    ts.team_name,
    ts.pool,
    ts.played,
    ts.won,
    ts.drawn,
    ts.lost,
    -- Points: 2 for win, 1 for draw (using default, or we could join tournaments table to get tie_points_win/draw)
    (ts.won * COALESCE(tourn.tie_points_win, 2) + ts.drawn * COALESCE(tourn.tie_points_draw, 1)) as tie_points,
    ts.rubbers_for,
    ts.rubbers_against
FROM team_stats ts
JOIN tournaments tourn ON tourn.id = ts.tournament_id;
