// ============================================================================
// POST /api/competitors/validate
// Salva concorrentes validados pelo usuário no lead.
// Se pipeline já terminou, dispara re-enrichment com concorrentes corretos.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { runInstantAnalysis, buildDisplayData } from "@/lib/analysis";

export const maxDuration = 180;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Re-enrichment: re-roda pipeline com concorrentes validados e atualiza display
async function reEnrichWithValidatedCompetitors(leadId: string) {
  const supabase = getSupabaseAdmin();

  try {
    // Busca lead completo pra reconstruir formData
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (!lead) return;

    const formData = {
      businessName: lead.name || "",
      product: lead.product || "",
      region: lead.region || "",
      email: lead.email || "",
      whatsapp: lead.whatsapp || "",
      site: lead.site || "",
      instagram: lead.instagram || "",
      linkedin: lead.linkedin || "",
      customerDescription: lead.customer_description || "",
      channels: lead.channels || [],
      ticket: lead.ticket || "",
      differentiator: lead.differentiator || "",
      challenge: lead.challenge || "",
      freeText: lead.free_text || "",
      address: lead.address || "",
      placeId: lead.place_id || "",
      lat: lead.lat || null,
      lng: lead.lng || null,
      locale: lead.locale || "pt",
      coupon: lead.coupon || "",
      clientType: lead.client_type || "b2c",
      salesChannel: lead.sales_channel || "",
      mercadoLivreUrl: lead.mercado_livre_url || "",
      ifoodUrl: lead.ifood_url || "",
      // Usa concorrentes validados em vez dos originais
      competitors: (lead.validated_competitors || []).map((c: any) => ({
        name: c.name,
        instagram: c.instagram || "",
      })),
    };

    console.log(
      `[ReEnrich] Re-running pipeline for lead ${leadId} with ${formData.competitors.length} validated competitors`,
    );

    const pipelineResult = await Promise.race([
      runInstantAnalysis(formData as any, formData.locale),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ReEnrich timeout: 150s")), 150_000),
      ),
    ]);

    const display = buildDisplayData(pipelineResult);
    display.lat = lead.lat || null;
    display.lng = lead.lng || null;
    display.enrichmentStatus = "complete";
    display.enrichmentPending = [];
    display._reEnrichedWith = "validated_competitors";

    await supabase
      .from("leads")
      .update({ diagnosis_display: display })
      .eq("id", leadId);

    console.log(`[ReEnrich] Completed for lead ${leadId}`);
  } catch (err) {
    console.error(`[ReEnrich] Failed for lead ${leadId}:`, err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, competitors } = body;

    if (!leadId || !Array.isArray(competitors)) {
      return NextResponse.json(
        { error: "leadId and competitors[] required" },
        { status: 400 },
      );
    }

    // Sanitize — max 10 concorrentes, campos validados
    const validated = competitors.slice(0, 10).map((c: any) => ({
      name: String(c.name || "").trim().slice(0, 200),
      website: c.website ? String(c.website).trim().slice(0, 500) : null,
      instagram: c.instagram ? String(c.instagram).trim().slice(0, 100) : null,
      rating: typeof c.rating === "number" ? c.rating : null,
      reviewCount: typeof c.reviewCount === "number" ? c.reviewCount : null,
    }));

    const supabase = getSupabaseAdmin();

    // 1. Salva concorrentes validados no lead
    const { data: lead, error } = await supabase
      .from("leads")
      .update({ validated_competitors: validated })
      .eq("id", leadId)
      .select("status")
      .single();

    if (error) {
      console.error("[CompetitorValidate] Update error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    console.log(
      `[CompetitorValidate] Saved ${validated.length} competitors for lead ${leadId} (status: ${lead?.status})`,
    );

    // 2. Se pipeline já terminou, dispara re-enrichment em background
    if (lead?.status === "done") {
      console.log(
        `[CompetitorValidate] Pipeline already done — triggering re-enrichment`,
      );
      waitUntil(reEnrichWithValidatedCompetitors(leadId));
    }
    // Se status=processing, o pipeline vai consultar validated_competitors
    // quando terminar (via runPipelineBackground)

    return NextResponse.json({
      saved: validated.length,
      willReEnrich: lead?.status === "done",
    });
  } catch (err) {
    console.error("[CompetitorValidate] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
