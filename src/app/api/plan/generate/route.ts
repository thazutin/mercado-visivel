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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) console.error('[PlanGen] SUPABASE_SERVICE_ROLE_KEY is missing! Using anon key as fallback.');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    const t0 = Date.now();
    const context = buildContext(lead, raw);
    const breakdown = raw.influence?.influence?.breakdown || {};
    const levers = breakdown?.levers || [];
    const shortRegionGen = (lead.region || '').split(',')[0].trim();

    // 3. ESCALONADO: Itens → (2s) → Relatório → (2s) → Macro (evita rate limit)
    const stagger = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    console.log(`[PlanGen] Iniciando geração escalonada para lead ${leadId}...`);
    const [itensResult, relatorioResult, macroResult] = await Promise.allSettled([
      generateItensEstruturantes(claude, context, levers, breakdown, lead.client_type || 'b2c'),
      stagger(2000).then(() => generateRelatorioSetorial(lead.product, lead.region, lead.client_type || 'b2c')),
      stagger(4000).then(() => claude.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1200, temperature: 0.3,
        system: 'Responda APENAS com JSON válido.',
        messages: [{ role: 'user', content: `Em 3-4 frases diretas, descreva o cenário atual do mercado de "${lead.product}" em ${shortRegionGen}. Inclua: tendências recentes, nível de digitalização do setor, e 1 oportunidade específica. Sem jargão. JSON: {"summary":"...","indicators":[],"outlook":"neutral","key_opportunity":"..."}` }],
      })),
    ]);
    console.log(`[PlanGen] Escalonado concluído em ${Date.now() - t0}ms`);

    // Extrair resultados
    const itensEstruturantes = itensResult.status === 'fulfilled' ? itensResult.value
      : (() => { console.error('[PlanGen] Itens falhou:', (itensResult as any).reason); throw (itensResult as any).reason; })();
    console.log(`[PlanGen] Itens OK: ${itensEstruturantes.items.length} itens (${Date.now() - t0}ms)`);

    const relatorioSetorial = relatorioResult.status === 'fulfilled' ? relatorioResult.value
      : { destaque: '', tendencias: [], oportunidade_da_semana: '', contexto_competitivo: '', data_ref: '', fontes_resumo: '' };
    if (relatorioResult.status === 'rejected') console.error('[PlanGen] Relatório falhou (non-fatal):', (relatorioResult as any).reason);
    else console.log(`[PlanGen] Relatório OK (${Date.now() - t0}ms)`);

    // Macro context
    let macroContext: any = { summary: 'Contexto não disponível.', indicators: [], outlook: 'neutral', key_opportunity: '' };
    if (macroResult.status === 'fulfilled') {
      const cenText = macroResult.value.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
      try { macroContext = extractJson(cenText); }
      catch { macroContext = { summary: cenText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim().slice(0, 500), indicators: [], outlook: 'neutral', key_opportunity: '' }; }
      if (diagnosisId) await supabase.from('diagnoses').update({ macro_context: macroContext }).eq('id', diagnosisId);
      console.log(`[PlanGen] Macro OK (${Date.now() - t0}ms)`);
    } else {
      console.error('[PlanGen] Macro falhou (non-fatal):', (macroResult as any).reason);
    }

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

    // 5b. Salvar itens como JSONB array em uma única linha
    try {
      const itemsParaSalvar = itensEstruturantes.items.map((item: any, idx: number) => ({
        id: item.id || String(idx + 1),
        titulo: item.titulo,
        descricao: item.descricao,
        dimensao: item.dimensao,
        pilar: item.pilar || item.dimensao,
        impacto: item.impacto,
        prazo: item.prazo,
        concluida: false,
        copy_pronto: item.copy_pronto || '',
      }));

      // Delete existing then insert fresh (upsert may fail silently without unique constraint)
      await supabase.from('checklists').delete().eq('lead_id', leadId);

      const { data: insertData, error: insertError } = await supabase
        .from('checklists')
        .insert({ lead_id: leadId, items: itemsParaSalvar })
        .select();

      console.log('[PlanGen] Checklist insert result:', {
        data: insertData ? `${insertData.length} rows` : 'null',
        error: insertError?.message || null,
        itemCount: itemsParaSalvar.length,
        leadId,
      });

      if (insertError) {
        console.error('[PlanGen] Checklist ERRO:', insertError.message, insertError.details, insertError.hint);
      } else {
        console.log(`[PlanGen] Checklists salvos: ${itemsParaSalvar.length} itens`);
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

    console.log(`[PlanGen] Plan ready for lead ${leadId} — total: ${Date.now() - t0}ms`);

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

// ─── JSON REPAIR ─────────────────────────────────────────────────────────────

function repairTruncatedJson(raw: string): string {
  let text = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { JSON.parse(text); return text; } catch { /* continue */ }

  let braces = 0, brackets = 0, inString = false, escaped = false;
  for (const char of text) {
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && inString) { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') braces++;
    if (char === '}') braces--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
  }

  // If we're inside a string, close it
  if (inString) text += '"';

  // Remove last possibly truncated item (after last comma but before closing)
  const lastComma = text.lastIndexOf(',');
  const lastClose = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (lastComma > lastClose) {
    text = text.substring(0, lastComma);
  }

  // Recount after trimming
  braces = 0; brackets = 0; inString = false; escaped = false;
  for (const char of text) {
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && inString) { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') braces++;
    if (char === '}') braces--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
  }

  for (let i = 0; i < brackets; i++) text += ']';
  for (let i = 0; i < braces; i++) text += '}';

  return text;
}

// ─── ITENS ESTRUTURANTES ─────────────────────────────────────────────────────

interface ItensEstruturante {
  id: string;
  dimensao: string;
  titulo: string;
  descricao: string;
  impacto: string;
  prazo: string;
  concluido: boolean;
  copy_pronto?: string;
  pilar?: string;
}

function extractJson(raw: string): any {
  let text = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try { return JSON.parse(text); } catch {
    const repaired = repairTruncatedJson(text);
    return JSON.parse(repaired);
  }
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
  const dimensaoMaisFraca = Math.min(d1, d2, d3, d4) === d1 ? 'descoberta' :
    Math.min(d1, d2, d3, d4) === d2 ? 'credibilidade' : 'presenca';
  const contextoCompacto = context.slice(0, 500);

  // ── CHAMADA 1: Estrutura dos 15 itens ──────────────────────────────────
  console.log('[PlanGen] Chamada 1: gerando estrutura de 15 itens...');
  const t0 = Date.now();
  const resEstrutura = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    temperature: 0.1,
    system: 'Responda APENAS com JSON válido. Sem texto antes ou depois.',
    messages: [{ role: 'user', content: `Gere exatamente 15 atividades do basico bem feito para este negocio.
Retorne APENAS este JSON:
{"items":[{"id":"1","dimensao":"descoberta","titulo":"Titulo em ate 8 palavras","descricao":"Por que importa em 1 frase.","pilar":"Descoberta","impacto":"+3pts Descoberta","prazo":"Esta semana","concluida":false}]}
Regras:
- Exatamente 15 itens
- dimensao: apenas "descoberta", "credibilidade" ou "presenca"
- pilar: apenas "Descoberta", "Credibilidade" ou "Cultura"
- descricao: 1 frase, max 100 caracteres, dados reais do negocio
- impacto: max 20 caracteres
- prazo: apenas "Esta semana", "Este mes" ou "Proximos 3 meses"
- Ordene por impacto: item 1 = maior alavanca
- Pilar mais fraco: ${dimensaoMaisFraca}
Negocio: ${contextoCompacto}` }],
  });

  const rawEstrutura = resEstrutura.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  console.log(`[PlanGen] Chamada 1 OK (${Date.now() - t0}ms, ${rawEstrutura.length} chars, stop=${(resEstrutura as any).stop_reason})`);

  let parsed: { items: ItensEstruturante[]; summary?: string };
  try {
    parsed = extractJson(rawEstrutura);
  } catch (err) {
    console.error('[PlanGen] Chamada 1 parse falhou:', (err as Error).message, '\nRaw:', rawEstrutura.slice(0, 1000));
    throw new Error('Failed to parse itens JSON');
  }
  if (!parsed?.items || parsed.items.length < 3) {
    throw new Error(`Itens insuficientes: ${parsed?.items?.length ?? 0}`);
  }
  console.log(`[PlanGen] Chamada 1: ${parsed.items.length} itens`);

  // ── CHAMADA 2: Enriquecer com copy_pronto (batches de 5) ──────────────
  const items = parsed.items;
  const BATCH = 5;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    try {
      console.log(`[PlanGen] Copy batch ${i}-${i + batch.length}...`);
      const resCopy = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        temperature: 0.2,
        system: 'Responda APENAS com JSON válido.',
        messages: [{ role: 'user', content: `Para cada atividade, gere copy_pronto — o texto PRONTO para usar (nao instrucoes, o texto em si). Max 200 chars.
Atividades:
${batch.map(it => `${it.id}. ${it.titulo}: ${it.descricao}`).join('\n')}
JSON: {"copies":[{"id":"1","copy_pronto":"texto pronto"}]}` }],
      });
      const copyRaw = resCopy.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
      const copyParsed = extractJson(copyRaw);
      for (const c of copyParsed.copies || []) {
        const idx = items.findIndex(it => String(it.id) === String(c.id));
        if (idx >= 0) items[idx].copy_pronto = c.copy_pronto;
      }
      console.log(`[PlanGen] Copy batch OK: ${(copyParsed.copies || []).length} copies`);
    } catch (err) {
      console.warn(`[PlanGen] Copy batch ${i} falhou (non-fatal):`, (err as Error).message);
    }
    if (i + BATCH < items.length) await new Promise(r => setTimeout(r, 1000));
  }

  const withCopy = items.filter(it => it.copy_pronto).length;
  console.log(`[PlanGen] Total: ${items.length} itens, ${withCopy} com copy_pronto`);
  return { items, summary: parsed.summary || '' };
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
      changes: [{ direction: "neutral", description: "Diagnóstico concluído — seu plano está pronto." }],
      weeklyAction: firstAction,
      narrative: `Seu diagnóstico de ${lead.product} em ${shortRegion} está pronto. Analisamos seu mercado, mapeamos a concorrência e montamos seu plano de ação. A cada semana você recebe um briefing com o que mudou e o que fazer. Comece agora pela primeira atividade.`,
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
