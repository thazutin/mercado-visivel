// ============================================================================
// Virô — Plan Generation API
// POST /api/plan/generate
// Triggered by webhook after payment. Generates full diagnosis + 12-week plan.
// ============================================================================
// File: src/app/api/plan/generate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { trackEvent } from "@/lib/events";

const PLAN_VERSION = "v1.0";
const MODEL = "claude-sonnet-4-5-20250929"; // Use Sonnet for speed; switch to Opus for depth

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  // Verify internal call
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.INTERNAL_API_SECRET || "viro-internal")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const startTime = Date.now();

  try {
    // ─── 1. Load lead + diagnosis data ───
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      console.error("[PlanGen] Lead not found:", leadId);
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
      console.error("[PlanGen] No diagnosis found for lead:", leadId);
      await supabase
        .from("leads")
        .update({ plan_status: "error" })
        .eq("id", leadId);
      return NextResponse.json({ error: "No diagnosis data" }, { status: 404 });
    }

    // ─── 2. Build context for Claude ───
    const rawData = diagnosis.raw_data || {};
    const context = buildPlanContext(lead, diagnosis, rawData);

    console.log(`[PlanGen] Generating plan for ${leadId} (${lead.product} in ${lead.region})`);

    // ─── 3. Generate plan via Claude ───
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: context,
        },
      ],
    });

    const planText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // ─── 4. Parse structured plan ───
    let planBlocks;
    try {
      planBlocks = JSON.parse(planText);
    } catch {
      // If Claude didn't return valid JSON, wrap in a fallback structure
      console.warn("[PlanGen] Claude returned non-JSON, wrapping in fallback structure");
      planBlocks = {
        blocks: [
          {
            id: "full_plan",
            title: "Diagnóstico e Plano",
            content: planText,
          },
        ],
      };
    }

    // ─── 5. Save plan to Supabase ───
    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .insert({
        lead_id: leadId,
        content: planBlocks,
        blocks: planBlocks.blocks || [],
        plan_version: PLAN_VERSION,
        generation_model: MODEL,
        generation_prompt_version: PLAN_VERSION,
        raw_input: { lead, diagnosis: { ...diagnosis, raw_data: "[omitted]" } },
        status: "ready",
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (planErr) {
      console.error("[PlanGen] Failed to save plan:", planErr);
      await supabase
        .from("leads")
        .update({ plan_status: "error" })
        .eq("id", leadId);
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }

    // ─── 6. Update lead status ───
    await supabase
      .from("leads")
      .update({
        plan_status: "ready",
        plan_id: plan.id,
      })
      .eq("id", leadId);

    // ─── 7. Save baseline snapshot (week 0) ───
    try {
      await supabase.from("snapshots").insert({
        lead_id: leadId,
        week_number: 0,
        data: rawData,
        sources_used: rawData.sourcesUsed || [],
        sources_unavailable: rawData.sourcesUnavailable || [],
      });
    } catch (err) {
      console.warn("[PlanGen] Baseline snapshot save failed:", err);
    }

    // ─── 8. Send delivery email ───
    try {
      await sendDeliveryEmail(lead.email, leadId, lead.product, lead.region);
    } catch (err) {
      console.error("[PlanGen] Delivery email failed:", err);
      // Non-fatal
    }

    // ─── 9. Track event ───
    await trackEvent({
      eventType: "dashboard_viewed", // plan_generated would be better, using existing type
      leadId,
      metadata: {
        plan_id: plan.id,
        generation_time_ms: Date.now() - startTime,
        model: MODEL,
      },
    });

    console.log(
      `[PlanGen] Plan generated for ${leadId} in ${Date.now() - startTime}ms`
    );

    return NextResponse.json({
      ok: true,
      planId: plan.id,
      generationTimeMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error("[PlanGen] Error:", err);
    await supabase
      .from("leads")
      .update({ plan_status: "error" })
      .eq("id", leadId);
    return NextResponse.json({ error: "Plan generation failed" }, { status: 500 });
  }
}

// ─── DELIVERY EMAIL ──────────────────────────────────────────────────

async function sendDeliveryEmail(
  email: string,
  leadId: string,
  product: string,
  region: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[Email] RESEND_API_KEY not set, skipping delivery email");
    return;
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com"}/dashboard/${leadId}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Virô <noreply@virolocal.com>",
      to: email,
      subject: `Seu diagnóstico está pronto — ${product} em ${region}`,
      html: `
        <div style="font-family: 'Satoshi', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="font-size: 24px; font-weight: 700; color: #161618; letter-spacing: -0.03em; margin-bottom: 8px;">Virô</div>
          <div style="width: 40px; height: 3px; background: #CF8523; margin-bottom: 32px;"></div>
          
          <p style="font-size: 18px; font-weight: 600; color: #161618; margin-bottom: 16px;">
            Seu diagnóstico completo está pronto.
          </p>
          
          <p style="font-size: 15px; color: #6E6E78; line-height: 1.7; margin-bottom: 24px;">
            Analisamos o mercado de <strong style="color: #161618;">${product}</strong> em 
            <strong style="color: #161618;">${region}</strong>. O diagnóstico inclui:
          </p>
          
          <div style="background: #F4F4F7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="font-size: 13px; color: #6E6E78; line-height: 1.8;">
              ◆ O Número — demanda real e dimensionamento<br>
              ◆ O Espelho — percepção vs. realidade<br>
              ◆ Mapa Competitivo — quem captura o quê<br>
              ◆ Ajustes Imediatos — ações de alto impacto<br>
              ◆ Plano 12 Semanas — ações semanais priorizadas
            </div>
          </div>
          
          <a href="${dashboardUrl}" style="
            display: inline-block; padding: 14px 32px; border-radius: 10px;
            background: #161618; color: #FEFEFF; text-decoration: none;
            font-size: 15px; font-weight: 600;
          ">
            Abrir meu diagnóstico →
          </a>
          
          <p style="font-size: 13px; color: #9E9EA8; margin-top: 32px; line-height: 1.6;">
            A partir de agora, toda segunda-feira você receberá um briefing com o que mudou no seu mercado e o que fazer. São 12 semanas de acompanhamento.
          </p>
          
          <div style="border-top: 1px solid #EAEAEE; margin-top: 40px; padding-top: 20px;">
            <span style="font-size: 12px; color: #9E9EA8;">Virô · inteligência de mercado local · virolocal.com</span>
          </div>
        </div>
      `,
    }),
  });

  console.log(`[Email] Delivery email sent to ${email}`);
}

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o motor de análise do Virô — uma plataforma de inteligência de mercado para negócios locais brasileiros.

