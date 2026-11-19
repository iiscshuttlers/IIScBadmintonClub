-- Rollback for 20261120110600_team_players_read_draft_matches.sql
DROP POLICY IF EXISTS "tm_team_player_read" ON public.tournament_matches;
DROP FUNCTION IF EXISTS public.my_team_tournament_ids();
