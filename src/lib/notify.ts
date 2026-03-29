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
  projecaoFinanceira?: {
    mercadoTotal: number;
    receitaAtual: number;
    receitaPotencial: number;
    gapMensal: number;
    gapCaptura?: number;
    ticketMedio: number;
    taxaConversao: number;
    clientesGap?: number;
    familiasGap?: number;
  } | null;
  isB2B?: boolean;
}): Promise<void> {
  const { email, whatsapp, leadId, product, region, influencePercent, searchVolume, projecaoFinanceira } = opts;
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
      subject: `${(opts as any).name || product}, achei o que precisava. Veja o que encontrei.`,
      html: diagnosisEmailHtml({ product, shortRegion, influencePercent, searchVolume, url, projecaoFinanceira, isB2B: (opts as any).isB2B ?? false }),
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

// ─── Diagnóstico completo pós-pagamento ──────────────────────────────────────

export async function notifyFullDiagnosisReady(opts: {
  email: string;
  whatsapp: string;
  leadId: string;
  product: string;
  region: string;
  name?: string;
}): Promise<void> {
  const { email, whatsapp, leadId, product, region, name } = opts;
  const dashboardUrl = `${BASE_URL}/dashboard/${leadId}`;
  const shortRegion = region.split(",")[0].trim();
  const displayName = name || product;

  await Promise.allSettled([
    sendWhatsApp(
      whatsapp,
      WHATSAPP_TEMPLATES.plano_pronto,
      { "1": product, "2": shortRegion, "3": leadId },
    ),

    sendEmail({
      to: email,
      subject: `${displayName}, seu plano está pronto. Comece pelo primeiro item.`,
      html: fullDiagnosisEmailHtml({ product, shortRegion, url: dashboardUrl }),
    }),
  ]);
}

// ─── Conteúdos semanais (recorrência) ────────────────────────────────────────

export async function notifyWeeklyContents(opts: {
  leadId: string;
  email: string;
  name: string;
}): Promise<void> {
  const { leadId, email, name } = opts;
  const dashboardUrl = `${BASE_URL}/dashboard/${leadId}`;
  const firstName = name.split(" ")[0] || "Olá";

  await sendEmail({
    to: email,
    subject: `${firstName}, passei pelo seu mercado essa semana. Tem novidade.`,
    html: emailShell(`
      <h1 style="font-size:22px;color:#161618;margin:0 0 16px;line-height:1.3;">
        Seus conteúdos da semana estão prontos.
      </h1>
      <p style="font-size:15px;color:#6E6E78;line-height:1.7;margin:0 0 24px;">
        Seus 4 conteúdos desta semana foram gerados e estão no seu painel.
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${dashboardUrl}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
          Acessar agora
        </a>
      </div>
      <p style="font-size:13px;color:#9E9EA8;line-height:1.6;margin:0;">
        Copie, adapte e publique — o trabalho de criação já está feito.
      </p>
    `),
  });
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
    subject: `${firstName}, como está indo? Aqui está seu resumo.`,
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
    subject: `${firstName}, duas semanas. Veja o que mudou.`,
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
  projecaoFinanceira?: {
    mercadoTotal: number;
    receitaAtual: number;
    receitaPotencial: number;
    gapMensal: number;
    gapCaptura?: number;
    ticketMedio: number;
    taxaConversao: number;
    clientesGap?: number;
    familiasGap?: number;
  } | null;
  isB2B?: boolean;
}): string {
  const { product, shortRegion, influencePercent, searchVolume, url, projecaoFinanceira, isB2B = false } = opts;
  const influenceColor = influencePercent === 0 ? "#D9534F" : influencePercent < 20 ? "#CF8523" : "#2D9B83";
  const formattedVolume = searchVolume ? searchVolume.toLocaleString("pt-BR") : null;

  const gapPequeno = (projecaoFinanceira?.clientesGap || 0) === 0
    || (projecaoFinanceira?.gapCaptura || 0) < 500;
  const destacarFamilias = gapPequeno && (projecaoFinanceira?.familiasGap || 0) > 0;

  const isNacional = /brasil|nacional/i.test(shortRegion || '');
  const isB2BNacional = isB2B && isNacional;

  // Dynamic headline based on influence
  const headline = isB2BNacional
    ? `Você disputa ${influencePercent}% da atenção digital no mercado nacional de ${product}.`
    : influencePercent === 0
    ? `Seu negócio não aparece para nenhum cliente em potencial em ${shortRegion}.`
    : influencePercent < 20
    ? `Você disputa por apenas ${influencePercent}% das decisões de compra em ${shortRegion}.`
    : `Você já disputa ${influencePercent}% do mercado em ${shortRegion} — mas pode mais.`;

  // Dynamic insight — voz do Nelson
  const insight = isB2BNacional
    ? `Vasculhei seu mercado. No mercado nacional de ${product}, centenas de empresas competem pela mesma atenção. Com ${influencePercent}% de posição competitiva digital, há espaço real para crescer.`
    : influencePercent === 0
    ? `Vasculhei seu mercado. Seu negócio não está aparecendo quando alguém busca o que você faz em ${shortRegion}. Os concorrentes capturam esses clientes — e você nem fica sabendo.`
    : influencePercent < 20
    ? `Vasculhei seu mercado. A cada 100 decisões de compra de ${product} em ${shortRegion}, você disputa ${influencePercent}. As outras ${100 - influencePercent} vão para quem aparece antes — não necessariamente para quem é melhor.`
    : `Vasculhei seu mercado. Você já tem uma base sólida — ${influencePercent}% das decisões passam por você. Mas ${100 - influencePercent}% ainda vão para outros. Aqui está onde atacar.`;

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
    ${projecaoFinanceira && (
      (projecaoFinanceira.gapCaptura || 0) > 0 ||
      (projecaoFinanceira.familiasGap || 0) > 0
    ) ? `
    <div style="background:#161618;border-radius:12px;padding:20px;margin:0 0 24px;">
      <div style="font-size:10px;color:#6E6E78;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:14px;font-family:monospace;">
        O que está em jogo
      </div>
      ${destacarFamilias ? `
      <div style="text-align:center;padding:12px 0;">
        <div style="font-size:32px;font-weight:700;color:#2D9B83;">
          +${(projecaoFinanceira.familiasGap ?? 0).toLocaleString('pt-BR')}
        </div>
        <div style="font-size:12px;color:#9E9EA8;margin-top:4px;">
          ${isB2B ? 'empresas' : 'pessoas'} adicionais que passam a considerar você com o plano
        </div>
      </div>
      <div style="text-align:center;font-size:11px;color:#6E6E78;padding:8px 0;border-top:1px solid #3A3A40;">
        Via buscas ativas: R$${Math.round((projecaoFinanceira.receitaAtual || 0) / 1000)}k/mês hoje → R$${Math.round((projecaoFinanceira.receitaPotencial || 0) / 1000)}k/mês com o plano
      </div>
      ` : `
      <div style="display:flex;gap:10px;margin-bottom:12px;">
        <div style="flex:1;background:#232326;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#C8C8D0;">
            R$${Math.round(projecaoFinanceira.receitaAtual / 1000)}k/mês
          </div>
          <div style="font-size:10px;color:#6E6E78;margin-top:4px;">você disputa hoje</div>
        </div>
        <div style="flex:1;background:#232326;border-radius:8px;padding:12px;text-align:center;border:1px solid rgba(207,133,35,0.3);">
          <div style="font-size:20px;font-weight:700;color:#E6A445;">
            R$${Math.round(projecaoFinanceira.receitaPotencial / 1000)}k/mês
          </div>
          <div style="font-size:10px;color:#6E6E78;margin-top:4px;">com o plano</div>
        </div>
      </div>
      ${(projecaoFinanceira.clientesGap ?? 0) > 0 ? `
      <div style="text-align:center;font-size:12px;color:#C8C8D0;margin-bottom:10px;">
        +${projecaoFinanceira.clientesGap} cliente${projecaoFinanceira.clientesGap !== 1 ? 's' : ''}/mês via buscas ativas
      </div>` : ''}
      `}
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #3A3A40;font-size:10px;color:#6E6E78;text-align:center;">
        Ticket estimado: R$${projecaoFinanceira.ticketMedio} · Conversão: ${(projecaoFinanceira.taxaConversao * 100).toFixed(0)}%
      </div>
    </div>
    ` : ''}
    <div style="background:#FEFAF3;border-left:3px solid #CF8523;padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="font-size:13px;color:#3A3A40;margin:0;line-height:1.6;">
        Ver onde você está perdendo clientes e os <strong>primeiros passos</strong>.
      </p>
    </div>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${url}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
        Ver meu diagnóstico personalizado
      </a>
    </div>
    <p style="font-size:12px;color:#9E9EA8;line-height:1.6;margin:0;">
      Dados coletados em tempo real: Google Search, Google Maps, Instagram, IA e IBGE.
    </p>
  `);
}

function fullDiagnosisEmailHtml({
  product,
  shortRegion,
  url,
}: {
  product: string;
  shortRegion: string;
  url: string;
}): string {
  return emailShell(`
    <div style="background:#0A0A0C;border-radius:16px;padding:28px 24px;margin-bottom:24px;">
      <p style="font-size:13px;color:#9E9EA8;margin:0 0 8px;font-family:monospace;letter-spacing:0.06em;text-transform:uppercase;">
        Diagnóstico completo pronto
      </p>
      <h1 style="font-size:22px;font-weight:700;color:#FEFEFF;margin:0 0 12px;line-height:1.3;">
        ${product} em ${shortRegion} — tudo no seu painel.
      </h1>
      <p style="font-size:14px;color:#9E9EA8;margin:0;line-height:1.6;">
        Geramos tudo com dados reais do seu mercado. Abra o painel para ver o que encontramos.
      </p>
    </div>

    <div style="margin-bottom:24px;">
      <p style="font-size:11px;color:#6E6E78;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 12px;font-family:monospace;">
        O que você encontra no painel
      </p>

      <div style="background:#161618;border-radius:10px;padding:14px 16px;margin-bottom:8px;border-left:3px solid #2D9B83;">
        <div style="font-size:13px;font-weight:600;color:#FEFEFF;margin-bottom:4px;">Diagnóstico por canal</div>
        <div style="font-size:12px;color:#6E6E78;line-height:1.5;">Google, Instagram, Maps e IA — onde você está forte e onde está perdendo.</div>
      </div>

      <div style="background:#161618;border-radius:10px;padding:14px 16px;margin-bottom:8px;border-left:3px solid #CF8523;">
        <div style="font-size:13px;font-weight:600;color:#FEFEFF;margin-bottom:4px;">Itens estruturantes</div>
        <div style="font-size:12px;color:#6E6E78;line-height:1.5;">O básico que precisa estar no lugar — checklist baseada nos gaps do seu negócio, ordenada por impacto.</div>
      </div>

      <div style="background:#161618;border-radius:10px;padding:14px 16px;margin-bottom:8px;border-left:3px solid #8B5CF6;">
        <div style="font-size:13px;font-weight:600;color:#FEFEFF;margin-bottom:4px;">Relatório setorial</div>
        <div style="font-size:12px;color:#6E6E78;line-height:1.5;">Tendências reais do mercado de ${product} em ${shortRegion} — o contexto que dá direção às suas ações.</div>
      </div>

      <div style="background:#161618;border-radius:10px;padding:14px 16px;border-left:3px solid #E1306C;">
        <div style="font-size:13px;font-weight:600;color:#FEFEFF;margin-bottom:4px;">Posts prontos para publicar</div>
        <div style="font-size:12px;color:#6E6E78;line-height:1.5;">Conectados ao contexto do seu mercado esta semana — copie, adapte e publique.</div>
      </div>
    </div>

    <a href="${url}" style="display:block;background:#FEFEFF;color:#0A0A0C;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:16px;">
      Acessar meu painel →
    </a>

    <p style="font-size:11px;color:#6E6E78;text-align:center;margin:0;line-height:1.6;">
      Seu painel fica disponível por 12 meses.<br/>
      Conteúdos atualizados toda sexta com o contexto do seu mercado.
    </p>
  `);
}
