\set ON_ERROR_STOP on

-- Minimal legacy table required by upsert_live_match_by_id. The result
-- revision bootstrap intentionally covers only tournament result tables.
CREATE TABLE IF NOT EXISTS public.site_data (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb
);

