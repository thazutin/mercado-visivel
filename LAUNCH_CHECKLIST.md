# 🚀 Virô — Pre-Launch Checklist

Use este checklist nas **2 horas antes** de qualquer disparo coordenado (ex: comunicação para 50 pessoas).

---

## 1. Saldos das APIs externas

| Serviço | Onde checar | Custo aprox. por lead | Mínimo recomendado |
|---|---|---|---|
| **Apify** | https://console.apify.com/billing | $0.05–0.15 | $20 (cobre ~150 leads) |
| **DataForSEO** | https://app.dataforseo.com/api-dashboard | $0.02–0.05 | $10 (cobre ~250 leads) |
| **Anthropic** | https://console.anthropic.com/settings/billing | $0.10–0.30 | $30 (cobre ~150 leads) |
| **Twilio** | https://console.twilio.com/ | $0.005/msg | $5 (cobre 1000 msgs) |
| **Resend** | https://resend.com/dashboard | grátis até 3000/mês | tier free OK |
| **Stripe** | https://dashboard.stripe.com/ | — | confirme **modo Live** ativo |
| **Vercel** | dashboard projeto → Usage | — | Pro tem 1000h function/mês |

- [ ] Saldos verificados e suficientes pro volume planejado
- [ ] Stripe em **modo Live** (não Test)
- [ ] Recargas feitas se necessário

## 2. Health check automático

```bash
curl -H "x-internal-secret: $INTERNAL_API_SECRET" https://virolocal.com/api/health
```

Resposta esperada: `{ ok: true, paused: false, checks: [...] }` com **todos os deps `ok: true`**.

- [ ] `/api/health` retorna `200 OK`
- [ ] Nenhum dep com `ok: false`
- [ ] `paused: false` (kill switch desligado)

## 3. Smoke test real (1 lead end-to-end)

Em **aba anônima**:
1. Abre virolocal.com
2. Preenche formulário com um negócio real (pode ser uma barbearia/restaurante conhecido)
3. Espera o diagnóstico carregar (~60s)
4. Confere no resultado:
   - [ ] Hero "Oportunidade identificada" mostra número > 0
   - [ ] Pelo menos 2 pilares com score > 0 e ações sugeridas
   - [ ] Concorrentes listados
   - [ ] Audiência (IBGE) carregada
5. Confere email recebido em até 3 minutos com link pro `/resultado/[leadId]`
6. (Opcional) Compra via Stripe em test mode pra validar o webhook + plano

## 4. QA Agent — última execução

```bash
curl -H "x-internal-secret: $INTERNAL_API_SECRET" https://virolocal.com/api/agents/qa
```

- [ ] Última execução foi hoje
- [ ] Resultado: sem `failed`
- [ ] Email "✅ QA Virô — tudo ok" recebido em thazutin@gmail.com

## 5. Watchdog rodando

O watchdog (`/api/cron/watchdog`) roda a cada 5 minutos via Vercel Cron. Confere no Vercel Dashboard → Cron Jobs que está ativo.

- [ ] Watchdog visível na lista de crons
- [ ] Última execução nos últimos 10 min

Manualmente disparar o watchdog para validar:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://virolocal.com/api/cron/watchdog
```

## 6. Deploy mais recente

- [ ] Branch `main` deployada e em produção
- [ ] Nenhum erro no Build no Vercel Dashboard
- [ ] Logs do último deploy sem warnings críticos

## 7. Rollback plan

Se algo sair errado durante o lançamento:

### Pausar entrada de novos leads
```
Vercel Dashboard → Project → Settings → Environment Variables
→ Adicionar VIRO_DIAGNOSE_PAUSED=true → Redeploy NÃO necessário, apenas Save
```
Com a env var, `/api/diagnose` retorna 503 com mensagem amigável. Leads em andamento não são afetados.

Para reabrir: deletar a variável (ou setar `false`).

### Reprocessar lead específico travado
```bash
npx tsx scripts/reprocess-lead.ts <leadId>
```
Ou via `/admin` no site (Clerk-protected).

### Reprocessar todos os leads stuck
```bash
npx tsx scripts/reprocess-stuck.ts
```

### Recuperar leads de status=processing
```bash
npx tsx scripts/recover-stuck-leads.ts
```

---

## 8. Comunicação no momento do disparo

- [ ] Mensagem pronta com link direto pra virolocal.com
- [ ] Você (ou alguém) disponível pra monitorar inbox de alertas (thazutin@gmail.com) nas próximas 4-6h
- [ ] Plano de resposta se chegar email do Watchdog: abrir lead no `/resultado/<id>`, identificar erro, decidir entre reprocessar ou notificar usuário

## 9. Monitoramento durante o lançamento (T+0 a T+6h)

Janela crítica: as primeiras 2h após o disparo concentram 60-80% dos cadastros.

- [ ] T+15min: olhar caixa de entrada — algum email do Watchdog?
- [ ] T+30min: rodar `/api/health` de novo
- [ ] T+1h: rodar `/api/agents/qa` manualmente
- [ ] T+2h: query no Supabase → quantos leads `done` vs `error`?
- [ ] T+4h: revisar 3 leads aleatórios manualmente — números fazem sentido?

## 10. Pós-lançamento (D+1)

- [ ] Total de leads recebidos
- [ ] Taxa de conversão diagnóstico → checkout
- [ ] Erros encontrados → tarefas pra resolver
- [ ] Feedback dos primeiros usuários
- [ ] Custo real vs estimativa

---

**Última atualização:** 7 de abril de 2026
