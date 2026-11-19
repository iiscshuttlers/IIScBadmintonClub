-- Drop tournaments_admin_read; tournaments_admin_write already grants it.
--
-- tournaments_admin_write is FOR ALL with USING ((SELECT is_admin_or_master())),
-- and a FOR ALL policy's USING also applies to SELECT. tournaments_admin_read
-- (FOR SELECT, same expression since 20261118160200) therefore added nothing,
-- but it was a second copy of the admin rule that had to be kept in step by
-- hand, and every tournaments read planned it as an extra initplan.
--
-- Who can read what does not change: admins read every tournament (drafts
-- and trash included) through tournaments_admin_write.
--
-- Rollback: supabase/rollbacks/20261120120100_drop_redundant_tournaments_admin_read.rollback.sql

DROP POLICY IF EXISTS "tournaments_admin_read" ON public.tournaments;
