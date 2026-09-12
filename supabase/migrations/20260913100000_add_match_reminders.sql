-- Migration to add match reminders features

-- 1. Add default preference to players
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS default_match_reminder_mins INTEGER DEFAULT NULL;

-- 2. Create the per-match reminder overrides and logs table
CREATE TABLE IF NOT EXISTS public.match_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    remind_before_mins INTEGER NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, user_id)
);

-- Enable RLS
ALTER TABLE public.match_reminders ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for match_reminders
CREATE POLICY "Users can view their own match reminders" 
ON public.match_reminders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match reminders" 
ON public.match_reminders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own match reminders" 
ON public.match_reminders FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own match reminders" 
ON public.match_reminders FOR DELETE 
USING (auth.uid() = user_id);
