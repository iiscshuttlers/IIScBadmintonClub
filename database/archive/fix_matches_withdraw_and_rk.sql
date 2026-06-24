-- ==============================================================================
-- Database Fixes (Run this in Supabase Dashboard → SQL Editor):
-- 1. Add missing DELETE policy for matches (allow players to withdraw)
-- 2. Add missing Admin DELETE policy for matches
-- 3. Clear dummy "RK" matches and player
-- ==============================================================================

-- 1. Players can withdraw their own pending matches.
CREATE POLICY "Players can withdraw their pending matches" ON matches FOR DELETE USING (
  status = 'pending'
  AND (
    auth.uid() = matches.submitted_by
    OR auth.uid() IN (matches.player1_id, matches.player2_id, matches.team1_partner_id, matches.team2_partner_id)
  )
);

-- 2. Admins can delete any match (regardless of status).
CREATE POLICY "Admins can delete any match" ON matches FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM players
    WHERE id = auth.uid()
    AND role IN ('master_admin', 'admin')
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
