-- Trigger function to update doubles_teams ELO upon match confirmation
CREATE OR REPLACE FUNCTION update_doubles_teams_elo()
RETURNS TRIGGER AS $$
DECLARE
  v_team1_id UUID;
  v_team2_id UUID;
  v_team1_elo INTEGER;
  v_team2_elo INTEGER;
  v_expected_t1 NUMERIC;
  v_k INTEGER := 32;
  v_t1_new INTEGER;
  v_t2_new INTEGER;
BEGIN
  -- Only proceed if the match is confirmed and it just changed to confirmed
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    
    -- Ensure it's a doubles match (partners are not null)
    IF NEW.team1_partner_id IS NOT NULL AND NEW.team2_partner_id IS NOT NULL THEN
      
      -- Attempt to find Team 1 in doubles_teams
      SELECT id, elo_rating INTO v_team1_id, v_team1_elo
      FROM doubles_teams
      WHERE (player1_id = NEW.player1_id AND player2_id = NEW.team1_partner_id)
         OR (player1_id = NEW.team1_partner_id AND player2_id = NEW.player1_id);

      -- Attempt to find Team 2 in doubles_teams
      SELECT id, elo_rating INTO v_team2_id, v_team2_elo
      FROM doubles_teams
      WHERE (player1_id = NEW.player2_id AND player2_id = NEW.team2_partner_id)
         OR (player1_id = NEW.team2_partner_id AND player2_id = NEW.player2_id);

      -- If neither team is an official registered team, exit early.
      IF v_team1_id IS NULL AND v_team2_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Use default baseline 1200 for unregistered teams
      v_team1_elo := COALESCE(v_team1_elo, 1200);
      v_team2_elo := COALESCE(v_team2_elo, 1200);

      -- Calculate expected outcome for Team 1
      v_expected_t1 := 1.0 / (1.0 + POWER(10.0, (v_team2_elo - v_team1_elo) / 400.0));

      -- Determine changes based on winner
      IF NEW.winner_id = NEW.player1_id OR NEW.winner_id = NEW.team1_partner_id THEN
        -- Team 1 won
        v_t1_new := v_team1_elo + ROUND(v_k * (1 - v_expected_t1));
        v_t2_new := v_team2_elo + ROUND(v_k * (0 - (1 - v_expected_t1)));
        
        IF v_team1_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t1_new, 100),
              matches_played = matches_played + 1,
              matches_won = matches_won + 1
          WHERE id = v_team1_id;
        END IF;

        IF v_team2_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t2_new, 100),
              matches_played = matches_played + 1
          WHERE id = v_team2_id;
        END IF;

      ELSIF NEW.winner_id = NEW.player2_id OR NEW.winner_id = NEW.team2_partner_id THEN
        -- Team 2 won
        v_t1_new := v_team1_elo + ROUND(v_k * (0 - v_expected_t1));
        v_t2_new := v_team2_elo + ROUND(v_k * (1 - (1 - v_expected_t1)));

        IF v_team1_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t1_new, 100),
              matches_played = matches_played + 1
          WHERE id = v_team1_id;
        END IF;

        IF v_team2_id IS NOT NULL THEN
          UPDATE doubles_teams 
          SET elo_rating = GREATEST(v_t2_new, 100),
              matches_played = matches_played + 1,
              matches_won = matches_won + 1
          WHERE id = v_team2_id;
        END IF;
      END IF;
      
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_update_doubles_teams_elo ON matches;

-- Create the trigger
CREATE TRIGGER trg_update_doubles_teams_elo
AFTER UPDATE OF status ON matches
FOR EACH ROW
EXECUTE FUNCTION update_doubles_teams_elo();