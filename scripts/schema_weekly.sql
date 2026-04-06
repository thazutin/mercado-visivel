-- Migration: Add week_number and generation_date to generated_contents
-- Run in Supabase SQL Editor

ALTER TABLE generated_contents
  ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS generation_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_generated_contents_week
ON generated_contents(lead_id, week_number);

-- Don't delete old contents anymore — historical tracking
