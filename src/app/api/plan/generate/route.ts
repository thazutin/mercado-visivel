// ============================================================================
// Virô — Plan Generation Route
// After payment: generates full diagnostic (5 blocks) + 90-day plan via Claude
// File: src/app/api/plan/generate/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { notifyFullDiagnosisReady } from "@/lib/notify";
import { runPostDiagnosisEnrichment } from "@/lib/analysis";

export const maxDuration = 800;

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

    let raw: any = {};
    let diagnosisId: string | null = null;

    const { data: diagnosis } = await supabase
      .from("diagnoses")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (diagnosis) {
      raw = diagnosis.raw_data || {};
      diagnosisId = diagnosis.id;
      console.log(`[PlanGen] Diagnosis found in diagnoses table: ${diagnosisId}`);
    } else {
      // Fallback: usar diagnosis_display da tabela leads (quando insert em diagnoses falhou silenciosamente)
      console.warn(`[PlanGen] Diagnosis not in diagnoses table — falling back to leads.diagnosis_display`);
      if (!lead.diagnosis_display) {
        return NextResponse.json({ error: "Diagnosis not found" }, { status: 404 });
      }
      raw = lead.raw_data || lead.diagnosis_display || {};
      console.log(`[PlanGen] Fallback raw keys: ${Object.keys(raw).join(', ')}`);
    }

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

    // 4b. Enriquecimento pós-diagnóstico (checklist + sazonalidade + conteúdos)
    // waitUntil garante que o Vercel não mata o processo antes de completar
    waitUntil(
      runPostDiagnosisEnrichment(
        leadId,
        raw as any,
        { name: lead.name, product: lead.product, region: lead.region, client_type: lead.client_type },
      ).catch((err: any) =>
        console.error("[PlanGen] Erro no enriquecimento pós-diagnóstico:", err)
      )
    );

    // 5. Notifica por WhatsApp + email
    await notifyFullDiagnosisReady({
      email: lead.email,
      whatsapp: lead.whatsapp,
      leadId,
      product: lead.product,
      region: lead.region,
      name: lead.name,
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

  // Google Maps — situação atual do negócio
  const maps = influence.rawGoogle?.mapsPresence || raw.marketSizing?.mapsPresence || null;
  const mapsFound = maps?.found || false;
  const mapsRating = maps?.rating || null;
  const mapsReviews = maps?.reviewCount || 0;
  const mapsPhotos = maps?.photos || 0;
  const mapsName = maps?.businessName || lead.product;
  const ownerResponseRate = maps?.ownerResponseRate;
  const ownerResponsePct = ownerResponseRate != null
    ? `${Math.round(ownerResponseRate * 100)}%`
    : 'desconhecido';
  const photoCount = maps?.photoCount || maps?.photos || 0;

  // Instagram — negócio
  const igBusiness = influence.rawInstagram?.businessProfile || null;
  const igFollowers = igBusiness?.followers || 0;
  const igPosts30d = igBusiness?.postsLast30d || 0;
  const igEngagement = igBusiness?.engagementRate || 0;
  const igHandle = lead.instagram || null;
  const hasIgData = igFollowers > 0;
  const hasIgHandle = !!igHandle;
  const igStatus = hasIgData
    ? `@${igHandle || 'handle não declarado'} — ${igFollowers} seguidores`
    : hasIgHandle
      ? `@${igHandle} — dados não coletados`
      : 'sem presença identificada';

  const igDataUnavailable = hasIgHandle && igFollowers > 0 && igPosts30d === 0 && igEngagement === 0;
  const igPrivacyNote = igDataUnavailable
    ? '\n  ⚠️ IMPORTANTE: Perfil existe com seguidores mas sem dados de engajamento — pode ser perfil com restrições. NÃO assuma inatividade. Trate como "dados de conteúdo não disponíveis".'
    : '';

  // Concorrentes — top 3 do SERP + Instagram
  const serpCompetitors = serpPositions
    .filter((sp: any) => sp.position && sp.position <= 10 && sp.domain !== lead.site)
    .slice(0, 3)
    .map((sp: any) => `"${sp.title || sp.domain}" (pos ${sp.position})`)
    .join(", ");

  const igCompetitors = (influence.rawInstagram?.competitorProfiles || [])
    .slice(0, 3)
    .map((c: any) => `@${c.handle} (${c.followers || 0} seguidores, ${c.postsLast30d || 0} posts/mês)`)
    .join(", ");

  // Concorrentes do Maps — comparação direta
  const mapsCompetitors = maps?.mapsCompetitors || [];
  const mapsCompetitorsSummary = mapsCompetitors.length > 0
    ? mapsCompetitors.slice(0, 4).map((c: any) => {
        const parts = [`"${c.name}"`];
        if (c.rating) parts.push(`${c.rating}★`);
        if (c.reviewCount) parts.push(`${c.reviewCount} avaliações`);
        if (c.photoCount) parts.push(`${c.photoCount} fotos`);
        return parts.join(' · ');
      }).join('\n  ')
    : 'Nenhum concorrente identificado no Maps';

  // Audiência e mercado
  const populacaoRaio = raw.audienciaDisplay?.populacaoRaio || null;
  const raioKm = raw.audienciaDisplay?.raioKm || null;

  return `NEGÓCIO: ${lead.product} em ${lead.region}
Diferencial: "${lead.differentiator || "não informado"}"
Instagram: ${igStatus} · Site: ${lead.site || "não tem"}

PRESENÇA DIGITAL ATUAL — ESTADO REAL:
Google Maps: ${mapsFound ? `✅ "${mapsName}"` : '❌ não encontrado no Google Maps'}
${mapsFound ? `  → Avaliação: ${mapsRating ? `${mapsRating}★` : 'sem nota'} (${mapsReviews} avaliações)
  → Fotos no perfil: ${photoCount} fotos
  → Respostas do dono: ${ownerResponsePct} das avaliações têm resposta
  → Benchmark setor: negócios top têm 50+ avaliações, 20+ fotos, >80% de respostas`
: '  → GAP CRÍTICO: negócio invisível no Maps — 0% da demanda ativa consegue encontrá-lo'}

Instagram: ${hasIgData ? `✅ ${igStatus}` : hasIgHandle ? `⚠️ ${igStatus}` : `❌ ${igStatus}`}
${hasIgData ? `  → ${igFollowers} seguidores · ${igPosts30d} posts/mês · ${(igEngagement * 100).toFixed(1)}% engajamento
  → Benchmark: perfis ativos do setor postam 3-5x/semana e têm engajamento >3%`
: hasIgHandle ? '  → Perfil existe mas sem dados de engajamento coletados'
: '  → Sem presença no Instagram — oportunidade ou decisão estratégica a avaliar'}${igPrivacyNote}

MERCADO:
Volume total: ${raw.volumes?.totalMonthlyVolume || 0} buscas/mês
${populacaoRaio ? `População no raio de ${raioKm}km: ${populacaoRaio.toLocaleString("pt-BR")} pessoas` : ""}
Influência atual: ${influence.totalInfluence || 0}%

TOP TERMOS BUSCADOS:
  ${topTerms}

POSIÇÕES NO GOOGLE:
  ${serpSummary || "Negócio não ranqueado para nenhum termo monitorado"}

CONCORRENTES NO GOOGLE:
${serpCompetitors || "Nenhum concorrente identificado no top 10"}

CONCORRENTES DIRETOS (Google Maps — mesma região geográfica):
  ${mapsCompetitorsSummary}
${mapsFound && mapsCompetitors.length > 0 ? `
COMPARATIVO:
  → Seu negócio: ${mapsRating || 'sem nota'}★ · ${mapsReviews} avaliações · ${maps?.photoCount || 0} fotos
  → Melhor concorrente: ${mapsCompetitors.reduce((best: any, c: any) => (!best || (c.reviewCount || 0) > (best.reviewCount || 0)) ? c : best, null)?.name || 'N/A'} com ${Math.max(...mapsCompetitors.map((c: any) => c.reviewCount || 0))} avaliações
  → Gap a fechar: ${Math.max(0, Math.max(...mapsCompetitors.map((c: any) => c.reviewCount || 0)) - mapsReviews)} avaliações` : ''}

CONCORRENTES NO INSTAGRAM:
${igCompetitors || "Nenhum concorrente identificado"}

GAPS IDENTIFICADOS: ${gaps.headlineInsight || "N/A"}
${(gaps.gaps || []).slice(0, 3).map((g: any) => `- ${g.title}`).join("\n")}

${(() => {
  const bd = raw.influence?.influence?.breakdown || {};
  const d1 = bd.d1_descoberta ?? bd.d1_discovery ?? 0;
  const d2 = bd.d2_credibilidade ?? bd.d2_credibility ?? 0;
  const d3 = bd.d3_presenca ?? bd.d3_reach ?? 0;
  const d4 = bd.d4_reputacao ?? 0;
  const minVal = Math.min(d1, d2, d3, d4);
  const weakest = minVal === d1 ? 'Descoberta' : minVal === d2 ? 'Credibilidade' : minVal === d3 ? 'Presença' : 'Reputação';
  return `POSIÇÃO COMPETITIVA LOCAL: ${raw.influence?.influence?.totalInfluence || 0}%
Descoberta (aparece quando buscam): ${d1}/100
Credibilidade (convence quem encontra): ${d2}/100
Presença (mantém relacionamento): ${d3}/100
Reputação (base te recomenda): ${d4}/100

DIMENSÃO MAIS FRACA: ${weakest} (${minVal}/100) — prioridade máxima no plano

HIERARQUIA DE AÇÃO (respeitar esta ordem):
Nível 1 — Básico bem feito (semanas 1-4): Maps completo, avaliações iniciais, site básico → move Descoberta + Credibilidade
Nível 2 — Visibilidade ativa (semanas 5-8): conteúdo consistente, SEO local → move Descoberta + Presença
Nível 3 — Sistema de reputação (semanas 9-12): coleta sistemática avaliações, respostas, referral → move Reputação
Nível 4 — Liderança (recorrência): autoridade, geração de demanda → move Presença + Reputação`;
})()}

${(() => {
  const influenceBreakdown = raw.influence?.influence?.breakdown || {};
  const levers = influenceBreakdown.levers || [];
  const leversContext = levers.length > 0
    ? levers.map((l: any, i: number) =>
        `${i + 1}. [${l.dimension.toUpperCase()}] ${l.action} (+${l.impact}pts)
     Situação atual: ${l.currentValue || 'não medido'}
     Meta: ${l.targetValue || 'não definida'}
     Esforço: ${l.effort} · Prazo: ${l.horizon}`
      ).join('\n')
    : 'Levers não calculados';

  const totalInfluence = raw.influence?.influence?.totalInfluence || 0;
  const influenceBreakdownText = levers.length > 0
    ? `Alcance: ${influenceBreakdown.d1_discovery || 0}pts · Descoberta: ${influenceBreakdown.d2_credibility || 0}pts · Credibilidade: ${influenceBreakdown.d3_reach || 0}pts`
    : '';

  return `SCORE DE INFLUÊNCIA: ${totalInfluence}% da demanda capturada
${influenceBreakdownText}

ALAVANCAS IDENTIFICADAS (ordenadas por impacto no score):
${leversContext}

INSTRUÇÃO: O plano deve começar pelas alavancas de maior impacto, mas não se limitar a elas.
Se há oportunidades claras de crescimento não capturadas pelas alavancas (ex: sazonalidade,
novos canais, indicações, parcerias locais), inclua-as como ações complementares.`;
})()}`;
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

REGRAS DE CONTEÚDO (obrigatório):
- Bloco "digital_presence": cite os números EXATOS do diagnóstico — quantas avaliações tem, qual nota, quantas fotos, quantos seguidores. Se não tem Maps: diga que não aparece. Se tem Maps mas poucas avaliações: diga exatamente quantas e compare com o mercado.
- Bloco "competitive_analysis": use OBRIGATORIAMENTE os concorrentes reais listados acima.
  Para cada concorrente cite: nome real, nota, número de avaliações, número de fotos.
  Compare com os dados do negócio analisado.
  Identifique onde o negócio está à frente e onde está atrás — com números.
  NUNCA invente concorrentes. Se não há dados, diga explicitamente "não foi possível identificar concorrentes diretos".
  Termine com: qual é o concorrente mais perigoso e por quê (baseado em dados).
- Bloco "action_plan": máximo 3 ações. Use as ALAVANCAS DO SCORE como ponto de partida
  obrigatório — comece pela de maior impacto. Para cada ação:
    * ESTADO ATUAL: o número real hoje (ex: "você tem 3 avaliações e 2 fotos")
    * META CONCRETA: onde deve chegar (ex: "meta: 30 avaliações em 60 dias")
    * SISTEMA: como criar um processo replicável, não uma ação pontual
    * Se o negócio já tem algo (ex: programa de indicação), evolua-o com métricas
      (ex: "caso já tenha: adicione X para aumentar 10% ao mês")
    * NUNCA presuma que o negócio não tem algo — sugira evoluir o que existe
    * NUNCA repita o mesmo objetivo em ações diferentes
  As 3 ações devem atacar a DIMENSÃO MAIS FRACA primeiro.
  Cada ação deve indicar qual dimensão move e o ganho esperado em pontos.
  Use linguagem de hierarquia: "isso é o básico que precisa estar no lugar antes de qualquer outra coisa".
  Após as 3 ações das alavancas, adicione (se relevante): 1 ação complementar que
  não está nos levers mas representa oportunidade clara para este negócio específico.
- Bloco "demand_map": cite os termos reais com volumes reais. Ex: "2.400 pessoas buscam 'dentista Vila Madalena' por mês".
- Gere APENAS o JSON.`;
}

function buildWeeklyPrompt(context: string): string {
  return `Você é um consultor de mercado local que fala de forma simples e direta.

${context}

ORIENTAÇÃO ESTRATÉGICA:
As semanas 1-4 devem atacar OBRIGATORIAMENTE as alavancas de maior impacto no score
de influência (listadas no contexto acima). Cada semana deve conectar a ação ao ganho
esperado no score. Ex: "Ao conseguir 20 avaliações, seu score de Credibilidade sobe
de X para Y, o que aumenta sua influência de Z% para W%."

Semanas 5-12 podem incluir ações além das alavancas — sazonalidade, parcerias,
indicações, novos canais — desde que conectadas à realidade do negócio.

HIERARQUIA OBRIGATÓRIA (seguir rigorosamente):
- Semanas 1-4 OBRIGATORIAMENTE atacam o Nível 1 da hierarquia (básico bem feito)
- Semanas 5-8 avançam para Nível 2 apenas se Nível 1 estiver endereçado
- Semanas 9-12 focam em Nível 3 (reputação e referral)
- Cada semana deve mencionar qual dimensão está movendo (Descoberta, Credibilidade, Presença ou Reputação)

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

REGRA DE PROGRESSÃO:
- Se o lever diz "criar perfil no Maps" → semana 1 é criar, semana 3 é otimizar
- Se o lever diz "aumentar avaliações" → semana 1 é criar o sistema, semanas 2-4 é executar
- Se o negócio JÁ TEM algo que um lever sugere criar → pule para a etapa de evolução
  (ex: "caso já tenha programa de indicação: adicione recompensa para indicador, meta: +10% indicações/mês")
- Nunca presuma ausência — sempre use "caso não tenha / caso já tenha" para ações de criação

REGRAS DE NÃO-REDUNDÂNCIA (crítico):
- Cada semana deve ter objetivo ÚNICO e diferente das outras
- NUNCA repita a mesma ação em semanas diferentes (ex: "conseguir 10 avaliações" na semana 3 E na semana 7 é proibido)
- Se um objetivo tem múltiplas etapas (ex: avaliações), monte uma progressão lógica:
  Semana 1: criar o sistema de coleta → Semana 3: ativar com primeiros clientes → Semana 6: automatizar
- Máximo 10 semanas únicas. Semanas 11-12 devem ser consolidação/medição, não novas ações

FORMATO OBRIGATÓRIO para cada semana:
- mainAction deve incluir: "HOJE: [estado atual] → META: [onde chegar] — [como fazer passo a passo]"

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
      weekNumber: 1,
      generatedAt: new Date().toISOString(),
      model: "claude-sonnet-4-5-20250929",
      diffSummary: { improvements: 0, declines: 0, totalChanges: 0 },
    },
  };

  // Deleta briefing anterior se existir
  await supabase.from("briefings").delete().eq("lead_id", leadId).eq("week_number", 1);

  const { error } = await supabase.from("briefings").insert({
    lead_id: leadId,
    week_number: 1,
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
