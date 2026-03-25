-- Migration: add hook and strategic_intent to generated_contents
ALTER TABLE generated_contents ADD COLUMN IF NOT EXISTS hook TEXT;
ALTER TABLE generated_contents ADD COLUMN IF NOT EXISTS strategic_intent TEXT;
