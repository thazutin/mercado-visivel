-- ============================================================================
-- Virô — Feedback table
-- Coleta feedback do usuário em diferentes trigger points da jornada
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  trigger_point text NOT NULL,
  rating integer,
  rating_type text CHECK (rating_type IN ('stars', 'nps', 'boolean')),
  comment text,
  metadata jsonb DEFAULT '{}',
  CONSTRAINT feedback_lead_trigger_unique UNIQUE (lead_id, trigger_point)
);

CREATE INDEX IF NOT EXISTS feedback_lead_id_idx ON feedback (lead_id);
CREATE INDEX IF NOT EXISTS feedback_trigger_point_idx ON feedback (trigger_point);
