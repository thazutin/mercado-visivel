// ============================================================================
// Virô — Plan Generation Route
// After payment: generates full diagnostic (5 blocks) + 90-day plan via Claude
// File: src/app/api/plan/generate/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function getClaude() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

export async function POST(req: NextRequest) {
  // Verify internal secret
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.INTERNAL_API_SECRET || "viro-internal")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const claude = getClaude();

  try {
    // 1. Load lead + diagnosis data
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data: diagnosis } = await supabase
      .from("diagnoses")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!diagnosis) {
      return NextResponse.json({ error: "Diagnosis not found" }, { status: 404 });
    }

    const raw = diagnosis.raw_data || {};

    // 2. Build comprehensive prompt for Claude
    const prompt = buildPlanPrompt(lead, raw);

    console.log(`[PlanGen] Generating plan for lead ${leadId}...`);

    const response = await claude.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");

    const plan = JSON.parse(
      text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()
    );

    // 3. Save plan to Supabase
    await supabase.from("plans").upsert({
      lead_id: leadId,
      blocks: plan.blocks,
      weekly_plan: plan.weeklyPlan,
      generated_at: new Date().toISOString(),
      model: "claude-sonnet-4-5-20250929",
      status: "ready",
    });

    // 4. Update lead status
    await supabase
      .from("leads")
      .update({ plan_status: "ready" })
      .eq("id", leadId);

    // 5. Send email with plan link
    await sendPlanEmail(lead.email, leadId, lead.product, lead.region);

    // 6. Send WhatsApp notification
    await sendPlanWhatsApp(lead.whatsapp, leadId, lead.product);

    console.log(`[PlanGen] Plan ready for lead ${leadId}`);

    return NextResponse.json({ ok: true, leadId });
  } catch (err) {
    console.error("[PlanGen] Error:", err);

    // Mark as failed
    await supabase
      .from("leads")
      .update({ plan_status: "failed" })
      .eq("id", leadId);

    return NextResponse.json({ error: "Plan generation failed" }, { status: 500 });
  }
}

// ─── PLAN PROMPT ────────────────────────────────────────────────────

function buildPlanPrompt(lead: any, raw: any): string {
  const terms = raw.terms?.terms || [];
  const volumes = raw.volumes?.termVolumes || [];
  const influence = raw.influence?.influence || {};
  const gaps = raw.gaps?.analysis || {};
  const sizing = raw.marketSizing?.sizing || {};

  const topTerms = volumes
    .sort((a: any, b: any) => (b.monthlyVolume || 0) - (a.monthlyVolume || 0))
    .slice(0, 15)
    .map((t: any) => `"${t.term}" — ${t.monthlyVolume || 0} buscas/mês`)
    .join("\n  ");

  const serpPositions = influence.rawGoogle?.serpPositions || [];
  const serpSummary = serpPositions
    .slice(0, 10)
    .map((sp: any) => `"${sp.term}": posição ${sp.position || "não encontrado"}`)
    .join("\n  ");

  return `Você é Vero, o estrategista de mercado da Virô. Gere o PLANO COMPLETO para este negócio local.

DADOS DO NEGÓCIO:
  Produto: ${lead.product}
  Região: ${lead.region}
  Diferencial: "${lead.differentiator}"
  Desafio: "${lead.challenge}"
  Ticket médio: R$${lead.ticket}
  Canais atuais: ${(lead.channels || []).join(", ")}
  Instagram: ${lead.instagram || "não informado"}
  Site: ${lead.site || "não tem"}

DADOS REAIS DO PIPELINE:
  Total de termos mapeados: ${terms.length}
  Volume total de buscas: ${raw.volumes?.totalMonthlyVolume || 0}/mês
  Influência digital: ${influence.totalInfluence || 0}%
  Mercado potencial: R$${sizing.marketPotential?.low?.toLocaleString() || 0} — R$${sizing.marketPotential?.high?.toLocaleString() || 0}/mês

TERMOS PRINCIPAIS:
  ${topTerms}

POSIÇÕES SERP:
  ${serpSummary}

GAPS IDENTIFICADOS:
  Padrão: ${gaps.primaryPattern?.title || "N/A"}
  Headline: ${gaps.headlineInsight || "N/A"}
  ${(gaps.gaps || []).map((g: any) => `- ${g.title}: ${g.evidence}`).join("\n  ")}

GERE EM JSON:
{
  "blocks": [
    {
      "id": "digital_presence",
      "title": "Diagnóstico de Presença Digital",
      "content": "Análise detalhada em markdown..."
    },
    {
      "id": "demand_map",
      "title": "Mapa de Demanda",
      "content": "Todos os termos com análise..."
    },
    {
      "id": "competitive_analysis",
      "title": "Análise Competitiva",
      "content": "Comparativo detalhado..."
    },
    {
      "id": "action_plan",
      "title": "Plano de Ação — 90 dias",
      "content": "Resumo executivo do plano..."
    },
    {
      "id": "metrics",
      "title": "Métricas e Acompanhamento",
      "content": "KPIs, baseline e metas..."
    }
  ],
  "weeklyPlan": [
    {
      "week": 1,
      "title": "Título da semana",
      "mainAction": "Ação principal detalhada com passo a passo",
      "script": "Roteiro ou template se aplicável",
      "kpi": "Métrica para saber se executou",
      "category": "presence|content|authority|engagement"
    }
  ]
}

REGRAS PARA O PLANO SEMANAL:
- 12 semanas, cada uma com 1 ação PRINCIPAL (não 5 — o dono é ocupado)
- Cada ação deve ser ESPECÍFICA: não "crie conteúdo", mas "grave Reels de 30s mostrando X com roteiro Y"
- Inclua SCRIPTS e TEMPLATES quando relevante (script de pedido de review, roteiro de vídeo, template de post)
- As primeiras 4 semanas devem ser QUICK WINS (GMB, primeiro conteúdo, primeiras avaliações)
- Semanas 5-8: construção de autoridade (conteúdo regular, parcerias locais)
- Semanas 9-12: otimização e escala (o que funcionou, dobrar aposta)
- Cada ação cita pelo menos 1 dado real do diagnóstico como fundamento
- O tom é direto, sem jargão, acionável por alguém sem equipe de marketing

REGRAS PARA OS BLOCOS:
- Use markdown no content (##, **, listas)
- Cite dados reais do pipeline (volumes, posições, concorrentes)
- Bloco 1: onde está vs onde deveria estar, por canal
- Bloco 2: termos organizados por intenção e volume, com oportunidades
- Bloco 3: quem aparece onde o negócio não aparece, forças/fraquezas
- Bloco 4: resumo do plano semanal com lógica de priorização
- Bloco 5: KPIs claros com baseline (hoje) e meta (90 dias)

Gere APENAS o JSON. Sem texto antes ou depois.`;
}

