-- Guest claim vs in-app registration (registration build, leftover item 2).
-- A fallback-form row can name a guest; when the real player later claims that
-- guest, the merge must never leave one person in two rows of one category.
-- Needs registration_test_helpers.sql first. Run:
--   node supabase/tests/registration_rehearse.mjs C supabase/tests/registration_test_helpers.sql \
--        supabase/tests/registration_guest_claim_assertions.sql

-- Own players and tournament, so earlier assertion files can't affect it.
INSERT INTO pg_temp.reg_fx (name, id) VALUES
  ('G1', gen_random_uuid()), ('G2', gen_random_uuid()), ('gt', gen_random_uuid()),
  ('gA', gen_random_uuid()), ('gB', gen_random_uuid()), ('gC', gen_random_uuid()),
  ('gD', gen_random_uuid()), ('gE', gen_random_uuid());
INSERT INTO public.players (id, full_name, role, is_guest, gender)
SELECT id, 'Reg guest ' || name, 'player', name IN ('G1', 'G2'), 'Male'
  FROM pg_temp.reg_fx WHERE name IN ('G1', 'G2', 'gA', 'gB', 'gC', 'gD', 'gE');
INSERT INTO public.tournaments (id, name, year, status, created_by, categories, require_app_registration, format_family)
VALUES (pg_temp.reg_id('gt'), 'Reg guest claim test', 2026, 'upcoming', pg_temp.reg_id('host'),
        ARRAY['MS', 'MD'], true, 'OPEN_EVENT');

DO $$
DECLARE v jsonb;
BEGIN
  -- Form import: guest G1 paired with A in MD; G2 alone in MS.
  INSERT INTO public.tournament_participants (tournament_id, category, player_id, partner_id, seed, source)
  VALUES (pg_temp.reg_id('gt'), 'MD', pg_temp.reg_id('G1'), pg_temp.reg_id('gA'), 1, 'form'),
         (pg_temp.reg_id('gt'), 'MS', pg_temp.reg_id('G2'), NULL, 1, 'form');

  -- C registers MD in the app with B.
  v := pg_temp.reg_as('gC', format('SELECT (public.save_my_tournament_entries(%L::uuid, %L::jsonb)->''results''->0)::text',
         pg_temp.reg_id('gt'), jsonb_build_array(jsonb_build_object('category', 'MD', 'partner_id', pg_temp.reg_id('gB')))))::jsonb;
  PERFORM pg_temp.reg_check('C entered MD in the app', 'entered', v->>'status' || coalesce(' ' || (v->>'reason'), ''));

  -- 1. C claims G1: both already in MD, so the merge is refused (no double entry).
  PERFORM pg_temp.reg_fails('admin', 'claim of a guest entered in the same category is blocked', 'merge_blocked: .*history_conflict',
    format('SELECT public.merge_player_identity(%L::uuid, %L::uuid, %L, gen_random_uuid())::text',
      pg_temp.reg_id('G1'), pg_temp.reg_id('gC'), 'rehearsal'));
  PERFORM pg_temp.reg_check('G1 row unchanged after refused merge', '1',
    (SELECT count(*)::text FROM public.tournament_participants
      WHERE tournament_id = pg_temp.reg_id('gt') AND category = 'MD' AND player_id = pg_temp.reg_id('G1')));
  PERFORM pg_temp.reg_check('C still in one MD row', '1',
    (SELECT count(*)::text FROM public.tournament_participants
      WHERE tournament_id = pg_temp.reg_id('gt') AND category = 'MD' AND pg_temp.reg_id('gC') IN (player_id, partner_id)));

  -- 2. D claims G2: D isn't in MS, so the merge goes through and the row becomes D's.
  PERFORM pg_temp.reg_as('admin', format('SELECT public.merge_player_identity(%L::uuid, %L::uuid, %L, gen_random_uuid())::text',
    pg_temp.reg_id('G2'), pg_temp.reg_id('gD'), 'rehearsal'));
  PERFORM pg_temp.reg_check('claimed MS row now belongs to D', '1',
    (SELECT count(*)::text FROM public.tournament_participants
      WHERE tournament_id = pg_temp.reg_id('gt') AND category = 'MS' AND player_id = pg_temp.reg_id('gD')));
  PERFORM pg_temp.reg_check('guest G2 is gone', '0',
    (SELECT count(*)::text FROM public.players WHERE id = pg_temp.reg_id('G2')));
  PERFORM pg_temp.reg_check('no conflict recorded for D in MS', '0',
    (SELECT count(*)::text FROM public.tournament_registration_conflicts
      WHERE tournament_id = pg_temp.reg_id('gt') AND category = 'MS' AND shared_player_id = pg_temp.reg_id('gD') AND resolved_at IS NULL));

  PERFORM pg_temp.reg_check('D summary row lists MS and the guest row is gone', 'approved {MS} 0',
    (SELECT status || ' ' || categories::text FROM public.tournament_registrations
      WHERE tournament_id = pg_temp.reg_id('gt') AND player_id = pg_temp.reg_id('gD'))
    || ' ' || (SELECT count(*)::text FROM public.tournament_registrations
      WHERE tournament_id = pg_temp.reg_id('gt') AND player_id = pg_temp.reg_id('G2')));

  -- 3. D, now a real player, sees the claimed entry in My entry and cannot enter MS twice.
  v := pg_temp.reg_as('gD', format('SELECT (public.save_my_tournament_entries(%L::uuid, %L::jsonb)->''results''->0)::text',
         pg_temp.reg_id('gt'), jsonb_build_array(jsonb_build_object('category', 'MS')))) ::jsonb;
  PERFORM pg_temp.reg_check('D sees the claimed MS entry as already theirs', 'unchanged', v->>'status');
  PERFORM pg_temp.reg_check('D saving MS again keeps one row', '1',
    (SELECT count(*)::text FROM public.tournament_participants
      WHERE tournament_id = pg_temp.reg_id('gt') AND category = 'MS' AND pg_temp.reg_id('gD') IN (player_id, partner_id)));

  -- 4. An organiser row that duplicates a player still raises one conflict for the host.
  INSERT INTO public.tournament_participants (tournament_id, category, player_id, partner_id, seed, source)
  VALUES (pg_temp.reg_id('gt'), 'MD', pg_temp.reg_id('gE'), pg_temp.reg_id('gC'), 9, 'form');
  PERFORM pg_temp.reg_check('form row duplicating C records one conflict', '1',
    (SELECT count(*)::text FROM public.tournament_registration_conflicts
      WHERE tournament_id = pg_temp.reg_id('gt') AND category = 'MD' AND shared_player_id = pg_temp.reg_id('gC') AND resolved_at IS NULL));
END $$;

SELECT 'registration_guest_claim_assertions: ' || n || ' checks passed' AS result FROM pg_temp.reg_passed;
