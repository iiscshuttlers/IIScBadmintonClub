# Resolve Duplicate Profile (Recurrence Issue) Plan

## Background & Root Cause
Many users are encountering the **"Duplicate profile: A profile with this email or name already exists!"** error when they attempt to click "Save & Enter Club" on the profile setup page.

**Why this happens:**
1. An admin previously imported or bulk-added these players into the database (so they could be added to tournaments or matches). When admins do this, the database creates a `players` row with a random ID.
2. The player logs in for the first time using Google Auth. Supabase Auth creates a brand new `auth.users` identity (with a new ID) and the database automatically creates a new `players` row for that ID.
3. The player fills out the setup form with their email or name.
4. When they click save, the system tries to update the NEW row. It crashes into a `UNIQUE` constraint because the old admin-created row already holds that `iisc_email` or `full_name`.

## Proposed Solution: Auto-Claim System
Instead of forcing users to contact admins or deleting the old data, we will build an automated "Profile Claim" pipeline. When a user logs in and encounters a duplicate, the system will detect their email and seamlessly **merge** the old admin-created profile into their new Google-authenticated profile.

### Security
- It **does NOT** trust the frontend. It strictly reads the user's verified identity directly from the auth token (`auth.jwt() ->> 'email'`). 
- Because it relies on Supabase Auth's Google/Magic Link verification, **it is impossible to hijack a profile** by just typing someone else's email into the setup form.

### Proposed Changes

#### 1. Backend Migration (New SQL RPC)
Create a new migration `auto_claim_duplicate_profile.sql` that introduces a highly secure Postgres function:
- It finds the duplicate admin-created `players` row using this secure, verified email.
- Safely transfers all foreign-key references (e.g. `matches`, `tournament_registrations`, `elo_logs`) to the new authenticated `auth.uid()`.
- Deletes the old zombie row.

#### 2. Frontend Integration (`useProfileSetup.tsx`)
- When the `23505` (Unique Violation) error occurs, the frontend will intercept it.
- It will execute the new `auto_claim_profile()` RPC.
- If successful, it will reload their true profile data and seamlessly let them into the app.
- If it fails, it will display a helpful fallback message instead of a generic database error.
