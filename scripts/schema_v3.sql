-- ============================================================================
-- Schema v3 — Conversa semanal, memória do negócio e sinais
-- Rodar no Supabase SQL Editor após schema_v2.sql.
-- ============================================================================
--
-- O que entra aqui:
--   1) leads: opt-in WhatsApp + cadência configurável + pausa temporária
--   2) weekly_cycles: estado do ciclo semanal (planned → opened → closed)
--   3) conversations + messages: histórico do WhatsApp por ciclo
--   4) business_memory: o ativo — aprendizados destilados, append-only
--   5) weekly_signals: snapshot semanal de macro + concorrentes + próprio negócio
--
-- Coerência: weekly_cycles.linked_pillar_id e business_memory.linked_pillar_id
-- amarram cada ciclo/aprendizado a um dos 3 pilares do diagnóstico inicial.
-- ============================================================================

-- ─── LEADS — opt-in WhatsApp + cadência ────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_optin boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_optin_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_optout_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cadence_preference text DEFAULT 'weekly';
  -- 'weekly' | 'biweekly' | 'monthly'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cadence_paused_until timestamptz;
  -- usuário pode pausar X semanas via comando WhatsApp ("PAUSA")

-- ─── WEEKLY_CYCLES — estado do ciclo semanal ───────────────────────────────
-- Um ciclo por lead × semana ISO. Carrega o tema, ação prioritária e outcome.
CREATE TABLE IF NOT EXISTS weekly_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  week_iso text NOT NULL,                -- "2026-W20"

  -- Tema curto (entra no template Meta) + descrição rica (contexto do bot)
  theme_short text NOT NULL,             -- ≤25 chars, slot {{2}} do template
  theme_full text NOT NULL,
  theme_category text NOT NULL,          -- credibilidade | discoverability | conteudo | experiencia | operacao

  -- Coerência com o diagnóstico inicial
  linked_pillar_id text,                 -- "pilar-1" | "pilar-2" | "pilar-3" do growth_machine
  parent_cycle_id uuid REFERENCES weekly_cycles(id),  -- ciclo do qual este evolui
  evolution_step int DEFAULT 1,          -- complexidade crescente dentro do mesmo pilar

  -- Ação executável da semana (texto pronto)
  priority_action jsonb NOT NULL,        -- { title, why_now, how_to, copy_blocks: [...], measure_on_thursday: [...] }
  priority_reason jsonb,                 -- { signals_used: [...], evolution_from_last: "..." }

  -- Estado do ciclo
  status text NOT NULL DEFAULT 'planned',  -- planned | opened | engaged | checked | closed | abandoned
  opened_at timestamptz,                   -- quando template 6ª foi enviado
  user_engaged_at timestamptz,             -- primeira resposta do user
  checked_at timestamptz,                  -- template 3ª enviado
  closed_at timestamptz,                   -- template 5ª enviado

  -- Aprendizado capturado no fechamento
  outcome jsonb,                           -- { executed: bool, learnings: [], obstacles: [], next: [], user_feedback: "" }
  measured_deltas jsonb,                   -- { ig_reach_delta, reviews_added, score_delta }

  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, week_iso)
);
CREATE INDEX IF NOT EXISTS idx_weekly_cycles_lead_id ON weekly_cycles(lead_id);
CREATE INDEX IF NOT EXISTS idx_weekly_cycles_status ON weekly_cycles(status);
CREATE INDEX IF NOT EXISTS idx_weekly_cycles_lead_week ON weekly_cycles(lead_id, week_iso);

ALTER TABLE weekly_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública weekly_cycles" ON weekly_cycles FOR SELECT USING (true);
CREATE POLICY "Insert apenas service role weekly_cycles" ON weekly_cycles FOR INSERT WITH CHECK (false);
CREATE POLICY "Update apenas service role weekly_cycles" ON weekly_cycles FOR UPDATE USING (false);

