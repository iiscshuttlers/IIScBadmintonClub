\set ON_ERROR_STOP on
-- Extra schema for followups_assertions.sql. Run after identity_bootstrap.sql
-- and 20261113160000_add_player_identity_claims_and_merge.sql.
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS team1_label text, ADD COLUMN IF NOT EXISTS team2_label text;
UPDATE public.tournament_matches SET team1_label = 'Bina', team2_label = 'Asha Rao (guest) & Ashank';

-- A second guest whose name is a prefix of another player's name.
INSERT INTO public.players (id, full_name, role, is_guest) VALUES
  ('00000000-0000-0000-0000-0000000000c3', 'Ash', 'player', true);
INSERT INTO public.tournament_matches (id, player1_id, player2_id, winner_id, status, team1_label, team2_label) VALUES
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2',
   NULL, 'scheduled', 'Ash & Ashank', 'Bina');

-- Lost-and-found with the legacy (insecure) RPC overloads as found in production.
CREATE TABLE public.find_lost_posts (
  id uuid PRIMARY KEY, author_id uuid, resolved boolean DEFAULT false, claimed_by_id uuid, claimed_by_name text,
  claimed_at timestamptz, claim_message text, claim_msg text, claim_contact text, claim_contact_info text);
INSERT INTO public.find_lost_posts (id, author_id) VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2');
CREATE FUNCTION public.claim_find_lost_item(post_uuid uuid, claimer_id uuid, claimer_name text, claim_msg text, claim_contact_info text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
  UPDATE public.find_lost_posts SET resolved = true, claimed_by_id = claimer_id, claimed_by_name = claimer_name,
    claim_message = claim_msg, claim_contact = claim_contact_info WHERE id = post_uuid; END $$;
CREATE FUNCTION public.claim_find_lost_item(post_uuid uuid, claimer_id uuid, claimer_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
  UPDATE public.find_lost_posts SET resolved = true, claimed_by_id = claimer_id WHERE id = post_uuid; END $$;
CREATE FUNCTION public.claim_find_lost_item(post_uuid uuid, claimer_id uuid, claimer_name text, claim_msg text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
  UPDATE public.find_lost_posts SET resolved = true, claimed_by_id = claimer_id WHERE id = post_uuid; END $$;
CREATE FUNCTION public.claim_find_lost_item(post_uuid uuid, claimer_id text, claimer_name text, claim_msg text, claim_contact_info text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
  UPDATE public.find_lost_posts SET resolved = true, claimed_by_id = auth.uid(), claim_contact_info = claim_contact_info WHERE id = post_uuid; END $$;
CREATE FUNCTION public.unclaim_find_lost_item(post_uuid uuid, user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
  UPDATE public.find_lost_posts SET resolved = false, claimed_by_id = NULL WHERE id = post_uuid AND (claimed_by_id = user_id); END $$;
CREATE FUNCTION public.unclaim_find_lost_item(post_uuid uuid, user_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
  UPDATE public.find_lost_posts SET resolved = false WHERE id = post_uuid; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
