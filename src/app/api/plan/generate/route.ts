// ============================================================================
// Virô — Plan Generation Route
// After payment: generates Itens Estruturantes + Relatório Setorial via Claude
// File: src/app/api/plan/generate/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { notifyFullDiagnosisReady } from "@/lib/notify";
import { runPostDiagnosisEnrichment } from "@/lib/analysis";
import { generateRelatorioSetorial } from "@/lib/pipeline/relatorio-setorial";

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

    // 2. Build context
    const context = buildContext(lead, raw);
    const breakdown = raw.influence?.influence?.breakdown || {};
    const levers = breakdown?.levers || [];

    // 3. Gerar Itens Estruturantes
    console.log(`[PlanGen] Gerando itens estruturantes para lead ${leadId}...`);
    const itensEstruturantes = await generateItensEstruturantes(
      claude, context, levers, breakdown, lead.client_type || 'b2c'
    );
    console.log(`[PlanGen] Itens estruturantes OK: ${itensEstruturantes.items.length} itens`);

    // 4. Gerar Relatório Setorial
    console.log(`[PlanGen] Gerando relatório setorial para lead ${leadId}...`);
    const relatorioSetorial = await generateRelatorioSetorial(
      lead.product, lead.region, lead.client_type || 'b2c'
    );
    console.log(`[PlanGen] Relatório setorial OK`);

    // 5. Salvar plan no Supabase
    await supabase.from("plans").delete().eq("lead_id", leadId);
    const { error: planError } = await supabase.from("plans").insert({
      lead_id: leadId,
      content: {
        itensEstruturantes: itensEstruturantes.items,
        itensEstrurantesSummary: itensEstruturantes.summary,
        relatorioSetorial,
      },
      generation_model: 'claude-sonnet-4-20250514',
      status: "ready",
    });
    if (planError) {
      console.error("[PlanGen] Error saving plan:", planError);
      throw new Error(`Plan save failed: ${planError.message}`);
    }

    // 5b. Salvar itens estruturantes na tabela checklists
    try {
      await supabase.from("checklists").delete().eq("lead_id", leadId);

      const checklistRows = itensEstruturantes.items.map((item: ItensEstruturante, index: number) => ({
        lead_id: leadId,
        title: item.titulo,
        description: item.descricao,
        action: item.acao,
        verification: item.verificacao,
        impact: item.impacto,
        deadline: item.prazo,
        dimensao: item.dimensao,
        order_index: index,
        completed: false,
        tipo: 'estruturante',
      }));

      const { error: checklistError } = await supabase.from("checklists").insert(checklistRows);

      if (checklistError) {
        console.error('[PlanGen] Checklists insert erro:', checklistError.message);
      } else {
        console.log(`[PlanGen] ${checklistRows.length} itens estruturantes salvos`);
      }
    } catch (err) {
      console.error('[PlanGen] Checklists falhou (non-fatal):', (err as Error).message);
    }

    // 5c. Gerar briefing de boas-vindas
    try {
      await generateWelcomeBriefing(supabase, claude, leadId, lead, itensEstruturantes, relatorioSetorial);
    } catch (briefErr) {
      console.error("[PlanGen] Welcome briefing failed (non-fatal):", briefErr);
    }

    // 6. Update lead status
    await supabase
      .from("leads")
      .update({ plan_status: "ready", weeks_active: 0 })
      .eq("id", leadId);

    // 6b. Enriquecimento pós-diagnóstico (sazonalidade + conteúdos)
    waitUntil(
      runPostDiagnosisEnrichment(
        leadId,
        raw as any,
        { name: lead.name, product: lead.product, region: lead.region, client_type: lead.client_type },
      ).catch((err: any) =>
        console.error("[PlanGen] Erro no enriquecimento pós-diagnóstico:", err)
      )
    );

    // 7. Notifica por WhatsApp + email
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

    await supabase
      .from("leads")
      .update({ plan_status: "failed" })
      .eq("id", leadId);

    return NextResponse.json({ error: "Plan generation failed", detail: err?.message || String(err) }, { status: 500 });
  }
}

// ─── CONTEXT BUILDER ─────────────────────────────────────────────────────────

function buildContext(lead: any, raw: any): string {
  const volumes = raw.volumes?.termVolumes || [];
  const influence = raw.influence?.influence || {};
  const gaps = raw.gaps?.analysis || {};

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
${leversContext}`;
})()}`;
}

// ─── ITENS ESTRUTURANTES ─────────────────────────────────────────────────────

interface ItensEstruturante {
  id: string;
  dimensao: string;
  titulo: string;
  descricao: string;
  acao: string;
  verificacao: string;
  impacto: string;
  prazo: string;
  concluido: boolean;
}

