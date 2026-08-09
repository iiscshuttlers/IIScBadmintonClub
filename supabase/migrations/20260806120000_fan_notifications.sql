-- Migration for Fan Match Notifications and Player Subscriptions

CREATE TABLE public.user_match_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id uuid REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    notify_before_mins int DEFAULT 15,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, match_id)
);

-- Enable RLS
ALTER TABLE public.user_match_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own match notifications"
ON public.user_match_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match notifications"
ON public.user_match_notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own match notifications"
ON public.user_match_notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own match notifications"
ON public.user_match_notifications FOR DELETE
USING (auth.uid() = user_id);

-- Subscriptions Table
CREATE TABLE public.user_player_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
    notify_before_mins int DEFAULT 15,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, player_id)
);

-- Enable RLS
ALTER TABLE public.user_player_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own player subscriptions"
ON public.user_player_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own player subscriptions"
ON public.user_player_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own player subscriptions"
ON public.user_player_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own player subscriptions"
ON public.user_player_subscriptions FOR DELETE
USING (auth.uid() = user_id);


-- Sent Notifications tracking
CREATE TABLE public.sent_fan_notifications (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id uuid REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY(user_id, match_id)
);

-- This table is primarily used by the edge function which bypasses RLS, but we enable RLS just in case
ALTER TABLE public.sent_fan_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sent notifications"
ON public.sent_fan_notifications FOR SELECT
USING (auth.uid() = user_id);

-- Optional: Edge functions run with service role, so they bypass RLS anyway.
