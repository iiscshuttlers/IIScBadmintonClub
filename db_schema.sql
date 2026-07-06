CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  status text DEFAULT 'active',
  created_by uuid REFERENCES auth.users
);

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  tournament_slug text,
  category text,
  status text DEFAULT 'completed',
  team1_label text,
  team2_label text,
  winner_side int,
  score text,
  sets_history jsonb,
  match_state jsonb,
  kudos_users jsonb DEFAULT '[]'::jsonb,
  video_url text,
  is_live boolean DEFAULT false,
  is_friendly boolean DEFAULT false,
  umpire_user_id uuid REFERENCES auth.users
);

CREATE TABLE public.admin_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  admin_id uuid REFERENCES auth.users,
  action_type text NOT NULL,
  entity_id uuid,
  entity_type text,
  label text,
  before_state jsonb,
  after_state jsonb
);

CREATE TABLE public.site_data ( 
    key text PRIMARY KEY, 
    value jsonb, 
    updated_at timestamp with time zone DEFAULT now() NOT NULL 
); 
 
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_data ENABLE ROW LEVEL SECURITY; 

CREATE POLICY "Public can read active tournaments" ON public.tournaments FOR SELECT USING (status != 'deleted');
CREATE POLICY "Authenticated users can manage tournaments" ON public.tournaments FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can read matches" ON public.tournament_matches FOR SELECT USING (status != 'deleted');
CREATE POLICY "Authenticated users can manage matches" ON public.tournament_matches FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can read admin history" ON public.admin_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert admin history" ON public.admin_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public can read site data" ON public.site_data FOR SELECT USING (true); 
CREATE POLICY "Admins can manage site data" ON public.site_data FOR ALL USING (auth.uid() IS NOT NULL); 

CREATE OR REPLACE FUNCTION public.umpire_submit_match(
  match_category text,
  team1_label text,
  team2_label text,
  match_score text,
  winner_side int,
  sets_history jsonb,
  tournament_slug text,
  is_friendly boolean DEFAULT false
) RETURNS uuid AS $$
DECLARE
  new_id uuid;
  t_id uuid;
BEGIN
  IF tournament_slug IS NOT NULL THEN
    SELECT id INTO t_id FROM public.tournaments WHERE slug = tournament_slug LIMIT 1;
  END IF;

  INSERT INTO public.tournament_matches (
    category,
    team1_label,
    team2_label,
    score,
    winner_side,
    sets_history,
    tournament_slug,
    tournament_id,
    umpire_user_id,
    status,
    is_friendly
  ) VALUES (
    match_category,
    team1_label,
    team2_label,
    match_score,
    winner_side,
    sets_history,
    tournament_slug,
    t_id,
    auth.uid(),
    'completed',
    is_friendly
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
