// ============================================================================
// Virô — Notification helpers
// Reutilizável: diagnóstico inicial + plano completo pós-pagamento
// File: src/lib/notify.ts
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com";

// ─── WhatsApp Content Templates (Twilio) ────────────────────────────────────
const WHATSAPP_TEMPLATES = {
  diagnostico_pronto: "HXccdbed413b828a2e04c8b474e16920df",
  plano_pronto: "HX904aa5fc3eaee7c3fc2351626ce3fb52",
} as const;

function cleanPhone(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// ─── WhatsApp via Twilio (Content Templates) ─────────────────────────────────

export async function sendWhatsApp(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>,
): Promise<void> {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    console.log("[Notify] WhatsApp desativado — setar WHATSAPP_ENABLED=true");
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const rawFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const from = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;

  if (!accountSid || !authToken) {
    console.warn("[Notify] Skipping WhatsApp — TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing");
    return;
  }
  if (!to) {
    console.warn("[Notify] Skipping WhatsApp — no recipient number");
    return;
  }

  const phone = cleanPhone(to);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: from,
          To: `whatsapp:+${phone}`,
          ContentSid: contentSid,
          ContentVariables: JSON.stringify(contentVariables),
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Notify] WhatsApp failed to +${phone}:`, err);
    } else {
      console.log(`[Notify] WhatsApp sent to +${phone} (template: ${contentSid})`);
    }
  } catch (err) {
    console.error(`[Notify] WhatsApp error sending to +${phone}:`, err);
  }
}

// ─── Email via Resend ────────────────────────────────────────────────────────

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Notify] Skipping email — RESEND_API_KEY missing");
    return;
  }
  if (!opts.to) {
    console.warn("[Notify] Skipping email — no recipient address");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Virô <entrega@virolocal.com>",
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Notify] Email failed to ${opts.to}:`, err);
    } else {
      console.log(`[Notify] Email sent to ${opts.to}`);
    }
  } catch (err) {
    console.error(`[Notify] Email error sending to ${opts.to}:`, err);
  }
}

// ─── Diagnóstico inicial ─────────────────────────────────────────────────────

export async function notifyDiagnosisReady(opts: {
  email: string;
  whatsapp: string;
  leadId: string;
  product: string;
  region: string;
  influencePercent: number;
}): Promise<void> {
  const { email, whatsapp, leadId, product, region, influencePercent } = opts;
  const url = `${BASE_URL}/resultado/${leadId}`;
  const shortRegion = region.split(",")[0].trim();

  await Promise.allSettled([
    sendWhatsApp(
      whatsapp,
      WHATSAPP_TEMPLATES.diagnostico_pronto,
      { "1": product, "2": shortRegion, "3": String(influencePercent) },
    ),

    sendEmail({
      to: email,
      subject: `Seu diagnóstico de mercado está pronto — ${product} em ${shortRegion}`,
      html: diagnosisEmailHtml({ product, shortRegion, influencePercent, url }),
    }),
  ]);
}

// ─── Plano completo pós-pagamento ────────────────────────────────────────────

export async function notifyPlanReady(opts: {
  email: string;
  whatsapp: string;
  leadId: string;
  product: string;
  region: string;
}): Promise<void> {
  const { email, whatsapp, leadId, product, region } = opts;
  const url = `${BASE_URL}/resultado/${leadId}`;
  const shortRegion = region.split(",")[0].trim();

  await Promise.allSettled([
    sendWhatsApp(
      whatsapp,
      WHATSAPP_TEMPLATES.plano_pronto,
      { "1": product, "2": shortRegion },
    ),

    sendEmail({
      to: email,
      subject: `Seu plano de 90 dias está pronto — ${product} em ${shortRegion}`,
      html: planEmailHtml({ product, shortRegion, url }),
    }),
  ]);
}

// ─── Email templates ─────────────────────────────────────────────────────────

function emailShell(content: string): string {
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#FEFEFF;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="width:44px;height:44px;border-radius:14px;background:#161618;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-weight:700;font-size:20px;color:#FEFEFF;">V</span>
        </div>
      </div>
      ${content}
      <hr style="border:none;border-top:1px solid #EAEAEE;margin:32px 0;" />
      <p style="font-size:11px;color:#9E9EA8;text-align:center;margin:0;">
        Virô · virolocal.com · inteligência de mercado local
      </p>
    </div>
  `;
}

function diagnosisEmailHtml(opts: {
  product: string;
  shortRegion: string;
  influencePercent: number;
  url: string;
}): string {
  const { product, shortRegion, influencePercent, url } = opts;
  const color = influencePercent === 0 ? "#D9534F" : influencePercent < 20 ? "#CF8523" : "#2D9B83";

  return emailShell(`
    <h1 style="font-size:22px;color:#161618;margin:0 0 16px;line-height:1.3;">
      Seu diagnóstico de mercado está pronto.
    </h1>
    <p style="font-size:15px;color:#6E6E78;line-height:1.7;margin:0 0 24px;">
      Analisamos <strong>${product}</strong> em <strong>${shortRegion}</strong> 
      e calculamos sua influência digital no mercado local.
    </p>
    <div style="background:#F4F4F7;border-radius:12px;padding:20px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:48px;font-weight:700;color:${color};line-height:1;margin-bottom:6px;">
        ${influencePercent}%
      </div>
      <div style="font-size:13px;color:#6E6E78;">de influência digital no seu mercado</div>
    </div>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${url}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
        Ver minha inteligência de mercado
      </a>
    </div>
    <p style="font-size:14px;color:#3A3A40;line-height:1.6;margin:0 0 12px;">
      Veja onde estão suas oportunidades de mercado e como aumentar sua visibilidade local.
    </p>
    <p style="font-size:13px;color:#9E9EA8;line-height:1.6;margin:0;">
      O resultado inclui os termos de busca mapeados, sua posição no Google,
      análise do Instagram e as rotas de trabalho priorizadas.
    </p>
  `);
}

function planEmailHtml(opts: {
  product: string;
  shortRegion: string;
  url: string;
}): string {
  const { product, shortRegion, url } = opts;

  return emailShell(`
    <h1 style="font-size:22px;color:#161618;margin:0 0 16px;line-height:1.3;">
      Seu plano de 90 dias está pronto.
    </h1>
    <p style="font-size:15px;color:#6E6E78;line-height:1.7;margin:0 0 24px;">
      O diagnóstico completo e o plano de ação de 90 dias para
      <strong>${product}</strong> em <strong>${shortRegion}</strong>
      estão disponíveis na sua página de resultado.
    </p>
    <div style="margin:0 0 20px;">
      ${[
        "Diagnóstico completo por canal",
        "Plano semanal — 12 semanas com ações específicas",
        "Briefings semanais toda segunda-feira",
      ]
        .map(
          (item) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="color:#CF8523;font-size:14px;font-weight:700;">✓</span>
          <span style="font-size:14px;color:#3A3A40;">${item}</span>
        </div>`
        )
        .join("")}
    </div>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${url}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
        Acessar meu resultado
      </a>
    </div>
    <p style="font-size:13px;color:#9E9EA8;line-height:1.6;margin:0;">
      A partir de agora, toda segunda-feira você recebe o briefing semanal 
      com o que mudou no seu mercado e a ação da semana.
    </p>
  `);
}
