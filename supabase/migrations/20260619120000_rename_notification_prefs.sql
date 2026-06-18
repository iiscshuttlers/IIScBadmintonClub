-- Migration: Rename old notification preference columns to match the new channel architecture

DO $$ 
BEGIN 
  -- Rename pref_notify_friendly -> pref_notify_smash (Match notifications)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='pref_notify_friendly') THEN
    ALTER TABLE public.players RENAME COLUMN pref_notify_friendly TO pref_notify_smash;
  END IF;

  -- Rename pref_notify_confirmation -> pref_notify_point (Match confirmations)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='pref_notify_confirmation') THEN
    ALTER TABLE public.players RENAME COLUMN pref_notify_confirmation TO pref_notify_point;
  END IF;

  -- Rename pref_notify_challenges -> pref_notify_serve (Match requests/pings)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='pref_notify_challenges') THEN
    ALTER TABLE public.players RENAME COLUMN pref_notify_challenges TO pref_notify_serve;
  END IF;

  -- Rename pref_notify_announcements -> pref_notify_whistle (Announcements & Live)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='pref_notify_announcements') THEN
    ALTER TABLE public.players RENAME COLUMN pref_notify_announcements TO pref_notify_whistle;
  END IF;

  -- Rename pref_notify_elo_milestone -> pref_notify_victory (Achievements & Milestones)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='pref_notify_elo_milestone') THEN
    ALTER TABLE public.players RENAME COLUMN pref_notify_elo_milestone TO pref_notify_victory;
  END IF;

  -- (Optional) If you want to drop the deprecated columns that are no longer used:
  -- ALTER TABLE public.players DROP COLUMN IF EXISTS pref_notify_tournament;
  -- ALTER TABLE public.players DROP COLUMN IF EXISTS pref_notify_find_lost;
  -- ALTER TABLE public.players DROP COLUMN IF EXISTS pref_notify_buddy_status;

END $$;
