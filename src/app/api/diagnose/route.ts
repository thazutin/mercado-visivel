// ============================================================================
// Virô — Diagnose Route (síncrono + notificações)
// Pipeline roda de forma síncrona — Vercel maxDuration=180s garante o tempo
// Ao terminar: salva resultado + notifica via WhatsApp + email
// GET ?leadId=X — polling endpoint para ResultadoClient
// File: src/app/api/diagnose/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { leadSchema } from "@/lib/schema";
import { insertLead, updateLeadStatus, insertDiagnosis } from "@/lib/supabase";
import { runInstantAnalysis, runPostDiagnosisEnrichment, buildDisplayData, sanitizeProjecao } from "@/lib/analysis";
import { notifyDiagnosisReady } from "@/lib/notify";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 180;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── POST /api/diagnose ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Kill switch — pausa novas entradas sem precisar de deploy.
    // Setar VIRO_DIAGNOSE_PAUSED=true no Vercel Environment Variables → pausa em < 30s.
    if (process.env.VIRO_DIAGNOSE_PAUSED === "true") {
      return NextResponse.json(
        {
          error: "paused",
          message: "Estamos em manutenção rápida. Volte em alguns minutos — seu diagnóstico continua disponível assim que reabrirmos.",
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
        { status: 400 }
      );
    }

    const formData = parsed.data;
    const locale = formData.locale || "pt";

    // 1. Salva lead
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
        ticket: typeof formData.ticket === "number"
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
        status: "processing",
      });
    } catch (dbError) {
      console.error("[Diagnose] insertLead failed:", dbError);
      lead = { id: "temp_" + Date.now() };
    }

    // 2. Roda pipeline (síncrono — com safety timeout de 150s antes do Vercel matar em 180s)
    const pipelineResult = await Promise.race([
      runInstantAnalysis(formData, locale),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Pipeline timeout: 150s exceeded')), 150_000)
      ),
    ]);
    pipelineResult.leadId = lead.id;

    // 3. Salva diagnóstico
    try {
      await insertDiagnosis({
        lead_id: lead.id,
        terms: pipelineResult.terms.terms.map((t: any) => {
          const serpMatch = pipelineResult.influence?.influence?.rawGoogle?.serpPositions?.find(
            (sp: any) => sp.term.toLowerCase() === t.term.toLowerCase()
          );
          return {
            term: t.term,
            volume: pipelineResult.volumes.termVolumes.find(
              (v: any) => v.term === t.term
            )?.monthlyVolume || 0,
            cpc: pipelineResult.volumes.termVolumes.find(
              (v: any) => v.term === t.term
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
      console.error("[Diagnose] insertDiagnosis failed:", err);
    }

    // 4. Salva pipeline_run
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("pipeline_runs").insert({
        lead_id: lead.id,
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
      console.warn("[Diagnose] pipeline_runs skipped:", (err as Error).message);
    }

    // 5. Monta display data
    console.log(`[Diagnose] audiencia object:`, JSON.stringify(pipelineResult.audiencia || null));
    console.log(`[Diagnose] volumes: totalMonthly=${pipelineResult.volumes?.totalMonthlyVolume}, termCount=${pipelineResult.volumes?.termVolumes?.length}`);
    const display = buildDisplayData(pipelineResult);
    // Lat/lng: prioriza form (Places autocomplete), fallback pipeline (geocoding)
    display.lat = formData.lat || (pipelineResult as any).pipelineLat || null;
    display.lng = formData.lng || (pipelineResult as any).pipelineLng || null;
    console.log(`[Diagnose] buildDisplayData keys:`, Object.keys(display));
    console.log(`[Diagnose] display.totalVolume=${display.totalVolume}, display.audiencia=${JSON.stringify(display.audiencia)}, display.influencePercent=${display.influencePercent}, display.marketLow=${display.marketLow}, display.marketHigh=${display.marketHigh}`);

    // 6. Salva display no lead (para /resultado/[leadId] e polling)
    try {
      const supabase = getSupabaseAdmin();
      const { error: updateError } = await supabase
        .from("leads")
        .update({ status: "done", diagnosis_display: display, client_type: pipelineResult.clientType || "b2c" })
        .eq("id", lead.id);
      if (updateError) {
        console.error("[Diagnose] update lead display SUPABASE ERROR:", updateError.message, updateError.details, updateError.hint);
      } else {
        console.log(`[Diagnose] lead ${lead.id} updated: status=done, display keys=${Object.keys(display).join(',')}, audiencia=${display.audiencia ? 'present' : 'null'}`);
      }
    } catch (err) {
      console.error("[Diagnose] update lead display failed:", err);
    }

    // Helper: calcula oportunidade exibida no email
    const computeEmailOportunidade = (d: typeof display, influencePercent: number) => {
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
    };

    // 7. Notifica por email IMEDIATAMENTE — síncrono, antes do response.
    // Trade-off: o email pode ter números levemente diferentes do dashboard
    // após o enrichment background (~30s depois), mas a entrega é garantida.
    // Defer pra waitUntil estava fazendo emails sumirem em prod.
    try {
      const initialInfluence = Math.round(pipelineResult.influence.influence.totalInfluence);
      const initialSearchVolume = pipelineResult.volumes.totalMonthlyVolume || 0;
      const initialProjecao: any = (pipelineResult as any).projecaoFinanceira;
      const initialDemandType: string = (pipelineResult as any).demandType || 'local_residents';
      const emailOportunidade = computeEmailOportunidade(display, initialInfluence);

      await notifyDiagnosisReady({
        email: formData.email,
        whatsapp: formData.whatsapp,
        leadId: lead.id,
        product: formData.product,
        region: formData.region,
        influencePercent: initialInfluence,
        searchVolume: initialSearchVolume,
        projecaoFinanceira: { ...(sanitizeProjecao(initialProjecao) || {}), familiasGap: emailOportunidade },
        name: formData.businessName || formData.product,
        demandType: initialDemandType as any,
      });
      console.log("[Diagnose] notify completed (sync, pre-enrichment)");
    } catch (err) {
      console.error("[Diagnose] notify failed:", err);
    }

    // 8. Background tasks — enrichment + atualizações de display (não bloqueia response)
    waitUntil((async () => {
      try {
        await runPostDiagnosisEnrichment(lead.id, pipelineResult, {
          name: (formData as any).name || formData.product,
          product: formData.product,
          region: formData.region,
          client_type: pipelineResult.clientType || "b2c",
        });
      } catch (err) {
        console.error("[Diagnose] Enrichment failed:", err);
      }

      // Se dados slow ficaram pendentes, re-roda pipeline completo e atualiza display
      if (display.enrichmentStatus === 'pending') {
        console.log(`[Diagnose] Slow enrichment pending: [${display.enrichmentPending?.join(', ')}] — running full pipeline in background`);
        try {
          const fullResult = await runInstantAnalysis(formData, locale);
          const fullDisplay = buildDisplayData(fullResult);
          fullDisplay.lat = formData.lat || null;
          fullDisplay.lng = formData.lng || null;
          fullDisplay.enrichmentStatus = 'complete';
          fullDisplay.enrichmentPending = [];

          const supabaseAdmin = getSupabaseAdmin();
          await supabaseAdmin
            .from('leads')
            .update({ diagnosis_display: fullDisplay })
            .eq('id', lead.id);
          console.log(`[Diagnose] Background enrichment complete for ${lead.id}`);
        } catch (err) {
          console.error('[Diagnose] Background enrichment failed:', err);
          try {
            const supabaseAdmin = getSupabaseAdmin();
            display.enrichmentStatus = 'complete';
            await supabaseAdmin.from('leads').update({ diagnosis_display: display }).eq('id', lead.id);
          } catch { /* ignore */ }
        }
      }
    })());

    // 9. Responde com resultado FAST (frontend exibe imediatamente, polls para enrichment)
    return NextResponse.json({
      lead_id: lead.id,
      results: display,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Diagnose] Unexpected error:", err instanceof Error ? `${err.message}\n${err.stack}` : err);

    // Mark lead as done with error flag so it doesn't stay stuck in processing
    // Status 'error' may not exist in schema — use 'done' with empty display
    if (lead?.id) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase.from('leads').update({
          status: 'done',
          diagnosis_display: {
            terms: [], totalVolume: 0, avgCpc: 0, marketLow: 0, marketHigh: 0,
            influencePercent: 0, source: 'error', confidence: 'low',
            pipeline: { version: 'error', durationMs: 0, sourcesUsed: [], sourcesUnavailable: ['pipeline_error'] },
            _error: errMsg,
          },
        }).eq('id', lead.id);
        console.log(`[Diagnose] Lead ${lead.id} marked as done with error display`);
      } catch (updateErr) {
        console.error('[Diagnose] Failed to mark lead as done:', updateErr);
      }
    }

    return NextResponse.json(
      { error: "Erro interno ao processar análise", reason: errMsg, leadId: lead?.id },
      { status: 500 }
    );
  }
}

// ─── GET /api/diagnose?leadId=X ──────────────────────────────────────────────
// Polling endpoint — usado por /resultado/[leadId] para carregar diagnóstico salvo

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

// sanitizeProjecao and buildDisplayData are now imported from @/lib/analysis