Você recebe dados reais sobre um negócio local e deve gerar um diagnóstico completo estruturado em 5 blocos, em formato JSON.

REGRAS:
- Cada insight DEVE ser baseado nos dados fornecidos, nunca inventado
- Cada número deve ter fonte declarada
- Tom direto, sem jargão corporativo. Fale como quem conhece a rua
- Use "você" — conversa 1:1 com o dono do negócio
- Seja específico ao negócio e à região — nada genérico
- Quando dados estão indisponíveis, declare a limitação com transparência
- O plano de 12 semanas deve ser ACIONÁVEL: cada semana tem 1-2 ações concretas

FORMATO DE RESPOSTA (JSON válido):
{
  "blocks": [
    {
      "id": "o_numero",
      "title": "O Número",
      "subtitle": "O tamanho da oportunidade ao redor de você",
      "content": {
        "headline": "string — frase de impacto com o número principal",
        "narrative": "string — 2-3 parágrafos explicando o mercado",
        "keyMetrics": [
          { "label": "string", "value": "string", "source": "string", "confidence": "high|medium|low" }
        ],
        "assumptions": ["string — cada premissa usada no cálculo"]
      }
    },
    {
      "id": "o_espelho",
      "title": "O Espelho",
      "subtitle": "O que você comunica vs. o que seu cliente percebe",
      "content": {
        "headline": "string",
        "narrative": "string",
        "gaps": [
          { "what_you_say": "string", "what_they_see": "string", "impact": "string" }
        ]
      }
    },
    {
      "id": "mapa_competitivo",
      "title": "Mapa Competitivo",
      "subtitle": "Quem captura atenção no seu mercado",
      "content": {
        "headline": "string",
        "narrative": "string",
        "competitors": [
          { "name": "string", "strength": "string", "weakness": "string", "influence_score": "number" }
        ]
      }
    },
    {
      "id": "ajustes_imediatos",
      "title": "Ajustes Imediatos",
      "subtitle": "3-5 ações de alto impacto para esta semana",
      "content": {
        "headline": "string",
        "actions": [
          { "action": "string", "why": "string", "how": "string", "impact": "alto|médio", "effort": "baixo|médio|alto" }
        ]
      }
    },
    {
      "id": "plano_12_semanas",
      "title": "Plano 12 Semanas",
      "subtitle": "Uma ação por semana. Priorizado por impacto.",
      "content": {
        "headline": "string",
        "narrative": "string — visão geral da estratégia",
        "weeks": [
          { "week": 1, "theme": "string", "action": "string", "why": "string", "how": "string", "metric": "string — como saber se funcionou" }
        ]
      }
    }
  ],
  "meta": {
    "generated_at": "ISO date",
    "confidence_level": "high|medium|low",
    "data_sources": ["string"],
    "limitations": ["string"]
  }
}

