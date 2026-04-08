// ============================================================================
// /api/twilio/inbound — Webhook receptor de mensagens WhatsApp inbound
//
// O número Twilio do Virô é exclusivamente de SAÍDA (envio automático de
// notificações de diagnóstico/plano). Quando um cliente responde nesse
// número, a gente:
//
// 1. Auto-responde IMEDIATAMENTE via TwiML com uma mensagem clara
//    redirecionando pro número humano: "Esse número é só de envio
//    automático. Fala com a gente aqui: wa.me/5511936190947"
//    — o cliente clica no link e abre conversa direto no número humano.
//
// 2. Em paralelo (não-bloqueante), encaminha o conteúdo por email pra
//    thazutin@gmail.com como backup — caso o cliente não clique no
//    redirect, Thales sabe que alguém tentou contato e pode reachar
//    proativamente do número humano.
//
// Configuração necessária no Twilio Console:
//   Messaging > Senders > WhatsApp sender (seu número)
//   "When a message comes in" → Webhook
//   POST → https://virolocal.com/api/twilio/inbound
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALERT_EMAIL = "thazutin@gmail.com";

// TwiML response — auto-ack redirecionando o cliente pro número humano.
// O número Twilio é só de envio automático; conversa real acontece no
// WhatsApp pessoal.
function buildAckTwiML(): string {
  const ack =
    "Oi 👋 Esse número é só de envio automático das notificações da Virô. " +
    "Pra falar com a gente, clica aqui: https://wa.me/5511936190947 " +
    "(é o nosso WhatsApp de atendimento — respondemos em minutos).";
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
  const phoneDigits = fromClean.replace(/\D/g, "");
  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#F7F5F2;padding:24px;">
      <p style="font-size:20px;font-weight:700;color:#161618;margin:0 0 4px;">📩 Cliente respondeu no número Twilio</p>
      <p style="font-size:12px;color:#888;margin:0 0 16px;">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · backup, não requer ação</p>
      <div style="background:white;border-radius:10px;padding:18px 20px;border:1px solid #E8E4DE;margin-bottom:12px;">
        <p style="font-size:11px;color:#888;margin:0 0 4px;font-family:monospace;">DE</p>
        <p style="font-size:14px;color:#161618;margin:0 0 12px;font-weight:600;">${fromClean}</p>
        <p style="font-size:11px;color:#888;margin:0 0 4px;font-family:monospace;">MENSAGEM</p>
        <p style="font-size:14px;color:#161618;margin:0 0 12px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(payload.body || "(sem texto)")}</p>
        ${payload.numMedia > 0 ? `<p style="font-size:11px;color:#CF8523;margin:0 0 12px;">📎 ${payload.numMedia} mídia(s) — ver Twilio Console</p>` : ""}
        <a href="https://wa.me/${phoneDigits}" style="display:inline-block;background:#25D366;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
          💬 Abrir no WhatsApp pessoal
        </a>
      </div>
      <p style="font-size:11px;color:#888;line-height:1.6;margin:12px 0 0;">
        O cliente já recebeu o auto-ack redirecionando ele pro seu WhatsApp humano (5511936190947).
        Esse email é só backup caso ele não clique no link e você queira reachar proativamente.
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
