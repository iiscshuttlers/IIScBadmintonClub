-- Migration: Wipe manual legacy stats for all users
-- This forces the app to compute match history and win-loss records purely from actual match data.
-- We carefully preserve the 'media' field in the stats JSONB column, as it contains the player's gallery photos.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'win_loss_record') THEN
    EXECUTE 'UPDATE players SET win_loss_record = NULL';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'singles_record') THEN
    EXECUTE 'UPDATE players SET singles_record = NULL';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'doubles_record') THEN
    EXECUTE 'UPDATE players SET doubles_record = NULL';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'mixed_record') THEN
    EXECUTE 'UPDATE players SET mixed_record = NULL';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'stats') THEN
    EXECUTE 'UPDATE players SET stats = CASE WHEN stats IS NOT NULL THEN stats - ''wins'' - ''losses'' - ''winPercentage'' - ''totalMatches'' - ''currentStreak'' - ''longestWinStreak'' - ''titlesWon'' - ''runnerUp'' - ''semifinals'' - ''categoryStats'' ELSE NULL END';
  END IF;
END $$;