Responda APENAS com o JSON. Sem texto antes ou depois.`;

// ─── CONTEXT BUILDER ─────────────────────────────────────────────────

function buildPlanContext(lead: any, diagnosis: any, rawData: any): string {
  const terms = diagnosis.terms || [];
  const influence = rawData.influence?.influence || {};
  const gaps = rawData.gaps?.analysis || {};
  const sizing = rawData.marketSizing?.sizing || {};
  const serpPositions = influence.rawGoogle?.serpPositions || [];
  const mapsPresence = influence.rawGoogle?.mapsPresence || {};
  const igProfile = influence.rawInstagram?.profile || {};
  const igCompetitors = influence.rawInstagram?.competitors || [];

  return `NEGÓCIO:
- Produto/Serviço: ${lead.product}
- Como o cliente descreve: ${lead.customer_description || "(não informado)"}
- Região: ${lead.region}
- Endereço: ${lead.address || "(não informado)"}
- Ticket médio: R$${lead.ticket || "não informado"}
- Diferencial declarado: ${lead.differentiator || "(não informado)"}
- Canais atuais: ${(lead.channels || []).join(", ") || "(não informado)"}
- Maior desafio: ${lead.challenge || "(não informado)"}
- Observações do dono: ${lead.free_text || "(nenhuma)"}

PRESENÇA DIGITAL:
- Instagram: @${lead.instagram || "(sem)"}
  → Seguidores: ${igProfile.followers || 0}
  → Engagement rate: ${(igProfile.engagementRate * 100 || 0).toFixed(1)}%
  → Posts últimos 30 dias: ${igProfile.postsLast30d || 0}
  → Média de likes: ${igProfile.avgLikesLast30d || 0}
  → Média de views (reels): ${igProfile.avgViewsReelsLast30d || 0}
  → Bio: ${igProfile.bio || "(vazia)"}
- Site: ${lead.site || "(sem)"}
- Google Maps: ${mapsPresence.found ? `Encontrado — nota ${mapsPresence.rating || "?"}, ${mapsPresence.reviewCount || 0} reviews` : "Não encontrado"}

CONCORRENTES DECLARADOS:
${(lead.competitors || []).map((c: any, i: number) => {
  const igComp = igCompetitors.find((p: any) => p.handle === c.instagram?.replace("@", ""));
  return `${i + 1}. ${c.name}${c.instagram ? ` (@${c.instagram.replace("@", "")})` : ""}${igComp ? ` — ${igComp.followers} seguidores, engagement ${(igComp.engagementRate * 100).toFixed(1)}%` : ""}`;
}).join("\n")}

DADOS DE MERCADO:
- Termos de busca mapeados: ${terms.length}
${terms.slice(0, 15).map((t: any) => `  • "${t.term}" — volume: ${t.volume}/mês, posição: ${t.position}`).join("\n")}
- Volume total de buscas/mês: ${diagnosis.total_volume}
- Market sizing: R$${sizing.marketPotential?.low || diagnosis.market_low} – R$${sizing.marketPotential?.high || diagnosis.market_high}/ano
- Influência atual: ${diagnosis.influence_percent}%
  → Google (CTR share): ${influence.google?.score || 0}%
  → Instagram (IMSP): ${influence.instagram?.score || 0}%

POSIÇÃO NO GOOGLE (SERP):
${serpPositions.slice(0, 10).map((sp: any) => `  • "${sp.term}" — posição: ${sp.position || "não encontrado"}, features: [${(sp.serpFeatures || []).join(", ")}]`).join("\n") || "  (dados SERP indisponíveis)"}

GAP ANALYSIS (análise prévia):
- Headline: ${gaps.headlineInsight || "(não disponível)"}
- Padrão principal: ${gaps.primaryPattern?.title || "(não detectado)"}
${(gaps.gaps || []).map((g: any) => `- Gap: ${g.title}: ${g.description}`).join("\n")}

CONFIANÇA DOS DADOS: ${diagnosis.confidence_level || diagnosis.confidence || "low"}
FONTES USADAS: ${diagnosis.source || "(não registradas)"}

Com base nesses dados, gere o diagnóstico completo em JSON conforme o formato especificado no system prompt.`;
}
