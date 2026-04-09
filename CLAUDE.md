# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Virô** (branded as "Mercado Visível") is a Next.js 14 app that analyzes local business visibility. Users fill a 2-step form, a synchronous pipeline runs real-time market analysis (SERP, Maps, Instagram scraping + AI), and results are displayed instantly. The app is in Portuguese (pt-BR).

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (TypeScript and ESLint errors are ignored via next.config.mjs)
- `npm run lint` — Run ESLint
- `npm run db:setup` — Run database setup script
- Database schema lives in `scripts/schema.sql` (run manually in Supabase SQL Editor)

## Architecture

### Core Flow

1. **Landing page** (`src/app/page.tsx`) — Hero, form (2 steps: business info + contact), processing animation, instant results display. This is a large single-page component handling the entire funnel.
2. **POST `/api/diagnose`** — Validates form with Zod, inserts lead into Supabase, runs the analysis pipeline synchronously (up to 180s via `maxDuration`), saves diagnosis, sends WhatsApp + email notifications.
3. **Results page** (`src/app/resultado/[leadId]/page.tsx`) — Public shareable results page; polls GET `/api/diagnose?leadId=X` for saved diagnosis data.
4. **Dashboard** (`src/app/dashboard/`) — Authenticated area (Clerk-protected) for paid users.
5. **Admin** (`src/app/admin/page.tsx`) — Internal admin panel.

### Analysis Pipeline (`src/lib/`)

The pipeline is orchestrated in `src/lib/analysis.ts` and broken into steps:

- **Step 1** (`pipeline/step1-term-generation.ts`) — Claude generates search terms from business description
- **Volume data** — Google Ads Keyword Planner or DataForSEO for search volumes/CPC
- **SERP + Maps + Instagram** — Apify scrapers (`pipeline/external-services.ts`) fetch real positioning data
- **Market sizing** (`models/market-sizing.ts`) — Calculates market potential (low/high range)
- **Influence score** (`models/influence-score.ts`) — Composite score from Google (SERP + Maps) and Instagram presence
- **Step 5** (`pipeline/step5-gap-analysis.ts`) — Claude analyzes gaps and generates work routes
- **AI Visibility** (`pipeline/ai-visibility.ts`) — Checks business visibility in AI responses

Pipeline types are centralized in `src/lib/types/pipeline.types.ts`.

### Key Integrations

