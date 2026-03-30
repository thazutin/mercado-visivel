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
      generation_model: 'claude-haiku-4-5-20251001',
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

    // 5d. Gerar cenário do mercado (macro_context) — antes de marcar ready
    try {
      const shortRegion = (lead.region || '').split(',')[0].trim();
      console.log(`[PlanGen] Gerando cenário do mercado para ${lead.product} em ${shortRegion}...`);
      const cenarioResponse = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `Em 3-4 frases diretas, descreva o cenário atual do mercado de "${lead.product}" em ${shortRegion}.
Inclua: tendências recentes, nível de digitalização do setor, e 1 oportunidade específica para negócios locais.
Sem jargão. Linguagem simples. Baseado em conhecimento real do setor.
Responda APENAS em JSON: {"summary": "texto aqui", "indicators": [], "outlook": "neutral", "key_opportunity": "texto"}`,
        }],
      });
      const cenarioText = cenarioResponse.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
      let macroContext: any;
      try {
        macroContext = JSON.parse(cenarioText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      } catch {
        macroContext = { summary: cenarioText.slice(0, 500), indicators: [], outlook: 'neutral', key_opportunity: '' };
      }
      // Salvar no diagnóstico
      if (diagnosisId) {
        await supabase.from('diagnoses').update({ macro_context: macroContext }).eq('id', diagnosisId);
      }
      console.log(`[PlanGen] Cenário do mercado OK`);
    } catch (cenarioErr) {
      console.error('[PlanGen] Cenário do mercado falhou (non-fatal):', (cenarioErr as Error).message);
    }

    // 6. Gerar posts e enriquecimento ANTES de marcar ready
    try {
      console.log(`[PlanGen] Gerando conteúdos para lead ${leadId}...`);
      const enrichPromise = runPostDiagnosisEnrichment(
        leadId,
        raw as any,
        { name: lead.name, product: lead.product, region: lead.region, client_type: lead.client_type },
      );
      // Timeout de 90s — se demorar mais, continua sem conteúdos
      const timeout = new Promise<void>(resolve => setTimeout(resolve, 90_000));
      await Promise.race([enrichPromise, timeout]);
      console.log(`[PlanGen] Enriquecimento concluído (ou timeout) para ${leadId}`);
    } catch (enrichErr) {
      console.error("[PlanGen] Erro no enriquecimento (non-fatal):", enrichErr);
    }

    // 6b. Update lead status — agora tudo está pronto
    await supabase
      .from("leads")
      .update({ plan_status: "ready", weeks_active: 0 })
      .eq("id", leadId);

    // 7. Notifica por WhatsApp + email
    const projecao = lead.diagnosis_display?.projecaoFinanceira;
    await notifyFullDiagnosisReady({
      email: lead.email,
      whatsapp: lead.whatsapp,
      leadId,
      product: lead.product,
      region: lead.region,
      name: lead.name,
      familiasGap: projecao?.familiasGap || 0,
      buscasMensais: raw.volumes?.totalMonthlyVolume || 0,
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
  const influence = raw.influence?.influence || {};
  const gaps = raw.gaps?.analysis || {};
  const maps = influence.rawGoogle?.mapsPresence || raw.marketSizing?.mapsPresence || null;
  const igBusiness = influence.rawInstagram?.businessProfile || null;
  const bd = influence.breakdown || {};
  const mapsCompetitors = (maps?.mapsCompetitors || []).slice(0, 3);

  // Contexto compacto em JSON para economizar tokens
  const ctx = {
    negocio: lead.product,
    cidade: lead.region?.split(',')[0]?.trim(),
    diferencial: lead.differentiator || null,
    scores: {
      D1: bd.d1_descoberta ?? bd.d1_discovery ?? 0,
      D2: bd.d2_credibilidade ?? bd.d2_credibility ?? 0,
      D3: bd.d3_presenca ?? bd.d3_reach ?? 0,
      D4: bd.d4_reputacao ?? 0,
      geral: influence.totalInfluence || 0,
    },
    mercado: {
      buscasMensais: raw.volumes?.totalMonthlyVolume || 0,
      populacaoRaio: raw.audienciaDisplay?.populacaoRaio || null,
      raioKm: raw.audienciaDisplay?.raioKm || null,
    },
    maps: maps?.found ? {
      rating: maps.rating || null,
      reviews: maps.reviewCount || 0,
      fotos: maps.photoCount || maps.photos || 0,
      respostaDono: maps.ownerResponseRate != null ? `${Math.round(maps.ownerResponseRate * 100)}%` : null,
    } : null,
    instagram: igBusiness?.followers > 0 ? {
      handle: lead.instagram || null,
      seguidores: igBusiness.followers,
      posts30d: igBusiness.postsLast30d || 0,
      engajamento: igBusiness.engagementRate || 0,
    } : (lead.instagram ? { handle: lead.instagram, semDados: true } : null),
    site: lead.site || false,
    concorrentes: mapsCompetitors.map((c: any) => ({
      nome: c.name, rating: c.rating, reviews: c.reviewCount,
    })),
    gaps: (gaps.gaps || []).slice(0, 3).map((g: any) => g.title),
    gapHeadline: gaps.headlineInsight || null,
  };

  return JSON.stringify(ctx, null, 2);
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

  const prompt = `Você é um especialista em marketing local para pequenos negócios brasileiros.
Com base no diagnóstico abaixo, gere os itens estruturantes prioritários — as ações fundamentais que precisam estar no lugar antes de qualquer outra coisa.

Diagnóstico: ${context}

Dimensão mais fraca: ${dimensaoMaisFraca}
Alavancas: ${leversText}

Regras:
- Máximo 8 itens, mínimo 4
- Cada item deve ser específico para os dados reais do negócio (use os números)
- Ordenados por impacto: o item 1 é o que mais move agora
- Foque nos gaps reais: se Descoberta é baixa, os primeiros itens devem endereçar isso
- Use linguagem direta, sem jargão

Retorne APENAS JSON válido:
{"items":[{"id":"maps_profile","dimensao":"descoberta","titulo":"Título curto (max 10 palavras)","descricao":"Por que importa + como fazer (2-3 frases)","acao":"Passo a passo em 2-3 linhas","verificacao":"Como confirmar que está feito","impacto":"alto","prazo":"esta semana","concluido":false}],"summary":"1 frase resumindo o maior gap"}`;

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2500,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  let parsed: { items: ItensEstruturante[]; summary: string };
  try {
    parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  } catch (parseErr) {
    console.error('[PlanGen] JSON parse failed for itens estruturantes:', (parseErr as Error).message, 'Raw:', text.slice(0, 500));
    throw new Error('Failed to parse itens estruturantes JSON');
  }
  if (!parsed.items || parsed.items.length === 0) {
    console.error('[PlanGen] Haiku retornou 0 itens. Raw:', text.slice(0, 500));
    throw new Error('Haiku returned 0 itens estruturantes');
  }
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

  const prompt = `Briefing de boas-vindas. Negócio: ${lead.product} em ${shortRegion}. Primeiro item: ${firstAction}. ${firstActionDetail ? `Detalhe: ${firstActionDetail}` : ''} ${relatorioSetorial.destaque ? `Contexto: ${relatorioSetorial.destaque}` : ''}

JSON: {"changes":[{"direction":"neutral","description":"Ponto de partida."}],"weeklyAction":"ação prática da semana","narrative":"2 parágrafos curtos de boas-vindas (máx 100 palavras, 2ª pessoa, direto)"}`;

  const response = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
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
