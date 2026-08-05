-- Migration for automated match notifications

-- 1. Add auto_reminders_enabled to tournaments
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS auto_reminders_enabled BOOLEAN DEFAULT false;

-- 2. Add reminder_sent to tournament_matches
ALTER TABLE public.tournament_matches 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
