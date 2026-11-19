-- Signed-out callers can no longer run the win/loss recount functions.
--
-- recalculate_player_all_records(uuid) and recalculate_category_records(uuid)
-- are SECURITY DEFINER and were EXECUTE-able by anon, so anyone could make the
-- database recount any player (harmless values, but free work on demand).
-- They run from triggers (trigger_update_win_loss_records,
-- handle_deleted_tournament), which execute as their owner, so the triggers
-- don't need these grants. Older app versions called them from admin screens
-- as signed-in users, so authenticated keeps EXECUTE.
--
-- Rollback: supabase/rollbacks/20261120110300_record_recount_not_for_anon.rollback.sql

REVOKE EXECUTE ON FUNCTION public.recalculate_player_all_records(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_category_records(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_player_all_records(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_category_records(uuid) TO authenticated, service_role;
