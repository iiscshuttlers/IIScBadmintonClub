-- ============================================================
-- Migration: Add gender column to players table
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS gender TEXT;
