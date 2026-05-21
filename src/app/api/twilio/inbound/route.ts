// ============================================================================
// /api/twilio/inbound — Webhook receptor de mensagens WhatsApp inbound
//
// Comportamento, em ordem:
//
// 1. Se for comando de opt-out (PARE / STOP / SAIR / CANCELAR /
//    DESCADASTRAR / UNSUBSCRIBE) — descadastra via /api/optout interno
//    e ack TwiML de confirmação. (Requisito Meta: ack imediato.)
//
// 2. Se o número está associado a um lead com whatsapp_optin=true e
//    sem whatsapp_optout_at — dispara o loop conversacional em background
//    via waitUntil(). Retorna TwiML vazio — o bot vai enviar a resposta
//    via Twilio API REST em alguns segundos (dentro da janela 24h Meta).
//
// 3. Caso contrário (sem opt-in, ou número desconhecido) — ack TwiML
//    redirecionando pro WhatsApp humano + forward por email como backup.
//
// Twilio Console:
//   Messaging > Senders > WhatsApp sender
//   "When a message comes in" → Webhook POST → /api/twilio/inbound
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { processInboundMessage } from "@/lib/conversation/loop";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALERT_EMAIL = "thazutin@gmail.com";

// Comandos de opt-out que o usuário pode mandar pra sair da cadência.
// Cobrimos as palavras esperadas pela Meta + variantes em PT-BR.
const OPTOUT_KEYWORDS = ["PARE", "PARAR", "STOP", "SAIR", "CANCELAR", "DESCADASTRAR", "UNSUBSCRIBE"];

function isOptoutCommand(body: string): boolean {
  const normalized = body.trim().toUpperCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  return OPTOUT_KEYWORDS.some((kw) => normalized === kw);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** Acha o lead mais recente associado ao número que escreveu. Match
 *  parcial pelos últimos 10 dígitos (DDD+número) — o `whatsapp` do form
 *  pode estar salvo com ou sem +55. */
interface FoundLead {
  id: string;
  name: string | null;
  whatsappOptin: boolean;
  whatsappOptoutAt: string | null;
}

async function findLeadByPhone(from: string): Promise<FoundLead | null> {
  const digits = from.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const tail = digits.slice(-10); // DDD + 8 dígitos (cobre celulares com e sem 9)
  const sb = getSupabaseAdmin();

  // Busca leads cujo whatsapp termina com esses dígitos. PostgREST não
  // tem `ilike right` então usamos ilike com `%tail`.
  const { data, error } = await sb
    .from("leads")
    .select("id, name, whatsapp, whatsapp_optin, whatsapp_optout_at")
    .ilike("whatsapp", `%${tail}`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return {
    id: data[0].id as string,
    name: (data[0].name as string) || null,
    whatsappOptin: !!data[0].whatsapp_optin,
    whatsappOptoutAt: (data[0].whatsapp_optout_at as string) || null,
  };
}

// TwiML — ack de opt-out confirmado
function buildOptoutAckTwiML(name: string | null): string {
  const greeting = name ? `${name.split(" ")[0]}, ` : "";
  const msg = `${greeting}acompanhamento semanal encerrado. Sua conta no site segue ativa — diagnóstico e teses permanecem disponíveis para consulta. Para retomar, escreva para thazutin@gmail.com.`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(msg)}</Message>
</Response>`;
}

// TwiML response — auto-ack redirecionando o cliente pro número humano.
// O número Twilio é só de envio automático; conversa real acontece no
// WhatsApp pessoal. (Loop conversacional vem no próximo sprint.)
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

    // Comando de opt-out — desliga a cadência ANTES de qualquer outra coisa
    // pra cumprir requisito Meta (resposta imediata a "PARE/STOP/SAIR").
    if (body && isOptoutCommand(body)) {
      const lead = await findLeadByPhone(from);
      if (lead) {
        // POST interno pra /api/optout (mesma origem). Fire-and-forget pra ack rápido.
        const host = req.headers.get("host") || "virolocal.com";
        const proto = host.includes("localhost") ? "http" : "https";
        fetch(`${proto}://${host}/api/optout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, source: "whatsapp_inbound" }),
        }).catch((err) => console.error("[TwilioInbound] optout call failed:", err));
        console.log(`[TwilioInbound] Opt-out triggered for lead ${lead.id} (from=${from})`);

        return new NextResponse(buildOptoutAckTwiML(lead.name), {
          status: 200,
          headers: { "Content-Type": "text/xml; charset=utf-8" },
        });
      }
      // Sem lead identificado: ainda ack o opt-out de forma genérica
      // (não temos como descadastrar de uma cadência que nunca começou).
      console.warn(`[TwilioInbound] Opt-out command from unknown number: ${from}`);
      return new NextResponse(buildOptoutAckTwiML(null), {
        status: 200,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      });
    }

    // Identifica o lead (se houver) — usado pra decidir loop conversacional vs ack genérico
    const lead = await findLeadByPhone(from);
    const hasOptin = !!lead && lead.whatsappOptin && !lead.whatsappOptoutAt;

    // ─── Caminho A: lead com opt-in → dispara LOOP CONVERSACIONAL ───────────
    if (hasOptin && body) {
      const fromClean = from.replace("whatsapp:", "");
      const twilioSid = raw.MessageSid || raw.SmsMessageSid || undefined;
      console.log(`[TwilioInbound] Disparando loop conversacional pra lead ${lead!.id}`);

      // Background — Claude leva 5-15s, não dá pra bloquear o webhook do Twilio.
      // O loop envia a resposta via Twilio REST API quando termina.
      waitUntil(
        processInboundMessage({
          leadId: lead!.id,
          fromWhatsapp: fromClean,
          inboundBody: body,
          twilioSidInbound: twilioSid,
        }).catch((err) => {
          console.error(`[TwilioInbound] Loop error pra lead ${lead!.id}:`, err);
        })
      );

      // Resposta TwiML vazia — o bot vai mandar a mensagem real em segundos
      // via Twilio Messages API. Não enviamos nada via TwiML pra evitar
      // mensagem dupla.
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
        status: 200,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      });
    }

    // ─── Caminho B: sem opt-in → forward por email + ack redirect humano ────
    forwardToEmail({ from, body, numMedia, raw }).catch((err) =>
      console.error("[TwilioInbound] forward error:", err),
    );

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
