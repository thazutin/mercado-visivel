# QA Agent — Virô

## O que faz
Agente de QA automatizado que roda 2x/dia (8h e 20h UTC) e verifica o produto end-to-end.

## Como rodar manualmente
```bash
curl -H "x-internal-secret: $INTERNAL_API_SECRET" https://virolocal.com/api/agents/qa
```

## Checks de dados (sempre rodam)

| Check | O que verifica |
|-------|---------------|
| CHECK 1 — Pipeline | Cria lead de teste, roda pipeline, verifica se completa em < 120s |
| CHECK 2 — Dados críticos | diagnosis_display, influencePercent, name não são null |
| CHECK 3 — Scores pilares | Ao menos 2 dos 3 pilares com score > 0 |
| CHECK 4 — Número hero | Mesmo valor entre email e dashboard |
| CHECK 5 — Email | Skipped para lead de teste (email fake) |
| CHECK 6 — Concorrência | Ao menos 1 concorrente encontrado |
| CHECK 7 — Copy nacional | Verificação de raio para leads nacionais |

## Checks visuais (Playwright — skip em Vercel)

| Check | O que verifica |
|-------|---------------|
| CHECK 8 — Dashboard carrega | H1 presente após navegação |
| CHECK 9 — 3 abas | Exatamente Diagnóstico / Seu Plano / Esta Semana |
| CHECK 10 — Nome no título | H1 contém lead.name |
| CHECK 11 — Toggle affordance | Botão "Por que identificamos" tem borda e é clicável |
| CHECK 12 — Scores visíveis | 3 pilares com número > 0 |
| CHECK 13 — Esta Semana | Aba carrega conteúdo |
| CHECK 14 — Seu Plano | Aba tem itens ou upsell |

Checks visuais são skipped automaticamente quando Playwright não está disponível
(ambiente Vercel). Para rodar localmente com Playwright:
```bash
npx playwright install chromium
INTERNAL_API_SECRET=xxx curl http://localhost:3000/api/agents/qa
```

## Interpretando o relatório
- ✅ PASS — tudo ok
- ❌ FAIL — bug detectado, precisa investigar
- ⚠️ WARN — funciona mas com dados incompletos
- ⏭️ SKIP — check não aplicável neste contexto

## Como adicionar novos checks
1. Adicione a função de check em `src/lib/agents/qa-agent.ts`
2. Retorne `{ name, status, detail }` do tipo `CheckResult`
3. O report e email são gerados automaticamente

## Cleanup
O lead de teste é automaticamente deletado ao final do run.
Email: `qa-test@virolocal.com` (filtrado nas queries).
