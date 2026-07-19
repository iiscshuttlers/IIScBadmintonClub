-- Heart rate variability and blood oxygen, synced from Health Connect alongside
-- heart rate/steps/calories in match_health_data.
ALTER TABLE match_health_data
  ADD COLUMN IF NOT EXISTS hrv_avg NUMERIC,
  ADD COLUMN IF NOT EXISTS spo2_avg NUMERIC,
  ADD COLUMN IF NOT EXISTS spo2_min NUMERIC;
