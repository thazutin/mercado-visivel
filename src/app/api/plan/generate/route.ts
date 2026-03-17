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
      console.error("[PlanGen] Task generation failed (non-fatal):", taskErr);
    }

    // 3c. Gerar primeiro briefing (semana 0 — boas-vindas)
    try {
      await generateWelcomeBriefing(supabase, claude, leadId, lead, weeklyPlan);
    } catch (briefErr) {
      console.error("[PlanGen] Welcome briefing failed (non-fatal):", briefErr);
    }

    // 4. Update lead status
    await supabase
      .from("leads")
      .update({ plan_status: "ready", weeks_active: 0 })
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
  return `Você é um consultor de mercado local que fala de forma simples e direta.

${context}

Gere 5 blocos de análise para o dono deste negócio. Retorne APENAS um array JSON:
[
  {"id": "digital_presence", "title": "Onde você aparece hoje", "content": "markdown..."},
  {"id": "demand_map", "title": "O que as pessoas buscam", "content": "markdown..."},
  {"id": "competitive_analysis", "title": "Quem compete com você", "content": "markdown..."},
  {"id": "action_plan", "title": "O que fazer primeiro", "content": "markdown..."},
  {"id": "metrics", "title": "Como medir o progresso", "content": "markdown..."}
]

REGRAS DE LINGUAGEM (muito importante):
- Escreva como se estivesse explicando para o dono do negócio pessoalmente
- NUNCA use termos técnicos de marketing: nada de "Map Pack", "SERP", "CTR", "SEO", "engajamento", "alcance orgânico", "conversão", "funil"
- Use equivalentes simples: "resultados do Google" (não SERP), "aparecer no Google Maps" (não Map Pack), "pessoas que buscam" (não tráfego orgânico)
- Cite dados reais (números de buscas, posições, concorrentes) mas explique o que significam na prática
- Máximo 300 palavras por bloco. Markdown (##, **, listas).
- Bloco 1: onde aparece e onde não aparece. Bloco 2: o que as pessoas procuram. Bloco 3: quem aparece no lugar dele.
- Bloco 4: as 3 coisas mais importantes para fazer. Bloco 5: como saber se está funcionando (metas simples).
- Tom: direto, útil, como um vizinho que entende de negócio.
- Gere APENAS o JSON.`;
}

function buildWeeklyPrompt(context: string): string {
  return `Você é um consultor de mercado local que fala de forma simples e direta.

${context}

Gere um plano de 12 semanas para este negócio. Retorne APENAS um array JSON com 12 objetos:
[
  {"week": 1, "title": "Título curto", "mainAction": "O que fazer, passo a passo", "script": "Texto pronto para usar (se aplicável)", "kpi": "Como saber se fez certo", "category": "presence"}
]

REGRAS DE LINGUAGEM (muito importante):
- NUNCA use jargão de marketing: nada de "engajamento", "awareness", "posicionamento", "branding", "otimização"
- Use linguagem de ação: "peça avaliações", "publique um vídeo mostrando...", "responda todas as avaliações do Google"
- Cada ação deve ser tão clara que o dono execute sozinho em 30 minutos

REGRAS DE CONTEÚDO:
- category: "presence" | "content" | "authority" | "engagement"
- Semanas 1-4: coisas rápidas (cadastro no Google, primeiras avaliações, primeiro vídeo)
- Semanas 5-8: criar rotina (publicar toda semana, responder clientes, pedir indicações)
- Semanas 9-12: dobrar no que funcionou
- Cite dados reais do diagnóstico como fundamento
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

// ─── WELCOME BRIEFING (primeiro briefing, gerado junto com o plano) ───

async function generateWelcomeBriefing(
  supabase: any,
  claude: any,
  leadId: string,
  lead: any,
  weeklyPlan: any[],
) {
  const firstAction = weeklyPlan[0]?.mainAction || weeklyPlan[0]?.title || "Configure seu Google Meu Negócio";
  const shortRegion = (lead.region || "").split(",")[0].trim();

  const prompt = `Você é o consultor de mercado do Virô. Gere o briefing de boas-vindas para um novo cliente.

NEGÓCIO: ${lead.product} em ${shortRegion}
PRIMEIRA AÇÃO DO PLANO: ${firstAction}

Gere um JSON com:
{
  "changes": [{"direction": "neutral", "description": "Ponto de partida — seu diagnóstico acabou de ser gerado."}],
  "weeklyAction": "A primeira coisa para fazer esta semana (baseada na primeira ação do plano)",
  "narrative": "2 parágrafos de boas-vindas: o que fizemos até agora (diagnóstico + plano), o que esperar (briefings semanais), e o que fazer agora (primeira ação). Tom: direto, animador, sem jargão."
}

Regras:
- weeklyAction deve ser prática e específica
- narrative: máximo 100 palavras, fale com o dono em 2ª pessoa
- Gere APENAS o JSON.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1000,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  let parsed: any;
  try {
    parsed = JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
  } catch {
    // Fallback simples
    parsed = {
      changes: [{ direction: "neutral", description: "Diagnóstico concluído — seu plano de 90 dias está pronto." }],
      weeklyAction: firstAction,
      narrative: `Seu diagnóstico de ${lead.product} em ${shortRegion} está pronto. Analisamos seu mercado, mapeamos a concorrência e montamos um plano de 12 semanas. A cada segunda-feira você recebe um briefing com o que mudou e o que fazer. Comece agora pela primeira tarefa do plano.`,
    };
  }

  const briefingContent = {
    changes: parsed.changes || [],
    weeklyAction: parsed.weeklyAction || firstAction,
    narrative: parsed.narrative || "",
    meta: {
      weekNumber: 0,
      generatedAt: new Date().toISOString(),
      model: "claude-sonnet-4-5-20250929",
      diffSummary: { improvements: 0, declines: 0, totalChanges: 0 },
    },
  };

  // Deleta briefing anterior se existir
  await supabase.from("briefings").delete().eq("lead_id", leadId).eq("week_number", 0);

  const { error } = await supabase.from("briefings").insert({
    lead_id: leadId,
    week_number: 0,
    content: briefingContent,
    generation_model: "claude-sonnet-4-5-20250929",
    email_sent_at: null,
  });

  if (error) {
    console.error("[PlanGen] Welcome briefing insert error:", error);
  } else {
    console.log(`[PlanGen] Welcome briefing generated for lead ${leadId}`);
  }
}

// (Email e WhatsApp centralizados em src/lib/notify.ts)
