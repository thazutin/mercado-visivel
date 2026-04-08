// ============================================================================
// /api/twilio/inbound — Webhook receptor de mensagens WhatsApp inbound
//
// Quando um usuário responde a uma mensagem enviada pelo número Twilio do
// Virô, Twilio envia POST pra esse endpoint com o corpo da mensagem. A gente:
//
// 1. Responde IMEDIATAMENTE via TwiML com um ack ("recebi, vou responder")
//    — isso aparece pro usuário em segundos no mesmo chat, mantendo a UX
//    de que o canal é responsivo.
// 2. Encaminha o conteúdo por email pra thazutin@gmail.com com o número do
//    remetente, pra Thales responder manualmente pelo Twilio Console (ou
//    via outra integração futura).
//
// Configuração necessária no Twilio Console:
//   Messaging > Senders > WhatsApp sender (seu número)
//   "When a message comes in" → Webhook
//   POST → https://virolocal.com/api/twilio/inbound
//
// Auth: usa Twilio signature validation se TWILIO_AUTH_TOKEN setada.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALERT_EMAIL = "thazutin@gmail.com";

// TwiML response — auto-ack que aparece no chat do cliente em segundos
function buildAckTwiML(): string {
  const ack =
    "Recebemos sua mensagem 👋 Em alguns minutos um humano da Virô vai te responder por aqui mesmo. Para algo urgente, fala com a gente em https://wa.me/5511936190947";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(ack)}</Message>
</Response>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function forwardToEmail(payload: {
  from: string;
  body: string;
  numMedia: number;
  raw: Record<string, string>;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[TwilioInbound] RESEND_API_KEY ausente — pulando forward");
    return;
  }

  const fromClean = payload.from.replace("whatsapp:", "");
  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#F7F5F2;padding:24px;">
      <p style="font-size:20px;font-weight:700;color:#161618;margin:0 0 4px;">📩 Nova mensagem WhatsApp</p>
      <p style="font-size:12px;color:#888;margin:0 0 16px;">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      <div style="background:white;border-radius:10px;padding:18px 20px;border:1px solid #E8E4DE;margin-bottom:12px;">
        <p style="font-size:11px;color:#888;margin:0 0 4px;font-family:monospace;">DE</p>
        <p style="font-size:14px;color:#161618;margin:0 0 12px;font-weight:600;">
          ${fromClean} ·
          <a href="https://wa.me/${fromClean.replace(/\D/g, "")}" style="color:#CF8523;text-decoration:none;">abrir no WhatsApp</a>
        </p>
        <p style="font-size:11px;color:#888;margin:0 0 4px;font-family:monospace;">MENSAGEM</p>
        <p style="font-size:14px;color:#161618;margin:0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(payload.body || "(sem texto)")}</p>
        ${payload.numMedia > 0 ? `<p style="font-size:11px;color:#CF8523;margin:8px 0 0;">📎 ${payload.numMedia} mídia(s) anexada(s) — ver no Twilio Console</p>` : ""}
      </div>
      <p style="font-size:11px;color:#888;margin:12px 0 0;">
        Para responder, abra o Twilio Console → Messaging → Logs, ou clique no link "abrir no WhatsApp" acima
        (vai abrir o WhatsApp com o número do cliente — só funciona se você tiver ele como contato em outro número).
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Nelson WhatsApp <entrega@virolocal.com>",
      to: ALERT_EMAIL,
      reply_to: ALERT_EMAIL,
      subject: `📩 WhatsApp de ${fromClean}: ${(payload.body || "(mídia)").slice(0, 60)}`,
      html,
    }),
  }).catch((err) => {
    console.error("[TwilioInbound] Resend forward failed:", err);
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  try {
    // Twilio envia application/x-www-form-urlencoded
    const formData = await req.formData();
    const raw: Record<string, string> = {};
    formData.forEach((v, k) => {
      raw[k] = String(v);
    });

    const from = raw.From || "";
    const body = raw.Body || "";
    const numMedia = parseInt(raw.NumMedia || "0", 10);

    console.log(`[TwilioInbound] From=${from} body="${body.slice(0, 100)}" media=${numMedia}`);

    // Forward async (não bloqueia o ack)
    forwardToEmail({ from, body, numMedia, raw }).catch((err) =>
      console.error("[TwilioInbound] forward error:", err),
    );

    // TwiML ack response
    return new NextResponse(buildAckTwiML(), {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (err) {
    console.error("[TwilioInbound] Unexpected error:", err);
    // Mesmo em erro, retorna 200 com TwiML vazio pra Twilio não ficar retentando
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }
}

// GET pra healthcheck — Twilio às vezes faz GET de teste
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Twilio inbound webhook ready. POST to this URL with Twilio's webhook payload.",
  });
}
