-- Grant EXECUTE permissions on ELO recalculation functions to authenticated role (protected internally by Admin RBAC checks)
GRANT EXECUTE ON FUNCTION recalculate_all_elo() TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_tournament_elo() TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_player_all_records(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_category_records(UUID) TO authenticated;
