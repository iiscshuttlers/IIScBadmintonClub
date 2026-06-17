-- Table for storing Capacitor Push Notification tokens
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token)
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can update their own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can view their own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Service role can view all tokens for push triggers" ON public.user_push_tokens;

CREATE POLICY "Users can insert their own push tokens"
ON public.user_push_tokens FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
ON public.user_push_tokens FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own push tokens"
ON public.user_push_tokens FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can view all tokens for push triggers"
ON public.user_push_tokens FOR SELECT
TO service_role
USING (true);
