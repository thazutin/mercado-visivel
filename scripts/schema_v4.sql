-- ============================================================================
-- Schema v4 — Source tracking pra leads (parceiros/canais)
-- Rodar no Supabase SQL Editor após schema_v3.sql.
-- ============================================================================

-- Origem do lead (canal/parceiro). Ex:
--   null      → lead direto via homepage virolocal.com
--   "balcao"  → lead vindo de /balcao (rede Balcão Urbano)
--   futuras parcerias → outros slugs
-- Útil pra segmentar dashboards, copy do diagnóstico e billing.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source) WHERE source IS NOT NULL;
