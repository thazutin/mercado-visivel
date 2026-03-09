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

### Conventions

- Language: all UI copy and comments are in Portuguese
- Styling: Tailwind CSS with custom design tokens in `globals.css`
- Fonts: Satoshi / General Sans
- Path aliases: `@/` maps to `src/`
- The `src/lib/supabase.ts` client uses the anon key; API routes needing admin access create a separate client with `SUPABASE_SERVICE_ROLE_KEY`