-- ─── CONVERSATIONS — uma por ciclo (WhatsApp) ──────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  weekly_cycle_id uuid REFERENCES weekly_cycles(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'active',     -- active | closed | paused
  meta_window_expires_at timestamptz,        -- janela 24h Meta — fora dela só template
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_cycle ON conversations(weekly_cycle_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública conversations" ON conversations FOR SELECT USING (true);
CREATE POLICY "Insert apenas service role conversations" ON conversations FOR INSERT WITH CHECK (false);
CREATE POLICY "Update apenas service role conversations" ON conversations FOR UPDATE USING (false);

-- ─── MESSAGES — histórico bruto da conversa ───────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction text NOT NULL,                -- in | out
  body text,
  media jsonb,                            -- [{ url, type, transcript? }]
  template_sid text,                      -- se outbound foi template Meta aprovado
  template_vars jsonb,
  claude_meta jsonb,                      -- { model, tokens_in, tokens_out, latency_ms }
  twilio_sid text,                        -- ID retornado pelo Twilio
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(conversation_id, created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Insert apenas service role messages" ON messages FOR INSERT WITH CHECK (false);
CREATE POLICY "Update apenas service role messages" ON messages FOR UPDATE USING (false);

-- ─── BUSINESS_MEMORY — o ativo, append-only ────────────────────────────────
-- Cada entrada é uma frase de aprendizado destilado pelo memory-extractor
-- após o fechamento do ciclo, ou capturado inline durante a conversa.
CREATE TABLE IF NOT EXISTS business_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  category text NOT NULL,                 -- competitor | customer | self | market | tactic
  topic text NOT NULL,                    -- tag curta pra agrupar
  content text NOT NULL,                  -- aprendizado em 1-2 frases
  confidence text NOT NULL DEFAULT 'observed',  -- observed | hypothesis | confirmed
  source text NOT NULL,                   -- conversation | scrape | api | manual
  source_ref text,                        -- ID do source (message_id, scrape_id, etc.)
  weekly_cycle_id uuid REFERENCES weekly_cycles(id) ON DELETE SET NULL,
  linked_pillar_id text,                  -- amarra ao pilar do diagnóstico
  expires_at timestamptz,                 -- entropia: alguns aprendizados decaem
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_memory_lead_id ON business_memory(lead_id);
CREATE INDEX IF NOT EXISTS idx_business_memory_category ON business_memory(lead_id, category);
CREATE INDEX IF NOT EXISTS idx_business_memory_pillar ON business_memory(lead_id, linked_pillar_id);

ALTER TABLE business_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública business_memory" ON business_memory FOR SELECT USING (true);
CREATE POLICY "Insert apenas service role business_memory" ON business_memory FOR INSERT WITH CHECK (false);
CREATE POLICY "Update apenas service role business_memory" ON business_memory FOR UPDATE USING (false);

-- ─── WEEKLY_SIGNALS — snapshot semanal por lead ────────────────────────────
-- Alimentado pelo cron weekly-signals-collector (5ª 16h).
-- Lido pelo cycle-planner (5ª 18h) e pelo dashboard do paid.
CREATE TABLE IF NOT EXISTS weekly_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  week_iso text NOT NULL,                  -- "2026-W20"
  macro jsonb,                             -- [{ indicator, value, delta, interpretation }]
  competitors jsonb,                       -- [{ handle, signal, evidence_url }]
  own_business jsonb,                      -- { ig_delta, reviews_delta, top_post, score_delta }
  linked_pillars text[],                   -- pilares afetados por esses sinais
  collected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, week_iso)
);
CREATE INDEX IF NOT EXISTS idx_weekly_signals_lead_week ON weekly_signals(lead_id, week_iso);

ALTER TABLE weekly_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública weekly_signals" ON weekly_signals FOR SELECT USING (true);
CREATE POLICY "Insert apenas service role weekly_signals" ON weekly_signals FOR INSERT WITH CHECK (false);
CREATE POLICY "Update apenas service role weekly_signals" ON weekly_signals FOR UPDATE USING (false);
