// ============================================================================
// Virô — Weekly Briefing Generator
// Takes a diff + plan context and generates a Claude briefing.
// Output format matches DashboardClient.tsx BriefingCard expectations.
// ============================================================================
// File: src/lib/pipeline/briefing-generator.ts

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { SnapshotDiff, DiffChange } from "./diff-engine";

const MODEL = "claude-sonnet-4-5-20250929";

interface BriefingInput {
  leadId: string;
  weekNumber: number;
  product: string;
  region: string;
  diff: SnapshotDiff;
  // The planned action for this week (from the 12-week plan)
  plannedAction: {
    week: number;
    theme: string;
    action: string;
    why: string;
    how: string;
    metric: string;
  } | null;
  // Current influence score
  currentInfluence: number;
  // Summary stats
  currentFollowers: number;
  currentRating: number | null;
  // Priority task title from plan_tasks (Feature 2)
  topTaskTitle?: string | null;
}

/**
 * Briefing content structure.
 * This MUST match what BriefingCard in DashboardClient.tsx expects:
 *   - changes: { direction: "up"|"down"|"neutral", description: string }[]
 *   - weeklyAction: string
 *   - narrative: string
 */
export interface BriefingContent {
  changes: { direction: "up" | "down" | "neutral"; description: string }[];
  weeklyAction: string;
  narrative: string;
  meta: {
    weekNumber: number;
    generatedAt: string;
    model: string;
    diffSummary: {
      improvements: number;
      declines: number;
      totalChanges: number;
    };
  };
}

