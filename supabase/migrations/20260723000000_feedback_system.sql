-- Create the user_feedback table
CREATE TABLE IF NOT EXISTS public.user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'general')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Set up Row Level Security
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_feedback' AND policyname = 'Users can insert their own feedback'
  ) THEN
    DROP POLICY IF EXISTS "Users can insert their own feedback" ON user_feedback;
CREATE POLICY "Users can insert their own feedback" ON user_feedback
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Allow users to view their own feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_feedback' AND policyname = 'Users can view their own feedback'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their own feedback" ON user_feedback;
CREATE POLICY "Users can view their own feedback" ON user_feedback
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow admins and master_admins to view all feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_feedback' AND policyname = 'Admins can view all feedback'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all feedback" ON user_feedback;
CREATE POLICY "Admins can view all feedback" ON user_feedback
    FOR SELECT 
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.players 
        WHERE players.id = auth.uid() 
        AND players.role IN ('admin', 'master_admin')
      )
    );
  END IF;
END $$;

-- Allow admins and master_admins to update all feedback (e.g., status)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_feedback' AND policyname = 'Admins can update all feedback'
  ) THEN
    DROP POLICY IF EXISTS "Admins can update all feedback" ON user_feedback;
CREATE POLICY "Admins can update all feedback" ON user_feedback
    FOR UPDATE 
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.players 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'master_admin')
      )
    );
  END IF;
END $$;

-- Grant privileges
GRANT ALL ON TABLE public.user_feedback TO authenticated;
GRANT ALL ON TABLE public.user_feedback TO service_role;
