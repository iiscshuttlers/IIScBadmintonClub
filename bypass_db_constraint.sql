-- Run this in your Supabase SQL Editor to temporarily remove the strict IISc email domain constraint 
-- so you can test using a personal Gmail account!

ALTER TABLE players 
DROP CONSTRAINT IF EXISTS enforce_iisc_domain;
