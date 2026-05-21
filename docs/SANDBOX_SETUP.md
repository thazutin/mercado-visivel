# Setup Twilio Sandbox — Plano B do WhatsApp

Enquanto a WhatsApp Cloud API definitiva não está pronta (em paralelo via Meta com MEI novo), o **Twilio Sandbox** permite operar a experiência conversacional Virô end-to-end com até ~25 usuários que fazem opt-in explícito. Ideal para demos, testes com early adopters e validação técnica do loop conversacional.

## Limites

| | Sandbox | Cloud API (produção) |
|---|---|---|
| Número | `+1 415 523 8886` compartilhado | Número próprio brasileiro |
| Branding | "Twilio Sandbox" no preview | "Virô" |
| Templates aprovados pela Meta | ❌ Não usa | ✅ Sim |
| Mensagens livres (Body) | ✅ Dentro de janela 24h | ✅ Dentro de janela 24h |
| Opt-in do user | "join `<codigo>`" enviado pelo user | Opt-in via web/email |
| Escala | ~25 contatos ativos | Milhares (tier ramping) |
| Aprovação Meta necessária | Não | Sim |

## Passo a passo do setup

### 1. Ativar Sandbox no Twilio Console

1. Acessar [Twilio Console → Messaging → Try it out → Send a WhatsApp message](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. Você verá o número do sandbox (`+1 415 523 8886`) e um **código de join** único da sua conta. Anota o código (ex: `join calm-elephant`).
3. Configure o **webhook de inbound** apontando para a Virô:
   - "When a message comes in" → `https://virolocal.com/api/twilio/inbound`
   - Method: `POST`

### 2. Variáveis de ambiente no Vercel

Adicionar/atualizar:

```
WHATSAPP_ENABLED=true
TWILIO_SANDBOX_MODE=true          # ativa fallback de texto livre nos templates
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_ACCOUNT_SID=<seu account sid>
TWILIO_AUTH_TOKEN=<seu auth token>
```

> `TWILIO_SANDBOX_MODE=true` faz com que `sendWeeklyOpening/Checkpoint/Closure` caiam em texto livre via `sendWhatsAppFreeText` ao invés de tentarem Content Template (que sandbox não suporta).

### 3. Onboarding de cada usuário (incluindo você)

Cada pessoa que vai conversar com a Virô precisa **uma vez**:

1. Salvar o contato `+1 415 523 8886` no WhatsApp
2. Mandar a mensagem **exata** com o código:

   ```
   join calm-elephant
   ```

   (Substituir pelo código da sua conta)

3. Twilio responde confirmando que a janela está aberta por 72h.

A partir desse momento, qualquer mensagem do user dispara o webhook `/api/twilio/inbound` → `processInboundMessage` → loop conversacional Claude. A Virô responde dentro da janela 24h após cada mensagem do user.

### 4. Disparar abertura de ciclo manualmente (sem esperar cron)

Use o smoke test script:

```bash
npx tsx scripts/smoke-cycle.ts --leadId <uuid> --signals --plan --persist
npx tsx scripts/smoke-cycle.ts --leadId <uuid> --open
```

O `--open` chama `sendWeeklyOpening` que, em modo sandbox, envia mensagem livre informando o tema da semana e pedindo `"Ver o plano"` como resposta.

> **Importante:** o user precisa ter mandado pelo menos UMA mensagem no sandbox nas últimas 24h para a janela estar aberta — caso contrário o envio falha silenciosamente. Em produção (Cloud API + templates Meta aprovados), templates de business-initiated não precisam de janela aberta.

### 5. Demo na reunião

Antes da reunião:

1. Você (apresentador) faz o `join` no sandbox pelo seu celular
2. Cria um lead de teste com seu telefone via formulário `/balcao/diagnostico` ou `/`
3. Marca `whatsapp_optin=true` para esse lead (no Supabase, manualmente, se preciso)
4. Roda `smoke-cycle.ts --open` antes da reunião pra abrir o ciclo

Durante a reunião:

1. Mostra a tela do celular com a mensagem da Virô (abertura semanal)
2. Responde `"Ver o plano"` no celular ao vivo
3. Aguarda 5-15s — Virô responde com plano contextual baseado em dados reais do lead
4. Continue a conversa ao vivo — captura de memória, ajustes de rota, etc.

## Migração Sandbox → Cloud API

Quando a Cloud API estiver pronta:

1. `TWILIO_SANDBOX_MODE=false` (ou remove a env var)
2. Atualiza `TWILIO_WHATSAPP_FROM` pro número Cloud API
3. Setar os 3 `WA_TEMPLATE_*` SIDs aprovados pela Meta
4. Webhook inbound aponta pro mesmo `/api/twilio/inbound`

O resto do código (loop, context-builder, memory-extractor, crons) não muda.
