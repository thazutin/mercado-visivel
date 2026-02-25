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

    // 1. Save lead to Supabase
    let lead;
    try {
      lead = await insertLead({
        email: formData.email,
        site: formData.site || "",
        instagram: formData.instagram || "",
        other_social: "",
        google_maps: "",
        product: formData.product,
        region: formData.region,
        ticket: formData.ticket || "",
        channels: formData.channels || [],
        differentiator: formData.differentiator || "",
        competitors: formData.competitors || [],
        challenge: formData.challenge || "",
        status: "processing",
      });
    } catch (dbError) {
      console.error("[DB] Failed to insert lead:", dbError);
      // Continue with analysis even if DB fails
      lead = { id: "temp_" + Date.now() };
    }

    // 2. Run instant analysis
    const analysis = await runInstantAnalysis(formData.product, formData.region);

    // 3. Save diagnosis results
    try {
      await insertDiagnosis({
        lead_id: lead.id,
        terms: analysis.terms,
        total_volume: analysis.total_volume,
        avg_cpc: analysis.avg_cpc,
        market_low: analysis.market_low,
        market_high: analysis.market_high,
        influence_percent: analysis.influence_percent,
        source: analysis.source,
        confidence: analysis.confidence,
      });
    } catch (dbError) {
      console.error("[DB] Failed to insert diagnosis:", dbError);
    }

    // 4. Return results
    return NextResponse.json({
      lead_id: lead.id,
      results: {
        terms: analysis.terms,
        totalVolume: analysis.total_volume,
        avgCpc: analysis.avg_cpc,
        marketLow: analysis.market_low,
        marketHigh: analysis.market_high,
        influencePercent: analysis.influence_percent,
        source: analysis.source,
        confidence: analysis.confidence,
        enrichment: analysis.enrichment,
      },
    });
  } catch (err) {
    console.error("[API] Diagnose error:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar análise" },
      { status: 500 }
    );
  }
}
