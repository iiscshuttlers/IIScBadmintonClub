-- ==============================================================================
-- Database Fixes: 
-- 1. Add missing DELETE policy for matches (allowing players to withdraw pending matches)
-- 2. Add missing Admin DELETE policy for matches
-- 3. Clear dummy "RK" matches
-- ==============================================================================

-- 1. Players can withdraw their own pending matches
CREATE POLICY "Players can withdraw their pending matches" ON matches FOR DELETE USING (
  status = 'pending' AND (
    submitted_by = auth.uid()::text 
    OR EXISTS (
      SELECT 1 FROM players p 
      WHERE p.user_id = auth.uid() 
      AND p.id IN (matches.player1_id, matches.player2_id, matches.team1_partner_id, matches.team2_partner_id)
    )
  )
);

-- 2. Admins can delete any match
CREATE POLICY "Admins can delete any match" ON matches FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM players p 
    WHERE p.user_id = auth.uid() 
    AND p.email IN ('iiscbadmintonclub@gmail.com', 'janmejayraja@iisc.ac.in', 'janmejay@iisc.ac.in', 'raja79sharma@gmail.com')
  )
);

-- 3. Delete dummy RK matches
DELETE FROM matches 
WHERE player1_id IN (SELECT id FROM players WHERE full_name = 'RK') 
   OR player2_id IN (SELECT id FROM players WHERE full_name = 'RK') 
   OR team1_partner_id IN (SELECT id FROM players WHERE full_name = 'RK') 
   OR team2_partner_id IN (SELECT id FROM players WHERE full_name = 'RK');

-- Also clean up the player "RK" if they were a dummy
DELETE FROM players WHERE full_name = 'RK';
