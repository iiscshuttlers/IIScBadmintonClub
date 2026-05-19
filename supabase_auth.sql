-- 1. Link Player Profiles to Secure Authentication Accounts
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Enforce Unique Emails (Anti-Duplication!)
ALTER TABLE players ADD CONSTRAINT players_email_key UNIQUE (email);

-- 3. Enable Secure Profile Management (RLS Policies)
-- Allow authenticated users to create their own profile
CREATE POLICY "Users can create their own profile" ON players 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to edit their own profile
CREATE POLICY "Users can update their own profile" ON players 
  FOR UPDATE USING (auth.uid() = user_id);
