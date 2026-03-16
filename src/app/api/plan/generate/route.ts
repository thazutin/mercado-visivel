// ============================================================================
// Virô — Plan Generation Route
// After payment: generates full diagnostic (5 blocks) + 90-day plan via Claude
// File: src/app/api/plan/generate/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { notifyPlanReady } from "@/lib/notify";

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

    // 3b. Gerar plan_tasks a partir do weeklyPlan
    try {
      await generatePlanTasks(supabase, leadId, plan.weeklyPlan || []);
    } catch (taskErr) {
      // Não-fatal: se falhar, o plano texto continua funcionando
      console.error("[PlanGen] Task generation failed (non-fatal):", taskErr);
    }

    // 4. Update lead status
    await supabase
      .from("leads")
      .update({ plan_status: "ready" })
      .eq("id", leadId);

    // 5. Notifica por WhatsApp + email
    await notifyPlanReady({
      email: lead.email,
      whatsapp: lead.whatsapp,
      leadId,
      product: lead.product,
      region: lead.region,
    });

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

// ─── PLAN TASKS GENERATION ─────────────────────────────────────────

const CATEGORY_TO_CHANNEL: Record<string, string> = {
  presence: "google_maps",
  content: "instagram",
  authority: "geral",
  engagement: "instagram",
};

async function generatePlanTasks(supabase: any, leadId: string, weeklyPlan: any[]) {
  if (!weeklyPlan || weeklyPlan.length === 0) return;

  // Limpa tasks anteriores (re-geração)
  await supabase.from("plan_tasks").delete().eq("lead_id", leadId);

  const tasks: any[] = [];

  for (const week of weeklyPlan) {
    const channel = CATEGORY_TO_CHANNEL[week.category] || "geral";

    // Task principal: mainAction da semana
    tasks.push({
      lead_id: leadId,
      week: week.week,
      channel,
      title: week.title,
      description: week.mainAction || "",
      completed: false,
    });

    // Task secundária: KPI como tarefa de verificação
    if (week.kpi) {
      tasks.push({
        lead_id: leadId,
        week: week.week,
        channel,
        title: `Verificar meta: ${week.kpi}`,
        description: week.script ? `Roteiro: ${week.script}` : "",
        completed: false,
      });
    }
  }

  if (tasks.length > 0) {
    const { error } = await supabase.from("plan_tasks").insert(tasks);
    if (error) {
      console.error("[PlanGen] Error inserting plan_tasks:", error);
      throw error;
    }
    console.log(`[PlanGen] Inserted ${tasks.length} plan_tasks for lead ${leadId}`);
  }
}

// (Email e WhatsApp centralizados em src/lib/notify.ts)
