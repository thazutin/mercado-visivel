// ============================================================================
// Virô — Plan Generation Route
// After payment: generates full diagnostic (5 blocks) + 90-day plan via Claude
// File: src/app/api/plan/generate/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { notifyPlanReady } from "@/lib/notify";

export const maxDuration = 300;

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

    // 2. Generate in 2 calls: blocks + weekly plan (avoids token truncation)
    const model = "claude-sonnet-4-5-20250929";
    const context = buildContext(lead, raw);

    console.log(`[PlanGen] Generating blocks for lead ${leadId}...`);
    const blocksResponse = await claude.messages.create({
      model, max_tokens: 10000, temperature: 0.3,
      messages: [{ role: "user", content: buildBlocksPrompt(context) }],
    });
    const blocksText = blocksResponse.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    const blocks = JSON.parse(blocksText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
    console.log(`[PlanGen] Blocks OK: ${blocks.length} blocks`);

    console.log(`[PlanGen] Generating weekly plan for lead ${leadId}...`);
    const weeklyResponse = await claude.messages.create({
      model, max_tokens: 8000, temperature: 0.3,
      messages: [{ role: "user", content: buildWeeklyPrompt(context) }],
    });
    const weeklyText = weeklyResponse.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    const weeklyPlan = JSON.parse(weeklyText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
    console.log(`[PlanGen] Weekly plan OK: ${weeklyPlan.length} weeks`);

    // 3. Save plan to Supabase
    await supabase.from("plans").delete().eq("lead_id", leadId);
    const { error: planError } = await supabase.from("plans").insert({
      lead_id: leadId,
      content: { blocks, weeklyPlan },
      generation_model: model,
      status: "ready",
    });
    if (planError) {
      console.error("[PlanGen] Error saving plan:", planError);
      throw new Error(`Plan save failed: ${planError.message}`);
    }

    // 3b. Gerar plan_tasks a partir do weeklyPlan
    try {
      await generatePlanTasks(supabase, leadId, weeklyPlan || []);
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
  } catch (err: any) {
    console.error("[PlanGen] Error:", err?.message || err);

    // Mark as failed
    await supabase
      .from("leads")
      .update({ plan_status: "failed" })
      .eq("id", leadId);

    return NextResponse.json({ error: "Plan generation failed", detail: err?.message || String(err) }, { status: 500 });
  }
}

// ─── PLAN PROMPTS (split in 2 calls to avoid truncation) ─────────────

function buildContext(lead: any, raw: any): string {
  const volumes = raw.volumes?.termVolumes || [];
  const influence = raw.influence?.influence || {};
  const gaps = raw.gaps?.analysis || {};
  const sizing = raw.marketSizing?.sizing || {};

  const topTerms = volumes
    .sort((a: any, b: any) => (b.monthlyVolume || 0) - (a.monthlyVolume || 0))
    .slice(0, 10)
    .map((t: any) => `"${t.term}" — ${t.monthlyVolume || 0}/mês`)
    .join("\n  ");

  const serpPositions = influence.rawGoogle?.serpPositions || [];
  const serpSummary = serpPositions
    .slice(0, 5)
    .map((sp: any) => `"${sp.term}": posição ${sp.position || "—"}`)
    .join("\n  ");

  return `NEGÓCIO: ${lead.product} em ${lead.region}
Diferencial: "${lead.differentiator || "não informado"}"
Instagram: ${lead.instagram || "não informado"} · Site: ${lead.site || "não tem"}
Volume total: ${raw.volumes?.totalMonthlyVolume || 0} buscas/mês · Influência: ${influence.totalInfluence || 0}%

TERMOS: ${topTerms}
SERP: ${serpSummary}
GAPS: ${gaps.headlineInsight || "N/A"}
${(gaps.gaps || []).slice(0, 3).map((g: any) => `- ${g.title}`).join("\n")}`;
}

function buildBlocksPrompt(context: string): string {
  return `Você é Vero, estrategista de mercado da Virô. Gere 5 blocos de diagnóstico.

${context}

Retorne APENAS um array JSON com 5 objetos:
[
  {"id": "digital_presence", "title": "Presença Digital", "content": "markdown..."},
  {"id": "demand_map", "title": "Mapa de Demanda", "content": "markdown..."},
  {"id": "competitive_analysis", "title": "Análise Competitiva", "content": "markdown..."},
  {"id": "action_plan", "title": "Plano de Ação", "content": "markdown..."},
  {"id": "metrics", "title": "Métricas", "content": "markdown..."}
]

REGRAS:
- Content em markdown (##, **, listas). Máximo 300 palavras por bloco.
- Cite dados reais (volumes, posições, concorrentes).
- Bloco 1: onde está vs onde deveria estar. Bloco 2: termos por intenção. Bloco 3: concorrentes.
- Bloco 4: resumo das prioridades. Bloco 5: KPIs com baseline e meta 90 dias.
- Tom direto, sem jargão. Gere APENAS o JSON.`;
}

function buildWeeklyPrompt(context: string): string {
  return `Você é Vero, estrategista de mercado da Virô. Gere o plano semanal de 12 semanas.

${context}

Retorne APENAS um array JSON com 12 objetos:
[
  {"week": 1, "title": "Título curto", "mainAction": "Ação específica com passo a passo", "script": "Template/roteiro se aplicável", "kpi": "Métrica de execução", "category": "presence"}
]

REGRAS:
- category: "presence" | "content" | "authority" | "engagement"
- Semanas 1-4: quick wins (GMB, primeiras avaliações, primeiro conteúdo)
- Semanas 5-8: autoridade (conteúdo regular, parcerias locais)
- Semanas 9-12: otimização e escala
- Cada ação ESPECÍFICA: não "crie conteúdo", mas "grave Reels de 30s mostrando X"
- Cite dados reais do diagnóstico como fundamento
- Tom direto, acionável por alguém sem equipe de marketing
- Gere APENAS o JSON.`;
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
