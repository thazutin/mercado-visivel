import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/schema";
import { insertLead, insertDiagnosis } from "@/lib/supabase";
import { runInstantAnalysis } from "@/lib/analysis";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = leadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const formData = parsed.data;
    const locale = formData.locale || "pt";

    // 1. Save lead to Supabase
    let lead;
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
      console.error("[DB] Failed to insert lead:", dbError);
      lead = { id: "temp_" + Date.now() };
    }

    // 2. Run real pipeline
    const pipelineResult = await runInstantAnalysis(formData, locale);
    pipelineResult.leadId = lead.id;

    // 3. Save diagnosis + pipeline run
    try {
      await insertDiagnosis({
        lead_id: lead.id,
        terms: pipelineResult.terms.terms.map((t) => {
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
    } catch (dbError) {
      console.error("[DB] Failed to insert diagnosis:", dbError);
    }

    // 4. Save pipeline run (if table exists)
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
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
      console.warn("[DB] pipeline_runs insert skipped:", (err as Error).message);
    }

    // 5. Build response for frontend
    const display = buildDisplayData(pipelineResult);

    return NextResponse.json({
      lead_id: lead.id,
      results: display,
    });
  } catch (err) {
    console.error("[API] Diagnose error:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar análise" },
      { status: 500 }
    );
  }
}

function buildDisplayData(result: any) {
  const sizing = result.marketSizing.sizing;
  const influence = result.influence.influence;
  const gaps = result.gaps.analysis;

  // Extract SERP positions from rawGoogle
  const serpPositions = influence.rawGoogle?.serpPositions || [];

  // Extract Maps data from rawGoogle
  const mapsData = influence.rawGoogle?.mapsPresence || null;

  // Extract Instagram data from rawInstagram
  const igData = influence.rawInstagram || null;

  // Build terms with real SERP position
  const terms = result.terms.terms.slice(0, 10).map((t: any) => {
    const volumeMatch = result.volumes.termVolumes.find(
      (v: any) => v.term === t.term
    );
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

    influenceBreakdown: {
      google: influence.google?.score || 0,
      instagram: influence.instagram?.score || 0,
      web: influence.web?.available ? influence.web.score : null,
    },

    // NEW: Google Maps data
    maps: mapsData ? {
      found: mapsData.found || false,
      rating: mapsData.rating || null,
      reviewCount: mapsData.reviewCount || null,
      categories: mapsData.categories || [],
      inLocalPack: mapsData.inLocalPack || false,
      photos: mapsData.photos || 0,
    } : null,

    // NEW: Instagram data
    instagram: igData?.profile ? {
      handle: igData.profile.handle || "",
      followers: igData.profile.followers || 0,
      engagementRate: igData.profile.engagementRate || 0,
      postsLast30d: igData.profile.postsLast30d || 0,
      avgLikes: igData.profile.avgLikesLast30d || 0,
      avgViews: igData.profile.avgViewsReelsLast30d || 0,
      dataAvailable: igData.profile.dataAvailable || false,
    } : null,

    // NEW: Competitor Instagram data
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

    // NEW: SERP features summary
    serpSummary: {
      termsScraped: serpPositions.length,
      termsRanked: serpPositions.filter((sp: any) => sp.position && sp.position <= 10).length,
      hasLocalPack: serpPositions.some((sp: any) => sp.serpFeatures?.includes("local_pack")),
      hasAds: serpPositions.some((sp: any) => sp.serpFeatures?.includes("ads")),
    },

    termGeneration: {
      count: result.terms.termCount,
      model: result.terms.generationModel,
      promptVersion: result.terms.promptVersion,
    },
  };
}
