// ============================================================================
// Virô — Diagnose Route (assíncrono)
// POST cria o lead, retorna {lead_id, status:"processing"} em <1s.
// Pipeline + persistência + notify + enrichment rodam em background via
// waitUntil() — frontend redireciona imediatamente pra /resultado/[leadId]
// que mostra PollingScreen até status='done' no DB.
// GET ?leadId=X — polling endpoint para ResultadoClient/PollingScreen.
// File: src/app/api/diagnose/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { leadSchema, type LeadFormData } from "@/lib/schema";
import { insertLead, insertDiagnosis } from "@/lib/supabase";
import { runInstantAnalysis, runPostDiagnosisEnrichment, buildDisplayData, sanitizeProjecao } from "@/lib/analysis";
import { notifyDiagnosisReady } from "@/lib/notify";
import { createClient } from "@supabase/supabase-js";
import { classifyBusiness } from "@/lib/blueprints";
import { fetchExpandedSources } from "@/lib/pipeline/expanded-sources";

export const maxDuration = 180;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper: calcula oportunidade exibida no email
function computeEmailOportunidade(d: any, influencePercent: number): number {
  const proj = d.projecaoFinanceira;
  const audienciaTotal = d.audiencia?.audienciaTarget || 0;
  const familiasAtual = proj?.familiasAtual != null
    ? Math.min(proj.familiasAtual, audienciaTotal)
    : Math.round(audienciaTotal * (influencePercent / 100));
  const familiasPotencial = proj?.familiasPotencial != null
    ? Math.min(proj.familiasPotencial, audienciaTotal)
    : Math.round(audienciaTotal * (Math.min(influencePercent + 10, 100) / 100));
  let oportunidade = Math.max(0, familiasPotencial - familiasAtual);
  if (oportunidade <= 0 && audienciaTotal > 0) {
    oportunidade = proj?.familiasGap || Math.max(1, Math.round(audienciaTotal * 0.10));
  }
  return oportunidade;
}

// ─── Pipeline background executor ───────────────────────────────────────────
// Roda a análise completa + persiste no DB + notifica + enrichment.
// Chamado via waitUntil() após o lead ter sido criado.