| Service | Purpose | Env Var |
|---------|---------|---------|
| Supabase | Database (leads, diagnoses, pipeline_runs) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Clerk | Auth (dashboard/admin protection) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| Anthropic Claude | Term generation, gap analysis, AI visibility | `ANTHROPIC_API_KEY` |
| Apify | SERP, Google Maps, Instagram scraping | `APIFY_API_TOKEN` |
| Stripe | Checkout/payments/subscriptions | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_PRICE_ID`, `CHECKOUT_AMOUNT` |
| fal.ai | Image generation for social media posts (Flux Schnell — ~2s, $0.003/img) | `FAL_API_KEY` |

### Auth & Middleware

`src/middleware.ts` handles two things:
- **Clerk auth** — Protects `/dashboard/*` and `/admin/*`; all API routes and `/resultado/*` are public
- **Rate limiting** — In-memory, 3 POST requests/hour per IP on `/api/diagnose` only (GETs for polling are unlimited)

### Form Validation

`src/lib/schema.ts` defines the Zod schema (`leadSchema`) with per-step validation (`stepValidation.step1`, `stepValidation.step2`). The form adapter (`src/lib/form-adapter.ts`) converts form data to pipeline input format.

### Notifications (`src/lib/notify.ts`)

Two notification channels: **Email (Resend)** and **WhatsApp (Twilio)**.

- **WhatsApp ativo** — gated por `WHATSAPP_ENABLED !== "true"` em `sendWhatsApp()`. Usa Content Templates (ContentSid + ContentVariables) em vez de Body livre.

#### Templates Twilio aprovados

| Template name | ContentSid | Variáveis | Uso |
|---|---|---|---|
| `viro_diagnostico_atualizado` | `HX672bd3177d6ae1de3bab9ead2806bf8a` | `{{1}}` nome do negócio, `{{2}}` região, `{{3}}` leadId (URL do botão) | `notifyDiagnosisReady` |
| `viro_plano_acao` | `HX1ccebfd16b0961d7bdbdd5fa07e46255` | `{{1}}` nome do negócio, `{{2}}` região, `{{3}}` leadId (URL do botão) | `notifyFullDiagnosisReady` |

#### Fluxo pós-pagamento

1. Stripe `success_url` redireciona para `/resultado/{leadId}?paid=true` (rota pública)
2. `ResultadoClient.tsx` exibe banner verde de confirmação e remove `?paid=true` após 3s
3. Webhook `checkout.session.completed` dispara geração do plano completo em background
4. `notifyFullDiagnosisReady` envia email + WhatsApp (quando ativado) com link para `/dashboard/{leadId}`

#### Fluxo de assinatura (recorrência)

1. Usuário clica "Assinar por R$99/mês" na tab Conteúdos do dashboard (requer diagnóstico pago)
2. `POST /api/checkout/subscription` cria Stripe Checkout Session `mode: "subscription"` com `STRIPE_SUBSCRIPTION_PRICE_ID`
3. Stripe `success_url` redireciona para `/dashboard/{leadId}?subscribed=true`
4. Webhook `checkout.session.completed` com `metadata.type === "subscription"`:
   - Atualiza leads: `subscription_status = "active"`, `subscription_stripe_id`, `subscription_started_at`
   - **NÃO chama `triggerContentGeneration`** — a amostra já foi gerada no diagnóstico. O cron semanal cuida das atualizações
   - Envia `notifyWeeklyContents` confirmando ativação
5. Webhook `customer.subscription.deleted` → `subscription_status = "cancelled"`
6. Webhook `customer.subscription.updated` → sincroniza status (`active`/`cancelled`)

**Env vars:**
- `STRIPE_SUBSCRIPTION_PRICE_ID` — price ID do produto de recorrência no Stripe
- `CHECKOUT_AMOUNT` — valor do checkout em centavos (default: `49700` = R$497). Para testar: `CHECKOUT_AMOUNT=100` (R$1)

#### Cron: conteúdos semanais para assinantes

- **Path:** `/api/cron/weekly-contents`
- **Schedule:** `0 8 * * 5` (toda sexta às 8h UTC = 5h BRT)
- **O que faz:** Para cada lead com `subscription_status = "active"`, gera novos conteúdos via Claude (`triggerContentGeneration`) e envia email de aviso (`notifyWeeklyContents`)
- **Autenticação:** `CRON_SECRET` via header `Authorization: Bearer`

**Testar manualmente:**
```bash
# Desenvolvimento
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly-contents

# Produção
curl -H "Authorization: Bearer $CRON_SECRET" https://virolocal.com/api/cron/weekly-contents
```

## Schema v2

Migration em `scripts/schema_v2.sql`. Rodar manualmente no Supabase SQL Editor.

### Novas colunas em `leads`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `subscription_status` | text | `null` (sem assinatura), `active`, `cancelled` |
| `subscription_stripe_id` | text | ID da subscription no Stripe (`sub_...`) |
| `subscription_started_at` | timestamptz | Data de início da assinatura |

### Novas colunas em `diagnoses`

| Coluna | Tipo | Formato JSONB |
|--------|------|---------------|
| `seasonality` | jsonb | `{ months: [{ month: string, volume: number }], peak_month: string, low_month: string }` |
| `macro_context` | jsonb | `{ summary: string, indicators: [] }` |
| `b2b_targets` | jsonb | `{ companies: [], status: "preview" }` |
| `b2g_tenders` | jsonb | `{ tenders: [], status: "preview" }` |

### Tabela `checklists`

Checklist de melhorias gerado por IA para cada lead.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `lead_id` | uuid | FK → leads(id) ON DELETE CASCADE |
| `items` | jsonb | Array de itens do checklist |
| `generated_at` | timestamptz | Data de geração |
| `created_at` | timestamptz | Data de criação do registro |

Formato de cada item em `items`:
```json
{ "id": "uuid", "category": "string", "title": "string", "description": "string", "priority": "alta|média|baixa", "status": "pending|done" }
```

RLS: leitura pública, insert/update apenas via service role.

### Tiers de usuário

| Tier | Condição |
|------|----------|
| **free** | `paid_at` é null |
| **paid** | `paid_at` preenchido E `subscription_status` != `active` |
| **subscriber** | `subscription_status` = `active` |

### Conventions

- Language: all UI copy and comments are in Portuguese
- Styling: Tailwind CSS with custom design tokens in `globals.css`
- Fonts: Satoshi / General Sans
- Path aliases: `@/` maps to `src/`
- The `src/lib/supabase.ts` client uses the anon key; API routes needing admin access create a separate client with `SUPABASE_SERVICE_ROLE_KEY`

## Próximos Passos

1. ~~**Aprovar templates Twilio**~~ — ✅ Concluído. Templates aprovados e `sendWhatsApp` usando ContentSid. Falta setar `WHATSAPP_ENABLED=true` no Vercel (Settings > Environment Variables).
2. **Testar email com Resend** — Validar entrega do email de diagnóstico (`notifyDiagnosisReady`) e plano (`notifyPlanReady`) com domínio `entrega@virolocal.com`.
3. ~~**Instagram recência 15 dias**~~ — ✅ Concluído. Scraper calcula `recentPostsCount`, `recentAvgReach`, `recentEngagementRate` (15d). Score usa blend 60% recente + 40% histórico, ou penalização 0.5x se inativo.
4. ~~**IBGE nos resultados**~~ — ✅ Concluído. Módulo de audiência estimada: IBGE (população + raio) + Claude Haiku (target %). Exibido como "Seu mercado acessível" na página de resultado.
5. **Copy loading screen e passo 2 form** — Melhorar textos da tela de processamento e do segundo passo do formulário (contato).