export async function generateBriefing(input: BriefingInput): Promise<BriefingContent> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // ─── Build context ───
  const changesText = input.diff.changes.length > 0
    ? input.diff.changes
        .map((c) => `- [${c.direction.toUpperCase()}] ${c.description} (significância: ${c.significance})`)
        .join("\n")
    : "- Nenhuma mudança significativa detectada esta semana.";

  const plannedText = input.plannedAction
    ? `AÇÃO PLANEJADA PARA ESTA SEMANA (do plano de 12 semanas):
Tema: ${input.plannedAction.theme}
Ação: ${input.plannedAction.action}
Por quê: ${input.plannedAction.why}
Como: ${input.plannedAction.how}
Métrica de sucesso: ${input.plannedAction.metric}`
    : "Sem ação específica planejada para esta semana.";

  const topTaskText = input.topTaskTitle
    ? `AÇÃO DA SEMANA (tarefa prioritária do plano): ${input.topTaskTitle}`
    : null;

  const prompt = `${topTaskText ? topTaskText + "\n\n" : ""}CONTEXTO:
Negócio: ${input.product} em ${input.region}
Semana: ${input.weekNumber} de 12
Influência digital atual: ${input.currentInfluence}%
Seguidores Instagram: ${input.currentFollowers}
Nota Google Maps: ${input.currentRating ?? "não disponível"}

MUDANÇAS DETECTADAS (semana ${input.weekNumber} vs semana ${input.weekNumber - 1}):
${changesText}

Resumo: ${input.diff.summary.improvements} melhoria(s), ${input.diff.summary.declines} queda(s), ${input.diff.summary.totalChanges} mudança(s) total.

${plannedText}

---

Com base nessas informações, gere o briefing semanal em JSON com o seguinte formato:

{
  "changes": [
    { "direction": "up" | "down" | "neutral", "description": "texto curto e direto" }
  ],
  "weeklyAction": "A ação mais importante para esta semana, em 1-2 frases diretas",
  "narrative": "2-3 parágrafos com tom direto, explicando o que aconteceu, o que importa, e o que fazer. Fale com o dono do negócio em 2ª pessoa."
}

REGRAS:
- changes: máximo 5 itens. Priorize os mais significativos. Use linguagem simples.
- weeklyAction: se houver AÇÃO DA SEMANA no topo, USE-A como base para o weeklyAction (adapte se o diff mostrar algo mais urgente). Caso contrário, baseie-se na ação planejada.
- narrative: COMECE com a ação da semana quando disponível. Seja específico ao negócio. Nada genérico. Conecte as mudanças ao que o dono deve fazer.
- Se não houve mudanças, foque na ação planejada e no progresso acumulado.
- Tom: direto, sem jargão, como um consultor que conhece a rua.

Responda APENAS com o JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system:
        "Você é o motor de briefing semanal do Virô — plataforma de inteligência de mercado local. Gere briefings curtos, diretos e acionáveis. Responda apenas em JSON válido.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: any;

    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("Claude returned non-JSON response");
      }
    }

    return {
      changes: (parsed.changes || []).map((c: any) => ({
        direction: c.direction || "neutral",
        description: c.description || "",
      })),
      weeklyAction: parsed.weeklyAction || "",
      narrative: parsed.narrative || "",
      meta: {
        weekNumber: input.weekNumber,
        generatedAt: new Date().toISOString(),
        model: MODEL,
        diffSummary: input.diff.summary,
      },
    };
  } catch (err) {
    console.error("[BriefingGen] Claude failed:", err);

    // Fallback: build a basic briefing from the diff data directly
    return buildFallbackBriefing(input);
  }
}

// ─── FALLBACK (if Claude fails) ──────────────────────────────────────

function buildFallbackBriefing(input: BriefingInput): BriefingContent {
  const changes = input.diff.changes.slice(0, 5).map((c) => ({
    direction: c.direction,
    description: c.description,
  }));

  const weeklyAction = input.topTaskTitle
    ? input.topTaskTitle
    : input.plannedAction
    ? `${input.plannedAction.action} — ${input.plannedAction.why}`
    : "Continue executando o plano da semana anterior.";

  const narrative = input.diff.changes.length > 0
    ? `Na semana ${input.weekNumber}, detectamos ${input.diff.summary.totalChanges} mudança${input.diff.summary.totalChanges > 1 ? "s" : ""} no seu mercado. ${input.diff.summary.improvements > 0 ? `${input.diff.summary.improvements} melhoria${input.diff.summary.improvements > 1 ? "s" : ""}.` : ""} ${input.diff.summary.declines > 0 ? `${input.diff.summary.declines} ponto${input.diff.summary.declines > 1 ? "s" : ""} de atenção.` : ""}\n\nSua influência digital está em ${input.currentInfluence}%.`
    : `Semana ${input.weekNumber}: sem mudanças significativas detectadas. Isso é normal — o mercado local se move devagar. Continue executando o plano.`;

  return {
    changes,
    weeklyAction,
    narrative,
    meta: {
      weekNumber: input.weekNumber,
      generatedAt: new Date().toISOString(),
      model: "fallback",
      diffSummary: input.diff.summary,
    },
  };
}

// ─── GET TOP ACTION FOR WEEK ────────────────────────────────────────
// Calculates current week from paid_at and returns the next uncompleted
// task at or before (currentWeek + 1) from the plan's weeklyPlan.

export async function getTopActionForWeek(leadId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Get lead paid_at to calculate current week
  const { data: lead } = await supabase
    .from("leads")
    .select("paid_at, weeks_active")
    .eq("id", leadId)
    .single();

  if (!lead?.paid_at) return null;

  const paidAt = new Date(lead.paid_at);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const currentWeek = Math.min(12, Math.max(1, Math.ceil((now.getTime() - paidAt.getTime()) / msPerWeek)));

  // 2. Check plan_tasks table first (if it exists)
  try {
    const { data: tasks, error } = await supabase
      .from("plan_tasks")
      .select("title, week, completed")
      .eq("lead_id", leadId)
      .eq("completed", false)
      .lte("week", currentWeek + 1)
      .order("week", { ascending: true })
      .limit(1);

    if (!error && tasks && tasks.length > 0) {
      console.log(`[TopAction] Found task from plan_tasks: "${tasks[0].title}" (week ${tasks[0].week})`);
      return tasks[0].title;
    }
  } catch {
    // plan_tasks table may not exist yet — fall through to weeklyPlan
  }

  // 3. Fallback: get from plan's weeklyPlan JSON
  const { data: plan } = await supabase
    .from("plans")
    .select("content")
    .eq("lead_id", leadId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!plan?.content) return null;

  const weeklyPlan = plan.content.weeklyPlan || plan.content.weekly_plan;
  if (!Array.isArray(weeklyPlan)) return null;

  // Find the task for the current week (0-indexed array)
  const weekTask = weeklyPlan[currentWeek - 1];
  if (weekTask) {
    const title = weekTask.title || weekTask.action || weekTask.mainAction || null;
    console.log(`[TopAction] Found task from weeklyPlan: "${title}" (week ${currentWeek})`);
    return title;
  }

  return null;
}
