-- Migration: add radius_km to diagnoses
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS radius_km integer;
