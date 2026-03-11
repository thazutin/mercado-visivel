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
| Stripe | Checkout/payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

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

| Template name | ContentSid | Variáveis body | Variáveis botão | Uso |
|---|---|---|---|---|
| `viro_diagnostico_pronto` | `HXccdbed413b828a2e04c8b474e16920df` | `{{1}}` produto, `{{2}}` região, `{{3}}` influência% | `{{1}}` leadId (URL) | `notifyDiagnosisReady` |
| `viro_plano_pronto` | `HX904aa5fc3eaee7c3fc2351626ce3fb52` | `{{1}}` produto, `{{2}}` região | `{{1}}` leadId (URL) | `notifyPlanReady` |

#### Fluxo pós-pagamento

1. Stripe `success_url` redireciona para `/resultado/{leadId}?paid=true` (rota pública)
2. `ResultadoClient.tsx` exibe banner verde de confirmação e remove `?paid=true` após 3s
3. Webhook `checkout.session.completed` dispara geração do plano completo em background
4. `notifyPlanReady` envia email + WhatsApp (quando ativado) com link para `/resultado/{leadId}`

### Conventions

- Language: all UI copy and comments are in Portuguese
- Styling: Tailwind CSS with custom design tokens in `globals.css`
- Fonts: Satoshi / General Sans
- Path aliases: `@/` maps to `src/`
- The `src/lib/supabase.ts` client uses the anon key; API routes needing admin access create a separate client with `SUPABASE_SERVICE_ROLE_KEY`

## Próximos Passos

1. ~~**Aprovar templates Twilio**~~ — ✅ Concluído. Templates aprovados e `sendWhatsApp` usando ContentSid. Falta setar `WHATSAPP_ENABLED=true` no Vercel (Settings > Environment Variables).
2. **Testar email com Resend** — Validar entrega do email de diagnóstico (`notifyDiagnosisReady`) e plano (`notifyPlanReady`) com domínio `entrega@virolocal.com`.
3. **Instagram recência 15 dias** — Ajustar scraping/pontuação do Instagram para considerar apenas posts dos últimos 15 dias na análise de atividade.
4. **IBGE nos resultados** — Exibir dados IBGE (população, PIB, empresas) na página de resultado quando disponível para o município.
5. **Copy loading screen e passo 2 form** — Melhorar textos da tela de processamento e do segundo passo do formulário (contato).