// ─── EMAIL DELIVERY ─────────────────────────────────────────────────

async function sendPlanEmail(email: string, leadId: string, product: string, region: string) {
  if (!process.env.RESEND_API_KEY || !email) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com";
  const dashboardUrl = `${baseUrl}/dashboard/${leadId}`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Virô <entrega@virolocal.com>",
        to: email,
        subject: `Seu diagnóstico completo está pronto — ${product} em ${region}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 44px; height: 44px; border-radius: 14px; background: #161618; display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-weight: 700; font-size: 20px; color: #FEFEFF;">V</span>
              </div>
            </div>
            <h1 style="font-size: 22px; color: #161618; margin-bottom: 16px;">Seu plano está pronto.</h1>
            <p style="font-size: 15px; color: #6E6E78; line-height: 1.7; margin-bottom: 24px;">
              O diagnóstico completo e o plano de ação de 90 dias para <strong>${product}</strong> em <strong>${region}</strong> 
              estão disponíveis no seu dashboard.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${dashboardUrl}" style="background: #161618; color: #FEFEFF; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                Acessar meu plano
              </a>
            </div>
            <p style="font-size: 13px; color: #9E9EA8; line-height: 1.6;">
              A partir de agora, toda segunda-feira você receberá um briefing semanal com o que mudou no seu mercado 
              e a ação da semana. O primeiro chega na próxima segunda.
            </p>
            <hr style="border: none; border-top: 1px solid #EAEAEE; margin: 32px 0;" />
            <p style="font-size: 11px; color: #9E9EA8; text-align: center;">
              Virô · virolocal.com · inteligência de mercado local
            </p>
          </div>
        `,
      }),
    });
    console.log(`[PlanGen] Email sent to ${email}`);
  } catch (err) {
    console.error("[PlanGen] Email failed:", err);
  }
}

// ─── WHATSAPP NOTIFICATION ──────────────────────────────────────────

async function sendPlanWhatsApp(whatsapp: string, leadId: string, product: string) {
  if (!process.env.TWILIO_ACCOUNT_SID || !whatsapp) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com";
  const dashboardUrl = `${baseUrl}/dashboard/${leadId}`;

  // Clean phone number
  const phone = whatsapp.replace(/\D/g, "");
  const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:+${fullPhone}`,
        Body: `✅ Seu diagnóstico completo para *${product}* está pronto!\n\nAcesse aqui: ${dashboardUrl}\n\nA partir de agora, toda segunda você recebe o briefing semanal com as mudanças no seu mercado e a ação da semana.\n\n— Virô`,
      }),
    });
    console.log(`[PlanGen] WhatsApp sent to ${fullPhone}`);
  } catch (err) {
    console.error("[PlanGen] WhatsApp failed:", err);
  }
}
