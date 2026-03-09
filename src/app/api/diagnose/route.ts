// ============================================================================
// Virô — Diagnose Route (síncrono + notificações)
// Pipeline roda de forma síncrona — Vercel maxDuration=180s garante o tempo
// Ao terminar: salva resultado + notifica via WhatsApp + email
// GET ?leadId=X — polling endpoint para ResultadoClient
// File: src/app/api/diagnose/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/schema";
import { insertLead, updateLeadStatus, insertDiagnosis } from "@/lib/supabase";
import { runInstantAnalysis } from "@/lib/analysis";
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
        email: formData.email,
        whatsapp: formData.whatsapp || "",
        site: formData.site || "",
        instagram: formData.instagram || "",
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
        status: "processing",
      });
    } catch (dbError) {
      console.error("[Diagnose] insertLead failed:", dbError);
      lead = { id: "temp_" + Date.now() };
    }

    // 2. Roda pipeline (síncrono — Vercel aguarda até maxDuration=180s)
    const pipelineResult = await runInstantAnalysis(formData, locale);
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
    const display = buildDisplayData(pipelineResult);

    // 6. Salva display no lead (para /resultado/[leadId] e polling)
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("leads")
        .update({ status: "done", diagnosis_display: display })
        .eq("id", lead.id);
    } catch (err) {
      console.error("[Diagnose] update lead display failed:", err);
    }

    // 7. Notifica por WhatsApp + email (non-blocking — erros não quebram a resposta)
    notifyDiagnosisReady({
      email: formData.email,
      whatsapp: formData.whatsapp,
      leadId: lead.id,
      product: formData.product,
      region: formData.region,
      influencePercent: Math.round(pipelineResult.influence.influence.totalInfluence),
    }).catch((err) => console.error("[Diagnose] notify failed:", err));

    // 8. Responde com resultado completo (frontend exibe imediatamente)
    return NextResponse.json({
      lead_id: lead.id,
      results: display,
    });
  } catch (err) {
    console.error("[Diagnose] Unexpected error:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar análise" },
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
      .select("status, diagnosis_display")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.status === "done" && lead.diagnosis_display) {
      return NextResponse.json({ status: "done", results: lead.diagnosis_display });
    }

    return NextResponse.json({ status: lead.status || "processing" });
  } catch (err) {
    console.error("[Diagnose] GET error:", err);
    return NextResponse.json({ status: "processing" });
  }
}

// ─── buildDisplayData ────────────────────────────────────────────────────────

function buildDisplayData(result: any) {
  const sizing = result.marketSizing.sizing;
  const influence = result.influence.influence;
  const gaps = result.gaps.analysis;

  const serpPositions = influence.rawGoogle?.serpPositions || [];
  const mapsData = influence.rawGoogle?.mapsPresence || null;
  const igData = influence.rawInstagram || null;

  const terms = result.terms.terms.slice(0, 10).map((t: any) => {
    const volumeMatch = result.volumes.termVolumes.find((v: any) => v.term === t.term);
    const serpMatch = serpPositions.find(
      (sp: any) => sp.term?.toLowerCase() === t.term.toLowerCase()
    );
    return {
      term: t.term,
      volume: volumeMatch?.monthlyVolume || 0,
      cpc: volumeMatch?.cpcBrl || 0,
      intent: t.intent,
      position: serpMatch?.position ? String(serpMatch.position) : "—",
      serpFeatures: serpMatch?.serpFeatures || [],
    };
  });

  return {
    terms,
    totalVolume: result.volumes.totalMonthlyVolume,
    avgCpc: 0,
    marketLow: sizing.marketPotential.low,
    marketHigh: sizing.marketPotential.high,
    influencePercent: Math.round(influence.totalInfluence),
    source: result.sourcesUsed.join(", "),
    confidence: result.confidenceLevel,
    pipeline: {
      version: result.pipelineVersion,
      durationMs: result.totalProcessingTimeMs,
      sourcesUsed: result.sourcesUsed,
      sourcesUnavailable: result.sourcesUnavailable,
    },
    gapHeadline: gaps.headlineInsight || "",
    gapPattern: gaps.primaryPattern || null,
    gaps: gaps.gaps || [],
    workRoutes: gaps.workRoutes || [],
    influenceBreakdown: {
      google: influence.google?.score || 0,
      instagram: influence.instagram?.score || 0,
      web: influence.web?.available ? influence.web.score : null,
    },
    maps: mapsData ? {
      found: mapsData.found || false,
      rating: mapsData.rating || null,
      reviewCount: mapsData.reviewCount || null,
      categories: mapsData.categories || [],
      inLocalPack: mapsData.inLocalPack || false,
      photos: mapsData.photos || 0,
    } : null,
    instagram: igData?.profile ? {
      handle: igData.profile.handle || "",
      followers: igData.profile.followers || 0,
      engagementRate: igData.profile.engagementRate || 0,
      postsLast30d: igData.profile.postsLast30d || 0,
      avgLikes: igData.profile.avgLikesLast30d || 0,
      avgViews: igData.profile.avgViewsReelsLast30d || 0,
      dataAvailable: igData.profile.dataAvailable || false,
    } : null,
    competitorInstagram: igData?.competitors
      ?.filter((c: any) => c.dataAvailable)
      ?.map((c: any) => ({
        handle: c.handle,
        followers: c.followers || 0,
        engagementRate: c.engagementRate || 0,
        postsLast30d: c.postsLast30d || 0,
        avgLikes: c.avgLikesLast30d || 0,
        avgViews: c.avgViewsReelsLast30d || 0,
      })) || [],
    serpSummary: {
      termsScraped: serpPositions.length,
      termsRanked: serpPositions.filter((sp: any) => sp.position && sp.position <= 10).length,
      hasLocalPack: serpPositions.some((sp: any) => sp.serpFeatures?.includes("local_pack")),
      hasAds: serpPositions.some((sp: any) => sp.serpFeatures?.includes("ads")),
    },
    aiVisibility: result.aiVisibility || null,
    termGeneration: {
      count: result.terms.termCount,
      model: result.terms.generationModel,
      promptVersion: result.terms.promptVersion,
    },
  };
}
