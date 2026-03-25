CREATE TABLE IF NOT EXISTS production_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('reels', 'carrossel', 'foto_unica', 'stories_sequencia')),
  strategic_intent TEXT,
  purchase_journey_stage TEXT,
  temporal_hook TEXT,
  script JSONB NOT NULL DEFAULT '{}',
  visual_direction JSONB NOT NULL DEFAULT '{}',
  production_notes JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, week_number, title)
);

CREATE INDEX IF NOT EXISTS idx_production_briefs_lead_id ON production_briefs(lead_id);
CREATE INDEX IF NOT EXISTS idx_production_briefs_week ON production_briefs(lead_id, week_number);
