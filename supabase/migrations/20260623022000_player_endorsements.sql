-- Migration for Player Endorsements System (Phase 2)

CREATE TABLE IF NOT EXISTS public.player_endorsements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    endorsed_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    endorser_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('skill', 'behavior')),
    trait TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Ensure exactly one vote per category per opponent
    CONSTRAINT unique_endorsement_per_category UNIQUE(endorser_id, endorsed_player_id, category)
);

-- Enable RLS
ALTER TABLE public.player_endorsements ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Anyone can read endorsements (for aggregating counts on profiles)
CREATE POLICY "Endorsements are viewable by everyone"
    ON public.player_endorsements FOR SELECT
    USING (true);

-- 2. Authenticated users can insert their own endorsements
CREATE POLICY "Users can insert their own endorsements"
    ON public.player_endorsements FOR INSERT
    WITH CHECK (
        endorser_id = auth.uid()
    );

-- 3. Users can update their own endorsements (e.g., swapping their vote)
CREATE POLICY "Users can update their own endorsements"
    ON public.player_endorsements FOR UPDATE
    USING (
        endorser_id = auth.uid()
    )
    WITH CHECK (
        endorser_id = auth.uid()
    );

-- 4. Users can delete their own endorsements
CREATE POLICY "Users can delete their own endorsements"
    ON public.player_endorsements FOR DELETE
    USING (
        endorser_id = auth.uid()
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_endorsements_endorsed ON public.player_endorsements(endorsed_player_id);
CREATE INDEX IF NOT EXISTS idx_player_endorsements_endorser ON public.player_endorsements(endorser_id);

-- RPC for Upserting Endorsements safely without needing to know the ID
CREATE OR REPLACE FUNCTION upsert_player_endorsement(
    p_endorsed_player_id UUID,
    p_endorser_id UUID,
    p_category TEXT,
    p_trait TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.player_endorsements (endorsed_player_id, endorser_id, category, trait)
    VALUES (p_endorsed_player_id, p_endorser_id, p_category, p_trait)
    ON CONFLICT (endorser_id, endorsed_player_id, category)
    DO UPDATE SET 
        trait = EXCLUDED.trait,
        created_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
