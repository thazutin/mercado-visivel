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
  if (!digits) return "";
  // Garante formato E.164 brasileiro: +55 + DDD (2 dígitos) + número (8-9 dígitos)
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  console.log(`[Notify] cleanPhone: "${whatsapp}" → "+${withCountry}"`);
  return withCountry;
}

// ─── WhatsApp via Twilio (Content Templates) ─────────────────────────────────

export async function sendWhatsApp(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>,
): Promise<void> {
  const whatsappEnabled = process.env.WHATSAPP_ENABLED;
  console.log(`[Notify] WhatsApp check: WHATSAPP_ENABLED="${whatsappEnabled}", to="${to}", contentSid="${contentSid}"`);
  if (whatsappEnabled !== "true") {
    console.log("[Notify] WhatsApp desativado — setar WHATSAPP_ENABLED=true no Vercel Environment Variables");
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
    console.warn("[Notify] Skipping WhatsApp — no recipient number (to is empty)");
    return;
  }

  const phone = cleanPhone(to);
  if (!phone) {
    console.warn(`[Notify] Skipping WhatsApp — cleanPhone returned empty for "${to}"`);
    return;
  }

  const requestBody = {
    From: from,
    To: `whatsapp:+${phone}`,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(contentVariables),
  };
  console.log(`[Notify] WhatsApp request:`, JSON.stringify(requestBody));

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(requestBody),
      }
    );
    const resBody = await res.text();
    if (!res.ok) {
      console.error(`[Notify] WhatsApp failed to +${phone}: status=${res.status}`, resBody);
    } else {
      console.log(`[Notify] WhatsApp sent to +${phone}: status=${res.status}`, resBody);
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
    const resBody = await res.text();
    if (!res.ok) {
      console.error(`[Notify] Email failed to ${opts.to}: status=${res.status}`, resBody);
    } else {
      console.log(`[Notify] Email sent to ${opts.to}: status=${res.status}`, resBody);
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
  searchVolume?: number;
}): Promise<void> {
  const { email, whatsapp, leadId, product, region, influencePercent, searchVolume } = opts;
  console.log(`[NOTIFY] iniciando email/whatsapp para email=${email}, phone=${whatsapp}, leadId=${leadId}`);
  const url = `${BASE_URL}/resultado/${leadId}`;
  const shortRegion = region.split(",")[0].trim();

  const results = await Promise.allSettled([
    sendWhatsApp(
      whatsapp,
      WHATSAPP_TEMPLATES.diagnostico_pronto,
      { "1": product, "2": shortRegion, "3": String(influencePercent), "4": leadId },
    ),

    sendEmail({
      to: email,
      subject: `Seu diagnóstico de mercado está pronto — ${product} em ${shortRegion}`,
      html: diagnosisEmailHtml({ product, shortRegion, influencePercent, searchVolume, url }),
    }),
  ]);

  results.forEach((r, i) => {
    const channel = i === 0 ? "WhatsApp" : "Email";
    if (r.status === "rejected") {
      console.error(`[NOTIFY] ${channel} promise rejected:`, r.reason);
    } else {
      console.log(`[NOTIFY] ${channel} promise fulfilled`);
    }
  });
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
  const dashboardUrl = `${BASE_URL}/dashboard/${leadId}`;
  const shortRegion = region.split(",")[0].trim();

  await Promise.allSettled([
    sendWhatsApp(
      whatsapp,
      WHATSAPP_TEMPLATES.plano_pronto,
      { "1": product, "2": shortRegion, "3": leadId },
    ),

    sendEmail({
      to: email,
      subject: `Seu plano de ação está pronto — ${product} em ${shortRegion}`,
      html: planEmailHtml({ product, shortRegion, url: dashboardUrl }),
    }),
  ]);
}

// ─── Upsell (semana 8) ────────────────────────────────────────────────────────

export async function notifyUpsell(opts: {
  email: string;
  name: string;
  product: string;
  leadId: string;
}): Promise<void> {
  const { email, name, product, leadId } = opts;
  const firstName = name.split(" ")[0] || "Olá";
  const url = `${BASE_URL}/resultado/${leadId}`;

  await sendEmail({
    to: email,
    subject: `${firstName}, seu diagnóstico está funcionando — veja os resultados`,
    html: emailShell(`
      <h1 style="font-size:22px;color:#161618;margin:0 0 12px;line-height:1.3;">
        8 semanas de dados reais sobre ${product}.
      </h1>
      <p style="font-size:15px;color:#6E6E78;line-height:1.7;margin:0 0 20px;">
        ${firstName}, nas últimas 8 semanas monitoramos seu mercado toda segunda-feira.
        Seu painel acumula dados que nenhum concorrente tem — e estamos só na metade.
      </p>
      <div style="background:#F4F4F7;border-radius:12px;padding:20px;margin:0 0 20px;">
        <p style="font-size:14px;color:#3A3A40;margin:0;line-height:1.7;">
          <strong>O que vem nas próximas 4 semanas:</strong><br/>
          → Análise de tendência com dados acumulados<br/>
          → Comparativo de evolução vs concorrentes<br/>
          → Ações cada vez mais específicas para seu mercado
        </p>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${url}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
          Ver meu painel
        </a>
      </div>
      <p style="font-size:13px;color:#9E9EA8;margin:0;line-height:1.6;">
        Quer continuar recebendo briefings após as 12 semanas?
        Responda este email e conversamos sobre as opções.
      </p>
    `),
  });
}

