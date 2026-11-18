\set ON_ERROR_STOP on
-- Extra tables for participant_claim_privacy_assertions.sql (after contact_privacy_bootstrap.sql).
CREATE TABLE public.tournament_participants (
  id uuid PRIMARY KEY, tournament_id uuid, category text, player_id uuid, partner_id uuid,
  display_name text, seed int, created_at timestamptz DEFAULT now(), entry_round int, email text);
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_public_read ON public.tournament_participants FOR SELECT USING (true);
GRANT SELECT ON public.tournament_participants TO anon, authenticated;

CREATE TABLE public.find_lost_posts (
  id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), author_id uuid, type text, title text,
  description text, location text, contact text, image_urls text[], resolved boolean, claimed_by_id uuid,
  claimed_by_name text, image_url text, updated_at timestamptz, claimed_at timestamptz, claim_message text,
  remarks text, claim_contact text, claim_msg text, claim_contact_info text);
ALTER TABLE public.find_lost_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read find_lost_posts" ON public.find_lost_posts FOR SELECT USING (true);
GRANT SELECT ON public.find_lost_posts TO anon, authenticated;

INSERT INTO public.tournament_participants (id, tournament_id, category, player_id, display_name, email) VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'MS',
   '00000000-0000-0000-0000-0000000000b1', 'Asha', 'asha@x.test');
-- Asha lost an item; Bina claimed it and left a phone number.
INSERT INTO public.find_lost_posts (id, author_id, type, title, contact, resolved, claimed_by_id, claimed_by_name, claim_contact) VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'lost', 'Racket', NULL, true,
   '00000000-0000-0000-0000-0000000000b2', 'Bina', '98765');
