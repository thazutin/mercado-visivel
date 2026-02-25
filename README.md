# Mercado Visível

Marketing com clareza para negócios locais.

## Setup rápido

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar banco de dados

Abra o [Supabase SQL Editor](https://supabase.com/dashboard/project/iwhoohhyaxjtavokxyzu/sql) e rode o conteúdo de `scripts/schema.sql`.

### 3. Configurar variáveis de ambiente

O arquivo `.env.local` já está configurado. Para um setup novo, copie `.env.example`:

```bash
cp .env.example .env.local
# Preencha com suas chaves
```

### 4. Rodar

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Arquitetura

```
src/
├── app/
│   ├── layout.tsx          # Root layout + Clerk provider
│   ├── page.tsx            # Landing + Form + Processing + Value (Sprint 1)
│   ├── globals.css         # Tailwind + custom tokens
│   └── api/
│       ├── diagnose/       # POST: recebe form, salva lead, roda análise
│       ├── checkout/       # POST: cria sessão Stripe
│       └── webhook/        # POST: webhook Stripe (confirma pagamento)
├── components/
│   ├── AnimatedCounter.tsx
│   ├── InstantValueScreen.tsx
│   ├── ProcessingScreen.tsx
│   └── ProgressBar.tsx
├── lib/
│   ├── supabase.ts         # Client + types + operações
│   ├── stripe.ts           # Checkout + mock fallback
│   ├── analysis.ts         # Mock generator + Claude enrichment
│   └── schema.ts           # Zod validation
└── middleware.ts            # Clerk auth (rotas públicas definidas)
```

## Fluxo Sprint 1

1. **Landing page** → Hero + padrões + como funciona + form
2. **Formulário 4 etapas** → presença digital, negócio, visão, contato
3. **POST /api/diagnose** → salva lead no Supabase + gera análise
4. **Tela de processamento** → feed animado (15s)
5. **Tela de valor instantâneo** → mercado completo (grátis, wow moment)
6. **CTA checkout** → POST /api/checkout → Stripe (ou mock)

## Stripe (pendente)

Quando tiver as chaves:

1. Adicione no `.env.local`:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
2. O checkout vai funcionar automaticamente (fallback mock desativa)
3. Configure webhook no Stripe Dashboard → `https://seudominio.com/api/webhook`

## Deploy (Vercel)

1. Push para GitHub
2. Conecte o repo na Vercel
3. Adicione as variáveis de ambiente no painel da Vercel
4. Deploy automático

## Próximos Sprints

- **Sprint 2**: Dashboard com 5 blocos (O Número, Espelho, Mapa, Ações, Semanal)
- **Sprint 3**: Pipeline real Apify (Google Ads API, scraping concorrentes)
- **Sprint 4**: Briefing semanal automatizado (Claude + Apify scheduled)
