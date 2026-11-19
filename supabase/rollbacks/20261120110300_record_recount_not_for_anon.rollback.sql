-- Rollback for 20261120110300_record_recount_not_for_anon.sql
-- Restores the previous grants (anon, authenticated and service_role had
-- EXECUTE; PUBLIC had none).
GRANT EXECUTE ON FUNCTION public.recalculate_player_all_records(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.recalculate_category_records(uuid) TO anon;