async function generateItensEstruturantes(
  claude: Anthropic,
  context: string,
  levers: any[],
  breakdown: any,
  clientType: string,
): Promise<{ items: ItensEstruturante[]; summary: string }> {
  const d1 = breakdown?.d1_descoberta ?? breakdown?.d1_discovery ?? 0;
  const d2 = breakdown?.d2_credibilidade ?? breakdown?.d2_credibility ?? 0;
  const d3 = breakdown?.d3_presenca ?? breakdown?.d3_reach ?? 0;
  const d4 = breakdown?.d4_reputacao ?? 0;

  const dimensaoMaisFraca =
    Math.min(d1, d2, d3, d4) === d1 ? 'Descoberta' :
    Math.min(d1, d2, d3, d4) === d2 ? 'Credibilidade' :
    Math.min(d1, d2, d3, d4) === d3 ? 'Presença' : 'Reputação';

  const leversText = levers.slice(0, 5).map((l: any, i: number) =>
    `${i + 1}. [${l.dimension}] ${l.action} (+${l.impact}pts) | atual: ${l.currentValue || 'N/A'} → meta: ${l.targetValue || 'N/A'}`
  ).join('\n');

  const prompt = `Você é consultor de mercado local. Baseado no diagnóstico abaixo, gere uma lista de ITENS ESTRUTURANTES — as ações fundamentais que este negócio precisa ter no lugar antes de qualquer outra coisa.

${context}

DIMENSÃO MAIS FRACA: ${dimensaoMaisFraca}
ALAVANCAS IDENTIFICADAS:
${leversText}

REGRAS:
- Máximo 8 itens, mínimo 4
- Cada item é uma ação concreta e verificável (não genérica)
- Ordenar por prioridade: dimensão mais fraca primeiro
- Linguagem direta: "Verificar perfil no Google Maps", não "Otimizar presença digital"
- Cada item deve ter: estado atual (o que está faltando/errado), ação específica, como verificar se foi feito
- NUNCA incluir item que o negócio já tem em ordem (ex: se tem Maps com >50 avaliações, não incluir "criar perfil Maps")
- Incluir itens de cada dimensão fraca identificada no diagnóstico

Responda APENAS em JSON:
{
  "items": [
    {
      "id": "maps_profile",
      "dimensao": "descoberta|credibilidade|presenca|reputacao",
      "titulo": "Título curto e direto",
      "descricao": "O que está faltando hoje e por que importa (1-2 frases)",
      "acao": "Passo a passo em 2-3 linhas — específico o suficiente para executar sozinho",
      "verificacao": "Como confirmar que está feito (ex: 'Abrir Google Maps e buscar o nome do negócio')",
      "impacto": "alto|medio|baixo",
      "prazo": "esta semana|este mês|próximo mês",
      "concluido": false
    }
  ],
  "summary": "1 frase resumindo o maior gap e por que atacar agora"
}`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  const parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  console.log(`[PlanGen] Itens estruturantes: ${parsed.items.length} itens gerados`);
  return parsed;
}

// generateRelatorioSetorial importado de @/lib/pipeline/relatorio-setorial

// ─── WELCOME BRIEFING ────────────────────────────────────────────────────────

async function generateWelcomeBriefing(
  supabase: any,
  claude: any,
  leadId: string,
  lead: any,
  itensEstruturantes: { items: ItensEstruturante[]; summary: string },
  relatorioSetorial: any,
) {
  const firstAction = itensEstruturantes.items[0]?.titulo || "Configure seu Google Meu Negócio";
  const firstActionDetail = itensEstruturantes.items[0]?.acao || "";
  const shortRegion = (lead.region || "").split(",")[0].trim();

  const prompt = `Você é o consultor de mercado do Virô. Gere o briefing de boas-vindas para um novo cliente.

NEGÓCIO: ${lead.product} em ${shortRegion}
PRIMEIRO ITEM ESTRUTURANTE: ${firstAction}
DETALHE: ${firstActionDetail}
CONTEXTO DE MERCADO: ${relatorioSetorial.destaque || ''}

Gere um JSON com:
{
  "changes": [{"direction": "neutral", "description": "Ponto de partida — seu diagnóstico acabou de ser gerado."}],
  "weeklyAction": "A primeira coisa para fazer esta semana (baseada no primeiro item estruturante)",
  "narrative": "2 parágrafos de boas-vindas: o que fizemos até agora (diagnóstico + análise), o que esperar (briefings semanais + itens estruturantes), e o que fazer agora (primeiro item). Tom: direto, animador, sem jargão."
}

Regras:
- weeklyAction deve ser prática e específica
- narrative: máximo 100 palavras, fale com o dono em 2ª pessoa
- Gere APENAS o JSON.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  let parsed: any;
  try {
    parsed = JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
  } catch {
    parsed = {
      changes: [{ direction: "neutral", description: "Diagnóstico concluído — seus itens estruturantes estão prontos." }],
      weeklyAction: firstAction,
      narrative: `Seu diagnóstico de ${lead.product} em ${shortRegion} está pronto. Analisamos seu mercado, mapeamos a concorrência e identificamos os itens fundamentais que precisam estar no lugar. A cada semana você recebe um briefing com o que mudou e o que fazer. Comece agora pelo primeiro item estruturante.`,
    };
  }

  const briefingContent = {
    changes: parsed.changes || [],
    weeklyAction: parsed.weeklyAction || firstAction,
    narrative: parsed.narrative || "",
    meta: {
      weekNumber: 1,
      generatedAt: new Date().toISOString(),
      model: "claude-sonnet-4-20250514",
      diffSummary: { improvements: 0, declines: 0, totalChanges: 0 },
    },
  };

  await supabase.from("briefings").delete().eq("lead_id", leadId).eq("week_number", 1);

  const { error } = await supabase.from("briefings").insert({
    lead_id: leadId,
    week_number: 1,
    content: briefingContent,
    generation_model: "claude-sonnet-4-20250514",
    email_sent_at: null,
  });

  if (error) {
    console.error("[PlanGen] Welcome briefing insert error:", error);
  } else {
    console.log(`[PlanGen] Welcome briefing generated for lead ${leadId}`);
  }
}

// (Email e WhatsApp centralizados em src/lib/notify.ts)
