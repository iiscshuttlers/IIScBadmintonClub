\set ON_ERROR_STOP on

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT set_config('request.jwt.claim.email', 'admin@example.test', false);

INSERT INTO public.players (id, full_name, role, is_guest)
VALUES ('00000000-0000-0000-0000-0000000000c3', 'Reversible Guest', 'player', true);
INSERT INTO public.player_badges (player_id)
VALUES ('00000000-0000-0000-0000-0000000000c3');

SELECT public.merge_player_identity(
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000b1',
  'Verified reversible merge test',
  '90000000-0000-0000-0000-000000000001'
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-0000-0000-0000-0000000000c3') THEN
    RAISE EXCEPTION 'merge did not remove guest';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_badges WHERE player_id = '00000000-0000-0000-0000-0000000000b1') THEN
    RAISE EXCEPTION 'merge did not move badge';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_identity_merge_moves WHERE operation_id = '90000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'merge did not record exact move ledger';
  END IF;
END $$;

SELECT public.reverse_player_identity_merge(
  '90000000-0000-0000-0000-000000000001',
  'Reversal assertion'
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = '00000000-0000-0000-0000-0000000000c3' AND is_guest) THEN
    RAISE EXCEPTION 'reversal did not restore guest';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_badges WHERE player_id = '00000000-0000-0000-0000-0000000000c3') THEN
    RAISE EXCEPTION 'reversal did not restore badge reference';
  END IF;
  IF EXISTS (SELECT 1 FROM public.player_aliases WHERE old_player_id = '00000000-0000-0000-0000-0000000000c3') THEN
    RAISE EXCEPTION 'reversal left redirect alias active';
  END IF;
END $$;

INSERT INTO public.player_claim_requests (guest_id, requester_id, evidence)
VALUES ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b1', 'Verified evidence for rejection');
UPDATE public.player_claim_requests
SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = 'Not enough proof'
WHERE guest_id = '00000000-0000-0000-0000-0000000000c3' AND status = 'pending';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000000b1' AND type = 'player_claim_rejected'
  ) THEN
    RAISE EXCEPTION 'claim decision notification was not created';
  END IF;
END $$;

INSERT INTO public.tournament_registrations
  (id, tournament_id, player_id, full_name, status)
VALUES
  ('91000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b1', 'Asha Rao', 'pending');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
DO $$ BEGIN
  BEGIN
    UPDATE public.tournament_registrations SET status = 'approved'
    WHERE id = '91000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'registrant self-approval unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
UPDATE public.tournament_registrations SET status = 'withdrawn'
WHERE id = '91000000-0000-0000-0000-000000000001';
RESET ROLE;

SELECT 'remaining identity decisions assertions passed' AS result;
