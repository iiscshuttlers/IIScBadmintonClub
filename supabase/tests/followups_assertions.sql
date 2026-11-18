\set ON_ERROR_STOP on
-- Assertions for 20261115110000_correction_and_merge_followups.sql (sections 2–3).
-- Order: identity_bootstrap → 20261113160000 → followups_setup → 20261115110000 → this file.

-- 2. Merge relabels whole name parts only, and reversal (alias delete) restores.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
UPDATE public.players SET full_name = 'Asha Rao (guest)' WHERE id = '00000000-0000-0000-0000-0000000000c1';
DO $$ BEGIN
  PERFORM public.merge_player_identity('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1',
    'Verified in person', 'f0000000-0000-0000-0000-000000000001');
  IF (SELECT team2_label FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001')
     <> 'Asha Rao & Ashank' THEN
    RAISE EXCEPTION 'label not relabelled: %', (SELECT team2_label FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001');
  END IF;
  IF (SELECT team1_label FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001') <> 'Bina' THEN
    RAISE EXCEPTION 'opponent label touched';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM player_merge_label_changes WHERE old_player_id = '00000000-0000-0000-0000-0000000000c1') THEN
    RAISE EXCEPTION 'label change not recorded';
  END IF;
END $$;

-- "Ash" must not rewrite "Ashank" (checked on the label helper directly).
SELECT set_config('request.jwt.claim.sub', '', false);
RESET ROLE;
DO $$
BEGIN
  IF public._swap_label_name('Ash & Ashank', 'Ash', 'Asha Rao') <> 'Asha Rao & Ashank' THEN
    RAISE EXCEPTION 'whole-part swap wrong';
  END IF;
  IF public._swap_label_name('Ashank & Bina', 'Ash', 'Asha Rao') <> 'Ashank & Bina' THEN
    RAISE EXCEPTION 'substring was replaced';
  END IF;
  IF public._swap_label_name('Ashank&Bina', 'Ash', 'X') <> 'Ashank&Bina' THEN
    RAISE EXCEPTION 'label reformatted without a match';
  END IF;
END $$;

-- Reversal: deleting the alias restores labels nobody edited since.
ALTER TABLE public.player_aliases DISABLE TRIGGER player_aliases_protect;
DELETE FROM public.player_aliases WHERE old_player_id = '00000000-0000-0000-0000-0000000000c1';
ALTER TABLE public.player_aliases ENABLE TRIGGER player_aliases_protect;
DO $$ BEGIN
  IF (SELECT team2_label FROM tournament_matches WHERE id = '20000000-0000-0000-0000-000000000001')
     <> 'Asha Rao (guest) & Ashank' THEN
    RAISE EXCEPTION 'label not restored on reversal';
  END IF;
END $$;

-- 3. Claims: anon cannot call; caller identity is enforced; contact goes to the restricted column.
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.claim_find_lost_item('70000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-0000000000b1'::uuid, 'Spoof', 'x', '999');
    RAISE EXCEPTION 'anon claimed an item';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.claim_find_lost_item('70000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-0000000000a1'::uuid, 'Admin', 'x', '999');
    RAISE EXCEPTION 'claimed in someone else''s name';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  PERFORM public.claim_find_lost_item('70000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-0000000000b1'::uuid, 'Whatever', 'It is mine', '98765');
END $$;
RESET ROLE;
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM public.find_lost_posts WHERE id = '70000000-0000-0000-0000-000000000001';
  IF r.claimed_by_id <> '00000000-0000-0000-0000-0000000000b1' OR r.claimed_by_name <> 'Asha Rao'
     OR r.claim_contact <> '98765' OR r.claim_contact_info IS NOT NULL THEN
    RAISE EXCEPTION 'claim stored wrong: %', r;
  END IF;
END $$;

-- A bystander (admin id spoof via user_id) cannot undo it; the author can.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.unclaim_find_lost_item('70000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-0000000000b2'::uuid);
    RAISE EXCEPTION 'bystander undid a claim by passing the author id';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM public.unclaim_find_lost_item('70000000-0000-0000-0000-000000000001'::uuid, NULL::uuid);
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT resolved FROM public.find_lost_posts WHERE id = '70000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'author could not undo the claim';
  END IF;
END $$;

SELECT 'follow-up (labels, claims) assertions passed' AS result;
