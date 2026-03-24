-- Migration: add image_url to generated_contents
ALTER TABLE generated_contents ADD COLUMN IF NOT EXISTS image_url text;
