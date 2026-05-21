// ============================================================================
// Virô — Cycle Planner
//
// Roda na 5ª 18h após o signals collector. Para cada lead assinante,
// decide o TEMA da próxima semana:
//   • input: 3 teses do diagnóstico + checklist + memória + último ciclo
//            + sinais semanais frescos
//   • output: weekly_cycles row com status='planned', priority_action e
//             linked_pillar_id
//
// Modelo: Claude Opus (qualidade > velocidade, 1x/semana/lead).
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { isoWeekLabel, type WeeklySignalsBundle } from "@/lib/signals/collector";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-opus-4-20250514";

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface PlannedCycle {
  theme_short: string;        // ≤25 chars — vai no template Meta
  theme_full: string;
  theme_category: "credibilidade" | "discoverability" | "conteudo" | "experiencia" | "operacao";
  linked_pillar_id: string;   // "pilar-1" | "pilar-2" | "pilar-3"
  parent_cycle_id: string | null;
  evolution_step: number;
  priority_action: {
    title: string;
    why_now: string;
    how_to: string[];         // 3-5 passos
    copy_blocks: { label: string; text: string }[]; // textos prontos
    measure_on_thursday: string[]; // o que medir/perguntar na 5ª
  };
  priority_reason: {
    signals_used: string[];
    evolution_from_last: string;
  };
}

interface PlanInput {
  leadId: string;
  signals: WeeklySignalsBundle;
}

/**
 * Decide o tema da próxima semana usando Opus.
 * Retorna PlannedCycle ou null se algo crítico falhou (lead sem teses, etc.).
 */
