-- Schema v2 — rodar no Supabase SQL Editor

-- leads: sales channel (from form)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sales_channel text; -- loja_fisica, online, servico, marketplace, direto

-- leads: blueprint + growth machine (radar de crescimento)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS blueprint_id text; -- ex: restaurante_food, b2b_servicos
ALTER TABLE leads ADD COLUMN IF NOT EXISTS growth_machine jsonb; -- resultado da máquina de crescimento

-- leads: rastreamento de emails lifecycle
ALTER TABLE leads ADD COLUMN IF NOT EXISTS welcome_email_sent boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS churn_email_sent_at timestamptz; -- null = nunca enviou
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reengagement_email_sent_at timestamptz; -- null = nunca enviou
ALTER TABLE leads ADD COLUMN IF NOT EXISTS trial_expiry_email_sent boolean DEFAULT false;

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

-- nova tabela: co-pilot de respostas a reviews do Google
CREATE TABLE IF NOT EXISTS review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  external_review_id text NOT NULL, -- sha1(author + date + text.slice(0,50))
  author_name text,
  rating int,
  review_text text,
  review_date timestamptz,
  has_owner_response boolean DEFAULT false,
  draft_response text,
  status text DEFAULT 'pending', -- pending | copied | dismissed
  week_number int, -- pra agrupar na aba semanal (ISO week)
  created_at timestamptz NOT NULL DEFAULT now(),
  copied_at timestamptz,
  UNIQUE(lead_id, external_review_id)
);
CREATE INDEX IF NOT EXISTS idx_review_responses_lead_id ON review_responses(lead_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_lead_status ON review_responses(lead_id, status);
CREATE INDEX IF NOT EXISTS idx_review_responses_lead_week ON review_responses(lead_id, week_number);
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública review_responses" ON review_responses FOR SELECT USING (true);
CREATE POLICY "Insert apenas service role review_responses" ON review_responses FOR INSERT WITH CHECK (false);
CREATE POLICY "Update apenas service role review_responses" ON review_responses FOR UPDATE USING (false);
