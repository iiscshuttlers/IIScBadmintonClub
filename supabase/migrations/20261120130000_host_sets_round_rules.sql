-- Let a tournament's host change its scoring rules (points, games, cap per round).
--
-- Saving a rule writes two tables. The rule itself goes to
-- tournament_round_rules, and the same values go onto that round's existing
-- tournament_matches so scheduled and live matches pick them up. As of
-- 2026-11-20 only admins can write either table (trr_admin_all;
-- tm_admin_write is admins and umpires). So a host who is not an admin could
-- not save a rule, and giving hosts table access alone would not be enough:
-- the matches update would be filtered by RLS to 0 rows without an error.
--
-- set_tournament_round_rule does both writes in one transaction. It is
-- SECURITY DEFINER and lets in:
--   * the tournament's creator, or an admin by id (is_tournament_manager), the
--     check tp_host_manage and the team tables already use for hosts;
--   * an admin matched by e-mail (is_admin_or_master).
-- Assigned officials who did not create the tournament are not let in, the
-- same as for entries. A host cannot change the rules of a trashed
-- tournament; admins still can, as they could through the table.
--
-- It updates only points_to_win, best_of_sets and golden_point on the matches
-- of that category and round, as the client did before. Results, courts and
-- times are not touched, so the match edit guard and audit triggers have
-- nothing to act on.
--
-- Table policies are unchanged: hosts still cannot write
-- tournament_round_rules or tournament_matches directly, and old clients keep
-- their direct admin writes. New clients call this function for everyone and
-- fall back to the direct writes if it is missing.
--
-- Rollback: supabase/rollbacks/20261120130000_host_sets_round_rules.rollback.sql

CREATE OR REPLACE FUNCTION public.set_tournament_round_rule(
  p_tournament_id uuid,
  p_category text,
  p_round integer,
  p_round_name text,
  p_points_to_win integer,
  p_best_of_sets integer,
  p_golden_point integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
  v_is_admin boolean := COALESCE(public.is_admin_or_master(), false);
BEGIN
  IF auth.uid() IS NULL
     OR NOT (v_is_admin OR COALESCE(public.is_tournament_manager(p_tournament_id), false)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Only the tournament''s host or an admin can change its scoring rules';
  END IF;

  SELECT t.status INTO v_status FROM public.tournaments t WHERE t.id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Tournament not found';
  END IF;
  IF v_status = 'deleted' AND NOT v_is_admin THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'This tournament is in the trash. Restore it before changing its rules.';
  END IF;

  IF p_category IS NULL OR btrim(p_category) = '' OR p_round IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Category and round are required';
  END IF;
  IF COALESCE(p_points_to_win, 0) < 1 OR COALESCE(p_best_of_sets, 0) < 1 OR COALESCE(p_golden_point, 0) < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Points to win, games and cap must each be at least 1';
  END IF;

  INSERT INTO public.tournament_round_rules
    (tournament_id, category, round, round_name, points_to_win, best_of_sets, golden_point)
  VALUES
    (p_tournament_id, p_category, p_round, p_round_name, p_points_to_win, p_best_of_sets, p_golden_point)
  ON CONFLICT (tournament_id, category, round) DO UPDATE
    SET round_name    = EXCLUDED.round_name,
        points_to_win = EXCLUDED.points_to_win,
        best_of_sets  = EXCLUDED.best_of_sets,
        golden_point  = EXCLUDED.golden_point;

  UPDATE public.tournament_matches m
     SET points_to_win = p_points_to_win,
         best_of_sets  = p_best_of_sets,
         golden_point  = p_golden_point
   WHERE m.tournament_id = p_tournament_id
     AND m.category = p_category
     AND m.round = p_round
     AND (m.points_to_win IS DISTINCT FROM p_points_to_win
          OR m.best_of_sets IS DISTINCT FROM p_best_of_sets
          OR m.golden_point IS DISTINCT FROM p_golden_point);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_tournament_round_rule(uuid, text, integer, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tournament_round_rule(uuid, text, integer, text, integer, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.set_tournament_round_rule(uuid, text, integer, text, integer, integer, integer) IS
  'Upserts one round''s scoring rule and copies it onto that round''s matches. Host (creator) or admin only.';
