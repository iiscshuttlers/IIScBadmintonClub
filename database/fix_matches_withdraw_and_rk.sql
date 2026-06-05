-- ==============================================================================
-- Database Fixes (Run this in Supabase Dashboard → SQL Editor):
-- 1. Add missing DELETE policy for matches (allow players to withdraw)
-- 2. Add missing Admin DELETE policy for matches
-- 3. Clear dummy "RK" matches and player
-- ==============================================================================

-- 1. Players can withdraw their own pending matches.
--    submitted_by stores a player TEXT ID, so we look up the viewer's player row.
CREATE POLICY "Players can withdraw their pending matches" ON matches FOR DELETE USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM players p
    WHERE p.user_id = auth.uid()
    AND (
      p.id = matches.submitted_by
      OR p.id IN (matches.player1_id, matches.player2_id, matches.team1_partner_id, matches.team2_partner_id)
    )
  )
);

-- 2. Admins can delete any match (regardless of status).
CREATE POLICY "Admins can delete any match" ON matches FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM players p
    WHERE p.user_id = auth.uid()
    AND p.email IN (
      'iiscbadmintonclub@gmail.com',
      'janmejayraja@iisc.ac.in',
      'janmejay@iisc.ac.in',
      'raja79sharma@gmail.com'
    )
  )
);

-- 3. Delete ALL dummy RK matches (confirmed, pending, rejected — everything).
DELETE FROM matches
WHERE player1_id IN (SELECT id FROM players WHERE full_name = 'RK')
   OR player2_id IN (SELECT id FROM players WHERE full_name = 'RK')
   OR team1_partner_id IN (SELECT id FROM players WHERE full_name = 'RK')
   OR team2_partner_id IN (SELECT id FROM players WHERE full_name = 'RK');

-- 4. Remove the dummy "RK" player profile (if it exists).
DELETE FROM players WHERE full_name = 'RK';