// ─── Closure (semana 10) ──────────────────────────────────────────────────────

export async function notifyClosure(opts: {
  email: string;
  name: string;
  product: string;
  leadId: string;
  scoreInicial: number;
  scoreAtual: number;
}): Promise<void> {
  const { email, name, product, leadId, scoreInicial, scoreAtual } = opts;
  const firstName = name.split(" ")[0] || "Olá";
  const url = `${BASE_URL}/resultado/${leadId}`;
  const diff = scoreAtual - scoreInicial;
  const diffText = diff > 0 ? `+${diff}pp` : diff === 0 ? "estável" : `${diff}pp`;
  const feedbackUrl = `${BASE_URL}/feedback/${leadId}`;

  await sendEmail({
    to: email,
    subject: `${firstName}, faltam 2 semanas — seu resumo de evolução`,
    html: emailShell(`
      <h1 style="font-size:22px;color:#161618;margin:0 0 12px;line-height:1.3;">
        Faltam 2 semanas. Veja o que mudou.
      </h1>
      <p style="font-size:15px;color:#6E6E78;line-height:1.7;margin:0 0 24px;">
        ${firstName}, seu acompanhamento de <strong>${product}</strong> está na reta final.
        Aqui está um resumo da sua evolução:
      </p>
      <div style="display:flex;gap:12px;margin:0 0 24px;">
        <div style="flex:1;background:#F4F4F7;border-radius:12px;padding:20px 16px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#9E9EA8;line-height:1;margin-bottom:4px;">${scoreInicial}%</div>
          <div style="font-size:11px;color:#9E9EA8;">Semana 1</div>
        </div>
        <div style="flex:1;background:#F4F4F7;border-radius:12px;padding:20px 16px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#2D9B83;line-height:1;margin-bottom:4px;">${scoreAtual}%</div>
          <div style="font-size:11px;color:#6E6E78;">Semana 10 (${diffText})</div>
        </div>
      </div>
      <div style="text-align:center;margin:0 0 16px;">
        <a href="${url}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
          Ver painel completo
        </a>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${feedbackUrl}" style="color:#CF8523;font-size:13px;font-weight:500;text-decoration:underline;">
          Dar feedback sobre o Virô (30 segundos)
        </a>
      </div>
      <p style="font-size:13px;color:#9E9EA8;margin:0;line-height:1.6;">
        Quer renovar o acompanhamento? Responda este email.
      </p>
    `),
  });
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
  searchVolume?: number;
  url: string;
}): string {
  const { product, shortRegion, influencePercent, searchVolume, url } = opts;
  const influenceColor = influencePercent === 0 ? "#D9534F" : influencePercent < 20 ? "#CF8523" : "#2D9B83";
  const formattedVolume = searchVolume ? searchVolume.toLocaleString("pt-BR") : null;

  // Dynamic headline based on influence
  const headline = influencePercent === 0
    ? `Seu negócio está invisível em ${shortRegion}.`
    : influencePercent < 20
    ? `Você captura apenas ${influencePercent}% do mercado digital em ${shortRegion}.`
    : `Você já captura ${influencePercent}% do mercado — mas pode mais.`;

  // Dynamic insight
  const insight = influencePercent === 0
    ? `Quando alguém busca "${product}" em ${shortRegion}, seu negócio não aparece. Enquanto isso, seus concorrentes capturam esses clientes sem que você saiba.`
    : influencePercent < 20
    ? `A cada 100 pessoas que buscam "${product}" em ${shortRegion}, ${100 - influencePercent} vão para concorrentes. Não porque são melhores — porque são mais visíveis.`
    : `Boa posição, mas ${100 - influencePercent}% do mercado ainda vai para concorrentes. O diagnóstico mostra onde proteger e onde atacar.`;

  return emailShell(`
    <h1 style="font-size:22px;color:#161618;margin:0 0 12px;line-height:1.3;">
      ${headline}
    </h1>
    <p style="font-size:15px;color:#6E6E78;line-height:1.7;margin:0 0 24px;">
      ${insight}
    </p>
    <div style="display:flex;gap:12px;margin:0 0 24px;">
      <div style="flex:1;background:#F4F4F7;border-radius:12px;padding:20px 16px;text-align:center;">
        <div style="font-size:36px;font-weight:700;color:${influenceColor};line-height:1;margin-bottom:6px;">
          ${influencePercent}%
        </div>
        <div style="font-size:12px;color:#6E6E78;">Influência Digital</div>
      </div>
      ${formattedVolume ? `
      <div style="flex:1;background:#F4F4F7;border-radius:12px;padding:20px 16px;text-align:center;">
        <div style="font-size:36px;font-weight:700;color:#161618;line-height:1;margin-bottom:6px;">
          ${formattedVolume}
        </div>
        <div style="font-size:12px;color:#6E6E78;">Buscas/mês</div>
      </div>
      ` : ""}
    </div>
    <div style="background:#FEFAF3;border-left:3px solid #CF8523;padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="font-size:13px;color:#3A3A40;margin:0;line-height:1.6;">
        O diagnóstico mostra <strong>exatamente onde você está perdendo clientes</strong> — e as 3 ações prioritárias para virar esse jogo.
      </p>
    </div>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${url}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
        Ver meu diagnóstico completo
      </a>
    </div>
    <p style="font-size:12px;color:#9E9EA8;line-height:1.6;margin:0;">
      Dados coletados em tempo real: Google Search, Google Maps, Instagram, IA e IBGE.
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