async function runPipelineBackground(leadId: string, formData: LeadFormData, locale: string) {
  const supabase = getSupabaseAdmin();

  try {
    // 1. Pipeline (síncrono — safety timeout de 150s antes do Vercel matar em 180s)
    console.log(`[DiagnoseBG] Starting pipeline for lead ${leadId}`);
    const pipelineResult = await Promise.race([
      runInstantAnalysis(formData, locale),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Pipeline timeout: 150s exceeded")), 150_000),
      ),
    ]);
    (pipelineResult as any).leadId = leadId;

    // 2. Salva diagnóstico (tabela diagnoses)
    try {
      await insertDiagnosis({
        lead_id: leadId,
        terms: pipelineResult.terms.terms.map((t: any) => {
          const serpMatch = (pipelineResult.influence as any)?.influence?.rawGoogle?.serpPositions?.find(
            (sp: any) => sp.term?.toLowerCase() === t.term.toLowerCase(),
          );
          return {
            term: t.term,
            volume: pipelineResult.volumes.termVolumes.find(
              (v: any) => v.term === t.term,
            )?.monthlyVolume || 0,
            cpc: pipelineResult.volumes.termVolumes.find(
              (v: any) => v.term === t.term,
            )?.cpcBrl || 0,
            position: serpMatch?.position ? String(serpMatch.position) : "—",
          };
        }),
        total_volume: pipelineResult.volumes.totalMonthlyVolume,
        avg_cpc: 0,
        market_low: pipelineResult.marketSizing.sizing.marketPotential.low,
        market_high: pipelineResult.marketSizing.sizing.marketPotential.high,
        influence_percent: pipelineResult.influence.influence.totalInfluence,
        source: pipelineResult.sourcesUsed.join(", "),
        confidence: pipelineResult.confidenceLevel,
        pipeline_run_id: null,
        raw_data: pipelineResult,
        confidence_level: pipelineResult.confidenceLevel,
        audiencia: pipelineResult.audiencia || null,
        influence_breakdown: {
          ...(pipelineResult.influence?.influence as any)?.breakdown,
          levers: (pipelineResult.influence?.influence as any)?.breakdown?.levers || [],
        },
        projecao_financeira: sanitizeProjecao((pipelineResult as any).projecaoFinanceira),
      });
    } catch (err) {
      console.error("[DiagnoseBG] insertDiagnosis failed:", err);
    }

    // 3. Salva pipeline_run
    try {
      await supabase.from("pipeline_runs").insert({
        lead_id: leadId,
        pipeline_version: pipelineResult.pipelineVersion,
        total_duration_ms: pipelineResult.totalProcessingTimeMs,
        steps_timing: {
          step1_ms: pipelineResult.terms.processingTimeMs,
          step5_ms: pipelineResult.gaps.processingTimeMs,
        },
        sources_used: pipelineResult.sourcesUsed,
        sources_unavailable: pipelineResult.sourcesUnavailable,
        confidence_level: pipelineResult.confidenceLevel,
      });
    } catch (err) {
      console.warn("[DiagnoseBG] pipeline_runs skipped:", (err as Error).message);
    }

    // 3b. Classifica blueprint do negócio
    let blueprintId = 'servicos_local';
    try {
      const classification = await classifyBusiness({
        businessName: formData.businessName || formData.product,
        product: formData.product,
        clientType: (pipelineResult as any).clientType || formData.clientType || 'b2c',
        salesChannel: (formData as any).salesChannel,
        region: formData.region,
        instagram: formData.instagram,
        site: formData.site,
      });
      blueprintId = classification.blueprint.id;
      console.log(`[DiagnoseBG] Blueprint: ${blueprintId} (${classification.method}, ${classification.confidence})`);
    } catch (err) {
      console.warn('[DiagnoseBG] Blueprint classification failed (non-fatal):', (err as Error).message);
    }

    // 3c. Fetch expanded data sources (paralelo, non-blocking, ~20s)
    let expandedData: any = null;
    try {
      expandedData = await fetchExpandedSources(blueprintId, {
        name: formData.businessName || formData.product,
        product: formData.product,
        region: formData.region,
        instagram: formData.instagram,
        linkedin: (formData as any).linkedin,
        site: formData.site,
        sales_channel: (formData as any).salesChannel,
      }, buildDisplayData(pipelineResult));
      console.log(`[DiagnoseBG] Expanded sources: ${Object.keys(expandedData).filter(k => k !== 'fetchedAt' && expandedData[k]).join(', ') || 'none'}`);
    } catch (err) {
      console.warn('[DiagnoseBG] Expanded sources failed (non-fatal):', (err as Error).message);
    }

    // 4. Monta display data
    const display = buildDisplayData(pipelineResult);
    (display as any).blueprintId = blueprintId;
    if (expandedData) (display as any).expandedData = expandedData;
    display.lat = formData.lat || (pipelineResult as any).pipelineLat || null;
    display.lng = formData.lng || (pipelineResult as any).pipelineLng || null;
    console.log(
      `[DiagnoseBG] display ready for ${leadId}: totalVolume=${display.totalVolume}, influence=${display.influencePercent}, audiencia=${display.audiencia ? "present" : "null"}`,
    );

    // 5. Salva display no lead — ESSE é o sinal que o polling procura
    try {
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          status: "done",
          diagnosis_display: display,
          client_type: pipelineResult.clientType || "b2c",
          blueprint_id: blueprintId,
        })
        .eq("id", leadId);
      if (updateError) {
        console.error(
          "[DiagnoseBG] update lead display SUPABASE ERROR:",
          updateError.message,
          updateError.details,
          updateError.hint,
        );
      } else {
        console.log(`[DiagnoseBG] lead ${leadId} status=done, display saved`);
      }
    } catch (err) {
      console.error("[DiagnoseBG] update lead display failed:", err);
    }

    // 6. Notifica por email (WhatsApp desativado até a Meta reativar a WABA)
    try {
      const initialInfluence = Math.round(pipelineResult.influence.influence.totalInfluence);
      const initialSearchVolume = pipelineResult.volumes.totalMonthlyVolume || 0;
      const initialProjecao: any = (pipelineResult as any).projecaoFinanceira;
      const initialDemandType: string = (pipelineResult as any).demandType || "local_residents";
      const emailOportunidade = computeEmailOportunidade(display, initialInfluence);

      await notifyDiagnosisReady({
        email: formData.email,
        whatsapp: formData.whatsapp || "",
        leadId,
        product: formData.product,
        region: formData.region,
        influencePercent: initialInfluence,
        searchVolume: initialSearchVolume,
        projecaoFinanceira: {
          ...(sanitizeProjecao(initialProjecao) || {}),
          familiasGap: emailOportunidade,
        },
        name: (formData as any).businessName || formData.product,
        demandType: initialDemandType as any,
      });
      console.log(`[DiagnoseBG] notify completed for ${leadId}`);
    } catch (err) {
      console.error("[DiagnoseBG] notify failed:", err);
    }

    // 7. Post-enrichment (checklist, seasonality, content)
    try {
      await runPostDiagnosisEnrichment(leadId, pipelineResult, {
        name: (formData as any).businessName || formData.product,
        product: formData.product,
        region: formData.region,
        client_type: pipelineResult.clientType || "b2c",
      });
    } catch (err) {
      console.error("[DiagnoseBG] Post-enrichment failed:", err);
    }

    // 8. Se dados slow ficaram pendentes, re-roda pipeline completo e atualiza display
    if (display.enrichmentStatus === "pending") {
      console.log(
        `[DiagnoseBG] Slow enrichment pending: [${display.enrichmentPending?.join(", ")}] — running full pipeline in background`,
      );
      try {
        const fullResult = await runInstantAnalysis(formData, locale);
        const fullDisplay = buildDisplayData(fullResult);
        fullDisplay.lat = formData.lat || null;
        fullDisplay.lng = formData.lng || null;
        fullDisplay.enrichmentStatus = "complete";
        fullDisplay.enrichmentPending = [];

        await supabase
          .from("leads")
          .update({ diagnosis_display: fullDisplay })
          .eq("id", leadId);
        console.log(`[DiagnoseBG] Background enrichment complete for ${leadId}`);
      } catch (err) {
        console.error("[DiagnoseBG] Background enrichment failed:", err);
        try {
          display.enrichmentStatus = "complete";
          await supabase.from("leads").update({ diagnosis_display: display }).eq("id", leadId);
        } catch {
          /* ignore */
        }
      }
    }

    console.log(`[DiagnoseBG] Pipeline background completed for ${leadId}`);
  } catch (err) {
    // Pipeline falhou — marca o lead como done com display vazio pra não travar
    // em "processing" pra sempre. O ResultadoClient vai renderizar o display
    // vazio (fallback visual) e o usuário vê uma mensagem honesta.
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[DiagnoseBG] Pipeline FAILED for ${leadId}:`,
      err instanceof Error ? `${err.message}\n${err.stack}` : err,
    );
    try {
      await supabase
        .from("leads")
        .update({
          status: "done",
          diagnosis_display: {
            terms: [],
            totalVolume: 0,
            avgCpc: 0,
            marketLow: 0,
            marketHigh: 0,
            influencePercent: 0,
            source: "error",
            confidence: "low",
            pipeline: {
              version: "error",
              durationMs: 0,
              sourcesUsed: [],
              sourcesUnavailable: ["pipeline_error"],
            },
            _error: errMsg,
          },
        })
        .eq("id", leadId);
    } catch (updateErr) {
      console.error("[DiagnoseBG] Failed to mark lead as done:", updateErr);
    }
  }
}

// ─── POST /api/diagnose ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Kill switch — pausa novas entradas sem precisar de deploy.
    if (process.env.VIRO_DIAGNOSE_PAUSED === "true") {
      return NextResponse.json(
        {
          error: "paused",
          message:
            "Estamos em manutenção rápida. Volte em alguns minutos — seu diagnóstico continua disponível assim que reabrirmos.",
        },
        { status: 503 },
      );
    }

    const body = await req.json();

    // Honeypot
    if (body.website_url) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const formData = parsed.data;
    const locale = formData.locale || "pt";

    // 1. Cria o lead SÍNCRONO — precisamos do leadId pra devolver ao client
    let lead: { id: string };
    try {
      lead = await insertLead({
        name: (formData as any).businessName || (formData as any).name || "",
        email: formData.email || "",
        whatsapp: formData.whatsapp || "",
        site: formData.site || "",
        instagram: formData.instagram || "",
        linkedin: (formData as any).linkedin || "",
        other_social: "",
        google_maps: "",
        product: formData.product,
        customer_description: formData.customerDescription || "",
        region: formData.region,
        address: formData.address || "",
        place_id: formData.placeId || "",
        lat: formData.lat || null,
        lng: formData.lng || null,
        ticket:
          typeof formData.ticket === "number"
            ? String(formData.ticket)
            : formData.ticket || "",
        channels: formData.channels || [],
        differentiator: formData.differentiator || "",
        competitors: formData.competitors || [],
        challenge: formData.challenge || "",
        free_text: formData.freeText || "",
        locale,
        coupon: formData.coupon || "",
        client_type: formData.clientType || "b2c",
        sales_channel: (formData as any).salesChannel || null,
        status: "processing",
      });
    } catch (dbError) {
      console.error("[Diagnose] insertLead failed:", dbError);
      return NextResponse.json(
        { error: "Erro ao criar diagnóstico. Tente novamente em alguns segundos." },
        { status: 500 },
      );
    }

    // 2. Dispara pipeline em background — client redireciona antes de terminar
    waitUntil(runPipelineBackground(lead.id, formData as LeadFormData, locale));

    // 3. Responde IMEDIATAMENTE — cliente vai redirecionar pra /resultado/[leadId]
    //    que faz polling no GET até status='done'.
    return NextResponse.json({
      lead_id: lead.id,
      status: "processing",
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      "[Diagnose] Unexpected error:",
      err instanceof Error ? `${err.message}\n${err.stack}` : err,
    );
    return NextResponse.json(
      { error: "Erro interno ao processar análise", reason: errMsg },
      { status: 500 },
    );
  }
}

// ─── GET /api/diagnose?leadId=X ──────────────────────────────────────────────
// Polling endpoint — usado por /resultado/[leadId] e PollingScreen para
// carregar diagnóstico salvo ou aguardar ele ficar pronto.

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: lead } = await supabase
      .from("leads")
      .select("status, diagnosis_display, lat, lng, plan_status")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.status === "done" && lead.diagnosis_display) {
      const displayData = lead.diagnosis_display;
      if (!displayData.lat && lead.lat) displayData.lat = lead.lat;
      if (!displayData.lng && lead.lng) displayData.lng = lead.lng;
      return NextResponse.json({
        status: "done",
        results: displayData,
        plan_status: lead.plan_status || null,
      });
    }

    return NextResponse.json({
      status: lead.status || "processing",
      plan_status: lead.plan_status || null,
    });
  } catch (err) {
    console.error("[Diagnose] GET error:", err);
    return NextResponse.json({ status: "processing" });
  }
}