export async function planNextCycle(input: PlanInput): Promise<PlannedCycle | null> {
  const sb = getSb();

  // 1. Carrega contexto pesado pra decisão
  const { data: lead } = await sb
    .from("leads")
    .select("id, name, product, region, challenge, client_type, growth_machine")
    .eq("id", input.leadId)
    .single();
  if (!lead) throw new Error(`Lead ${input.leadId} not found`);

  const growthMachine = (lead.growth_machine as any) || {};
  const pillars = (growthMachine.strategicPillars as any[]) || [];
  if (pillars.length === 0) {
    console.warn(`[CyclePlanner] lead ${input.leadId} sem teses — pulando`);
    return null;
  }

  // Checklist do básico
  const { data: checklist } = await sb
    .from("checklists")
    .select("items")
    .eq("lead_id", input.leadId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Último ciclo fechado (pra evolução)
  const { data: lastCycle } = await sb
    .from("weekly_cycles")
    .select("id, theme_short, theme_full, linked_pillar_id, evolution_step, status, outcome")
    .eq("lead_id", input.leadId)
    .in("status", ["closed", "abandoned"])
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Memória recente
  const { data: memories } = await sb
    .from("business_memory")
    .select("category, topic, content, confidence, linked_pillar_id")
    .eq("lead_id", input.leadId)
    .order("created_at", { ascending: false })
    .limit(20);

  // 2. Monta prompt
  const shortRegion = (lead.region as string)?.split(",")[0]?.trim() || "";
  const displayName = (lead.name as string) || (lead.product as string);

  const pillarsBlock = pillars.slice(0, 3).map((p: any, i: number) => {
    const items = (p.items as any[] || []).slice(0, 5).map((it: any, j: number) => `    ${j + 1}. ${it.title}`).join("\n");
    return `[${p.id || `pilar-${i + 1}`}] ${p.title}
  Por quê: ${p.description}
  Meta: ${p.targetMetric || p.kpi?.target || "—"}
  Timeline: ${p.timeline || "—"}
  Etapas:
${items}`;
  }).join("\n\n");

  const checklistBlock = ((checklist?.items as any[]) || [])
    .slice(0, 8)
    .map((i: any) => `${i.status === "done" || i.completed ? "✓" : "○"} ${i.title}`)
    .join("\n");

  const memoryBlock = (memories || []).slice(0, 15)
    .map((m: any) => `[${m.category}/${m.confidence}${m.linked_pillar_id ? `/${m.linked_pillar_id}` : ""}] ${m.content}`)
    .join("\n") || "(sem aprendizados registrados ainda)";

  const lastCycleBlock = lastCycle
    ? `Último ciclo (${lastCycle.theme_short}, status=${lastCycle.status}, ligado a ${lastCycle.linked_pillar_id || "—"}, passo ${lastCycle.evolution_step || 1}):
${lastCycle.outcome ? `Outcome: ${JSON.stringify(lastCycle.outcome).slice(0, 400)}` : "(sem outcome registrado — provavelmente abandonado)"}`
    : "(primeiro ciclo deste lead — não há histórico)";

  const signalsBlock = `MACRO: ${input.signals.macro?.summary || "(sem dado macro)"}

CONCORRENTES:
${input.signals.competitors.map((c) => `• @${c.handle}: ${c.signal}`).join("\n") || "(sem movimento relevante)"}

PRÓPRIO NEGÓCIO:
${input.signals.ownBusiness
  ? [
      `Score atual: ${input.signals.ownBusiness.score_current}/100${input.signals.ownBusiness.score_delta != null ? ` (Δ ${input.signals.ownBusiness.score_delta > 0 ? "+" : ""}${input.signals.ownBusiness.score_delta})` : ""}`,
      input.signals.ownBusiness.reviews_delta != null ? `Reviews: Δ ${input.signals.ownBusiness.reviews_delta > 0 ? "+" : ""}${input.signals.ownBusiness.reviews_delta}` : null,
      input.signals.ownBusiness.ig_posts_delta != null ? `Posts IG: Δ ${input.signals.ownBusiness.ig_posts_delta > 0 ? "+" : ""}${input.signals.ownBusiness.ig_posts_delta}` : null,
    ].filter(Boolean).join(" · ")
  : "(sem dados próprios)"}`;

  const prompt = `Você é o planejador estratégico semanal da Virô. Decida o TEMA da próxima
semana para este negócio. Sua decisão vai virar 3 mensagens de WhatsApp (abertura
sexta, checkpoint terça, fechamento quinta) e a Ação Principal da Semana exibida
no dashboard.

══════ NEGÓCIO ══════
${displayName} · ${lead.product} · ${shortRegion} · ${lead.client_type || "b2c"}
Desafio declarado: ${lead.challenge || "(não declarou)"}

══════ AS 3 TESES (não podem ser ignoradas — toda ação vem de uma delas) ══════
${pillarsBlock}

══════ CHECKLIST DO BÁSICO ══════
${checklistBlock || "(sem checklist ainda)"}

══════ ÚLTIMO CICLO ══════
${lastCycleBlock}

══════ MEMÓRIA DO NEGÓCIO ══════
${memoryBlock}

══════ SINAIS DESTA SEMANA ══════
${signalsBlock}

══════ COMO DECIDIR ══════
1. Toda ação semanal vem de UMA das 3 teses (linked_pillar_id obrigatório).
2. Se o último ciclo foi FECHADO com sucesso E linked_pillar_id, você pode:
   a) Evoluir DENTRO do mesmo pilar (próximo passo, complexidade crescente) — preferível
   b) Mudar de pilar APENAS se houver razão estratégica (saturação, sinal forte de outro lado)
3. Se o último ciclo foi ABANDONADO (sem outcome), considere remediar ou mudar de abordagem.
4. Se houver SINAL FORTE da semana (concorrente fazendo X, reviews nova, score caindo),
   incorpore como gatilho na ação — mas mantenha conexão com uma tese.
5. theme_short: ≤25 chars, frase curta de TEMA (não título de ação).
   ✓ "Resposta às reviews novas" / "Captura B2B corporativo" / "Reels de bastidor"
   ✗ "Crescer mais" / "Marketing"
6. priority_action: ação CONCRETA executável em 5-7 dias. Inclua copy_blocks com texto
   pronto pra copiar (mensagem, script, post, email — o que fizer sentido pro caso).
7. measure_on_thursday: 2-4 perguntas/métricas que o bot vai usar no fechamento.

Retorne APENAS JSON nesse formato, sem markdown:

{
  "theme_short": "...",
  "theme_full": "...",
  "theme_category": "credibilidade|discoverability|conteudo|experiencia|operacao",
  "linked_pillar_id": "pilar-1|pilar-2|pilar-3",
  "evolution_step": 1,
  "priority_action": {
    "title": "...",
    "why_now": "1-2 frases ancorando em sinal/dado/histórico específico",
    "how_to": ["passo 1", "passo 2", "passo 3"],
    "copy_blocks": [{"label": "TEXTO PRONTO", "text": "..."}],
    "measure_on_thursday": ["pergunta/métrica 1", "pergunta/métrica 2"]
  },
  "priority_reason": {
    "signals_used": ["sinal usado 1", "sinal usado 2"],
    "evolution_from_last": "como esta semana se conecta com o último ciclo (ou 'primeiro ciclo')"
  }
}`;

  // 3. Chama Opus
  let parsed: any;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2500,
      temperature: 0.5,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[CyclePlanner] Opus falhou pra lead ${input.leadId}:`, (err as Error).message);
    return null;
  }

  // 4. Valida + sanitiza
  const validPillarIds = new Set(pillars.map((p: any, i: number) => p.id || `pilar-${i + 1}`));
  if (!validPillarIds.has(parsed.linked_pillar_id)) {
    console.warn(`[CyclePlanner] linked_pillar_id inválido (${parsed.linked_pillar_id}), defaulting pra pilar-1`);
    parsed.linked_pillar_id = pillars[0]?.id || "pilar-1";
  }

  const evolutionStep = lastCycle?.linked_pillar_id === parsed.linked_pillar_id
    ? (lastCycle.evolution_step || 1) + 1
    : 1;

  return {
    theme_short: String(parsed.theme_short || "").slice(0, 25),
    theme_full: String(parsed.theme_full || ""),
    theme_category: ["credibilidade", "discoverability", "conteudo", "experiencia", "operacao"].includes(parsed.theme_category)
      ? parsed.theme_category
      : "operacao",
    linked_pillar_id: parsed.linked_pillar_id,
    parent_cycle_id: (lastCycle?.id as string) || null,
    evolution_step: evolutionStep,
    priority_action: parsed.priority_action || { title: "", why_now: "", how_to: [], copy_blocks: [], measure_on_thursday: [] },
    priority_reason: parsed.priority_reason || { signals_used: [], evolution_from_last: "" },
  };
}

/** Persiste o ciclo em weekly_cycles status='planned'. Idempotente. */
export async function persistPlannedCycle(leadId: string, weekIso: string, plan: PlannedCycle): Promise<string | null> {
  const sb = getSb();

  // Se já existe ciclo pra essa semana, não duplica
  const { data: existing } = await sb
    .from("weekly_cycles")
    .select("id, status")
    .eq("lead_id", leadId)
    .eq("week_iso", weekIso)
    .maybeSingle();

  if (existing?.id) {
    console.log(`[CyclePlanner] ciclo já existe pra ${leadId}/${weekIso} (status=${existing.status})`);
    return existing.id as string;
  }

  const { data, error } = await sb
    .from("weekly_cycles")
    .insert({
      lead_id: leadId,
      week_iso: weekIso,
      theme_short: plan.theme_short,
      theme_full: plan.theme_full,
      theme_category: plan.theme_category,
      linked_pillar_id: plan.linked_pillar_id,
      parent_cycle_id: plan.parent_cycle_id,
      evolution_step: plan.evolution_step,
      priority_action: plan.priority_action,
      priority_reason: plan.priority_reason,
      status: "planned",
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[CyclePlanner] insert falhou pra ${leadId}:`, error.message);
    return null;
  }
  return data?.id as string;
}

/** Helper exposto pra cron: retorna a label ISO. */
export { isoWeekLabel };
