-- Schema v2 — rodar no Supabase SQL Editor

-- leads: suporte a recorrência
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subscription_status text; -- null | active | cancelled
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subscription_stripe_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz;

-- diagnoses: sazonalidade, macro, B2B/B2G
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS seasonality jsonb;
-- formato: { months: [{ month: string, volume: number }], peak_month: string, low_month: string }
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS macro_context jsonb;
-- formato: { summary: string, indicators: [] }
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS b2b_targets jsonb;
-- formato: { companies: [], status: "preview" }
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS b2g_tenders jsonb;
-- formato: { tenders: [], status: "preview" }

-- nova tabela: checklist de melhorias
CREATE TABLE IF NOT EXISTS checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklists_lead_id ON checklists(lead_id);
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública" ON checklists FOR SELECT USING (true);
CREATE POLICY "Insert apenas service role" ON checklists FOR INSERT WITH CHECK (false);
CREATE POLICY "Update apenas service role" ON checklists FOR UPDATE USING (false);
