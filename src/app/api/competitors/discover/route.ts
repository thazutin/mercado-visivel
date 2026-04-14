// ============================================================================
// GET /api/competitors/discover?leadId=X
// Busca rápida de concorrentes candidatos via Google Places Text Search.
// Roda em <10s, retorna candidatos pro PollingScreen exibir pro usuário validar.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 15;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Normaliza nome pra comparação fuzzy
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Busca dados do lead
  const { data: lead } = await supabase
    .from("leads")
    .select("product, region, name, lat, lng, site")
    .eq("id", leadId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ candidates: [], source: "unavailable" });
  }

  try {
    // 2. Google Places Text Search — busca concorrentes por produto + região
    const locationBias =
      lead.lat && lead.lng
        ? {
            circle: {
              center: { latitude: lead.lat, longitude: lead.lng },
              radius: 10000, // 10km radius
            },
          }
        : undefined;

    const searchRes = await Promise.race([
      fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.rating,places.userRatingCount,places.types,places.photos,places.websiteUri,places.location",
        },
        body: JSON.stringify({
          textQuery: `${lead.product} ${(lead.region || '').split(',')[0].trim()}`,
          languageCode: "pt-BR",
          maxResultCount: 15,
          ...(locationBias ? { locationBias } : {}),
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Places API timeout")), 9000),
      ),
    ]);

    if (!searchRes.ok) {
      console.error("[CompetitorDiscover] Places API error:", searchRes.status);
      return NextResponse.json({ candidates: [], source: "error" });
    }

    const data = await searchRes.json();
    const places = data.places || [];

    // 3. Filtra o próprio negócio (por nome fuzzy ou site)
    const leadNameNorm = normalizeName(lead.name || lead.product);
    const leadSite = (lead.site || "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .toLowerCase();

    const candidates = places
      .filter((p: any) => {
        const placeName = normalizeName(p.displayName?.text || "");
        const placeWebsite = (p.websiteUri || "")
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0]
          .toLowerCase();

        // Skip se é o próprio negócio
        if (placeName === leadNameNorm) return false;
        if (leadSite && placeWebsite && placeWebsite === leadSite) return false;
        // Skip se nome muito similar (substring match)
        if (leadNameNorm.length > 3 && placeName.includes(leadNameNorm)) return false;
        if (placeName.length > 3 && leadNameNorm.includes(placeName)) return false;

        return true;
      })
      .slice(0, 10)
      .map((p: any) => ({
        name: p.displayName?.text || "",
        rating: p.rating || null,
        reviewCount: p.userRatingCount || null,
        photoCount: p.photos?.length || 0,
        website: p.websiteUri || null,
        categories: (p.types || []).slice(0, 3),
        lat: p.location?.latitude || null,
        lng: p.location?.longitude || null,
      }));

    console.log(
      `[CompetitorDiscover] Found ${candidates.length} candidates for "${lead.product}" in "${lead.region}"`,
    );

    return NextResponse.json({
      candidates,
      source: "google_places",
      query: `${lead.product} ${lead.region}`,
    });
  } catch (err) {
    console.error("[CompetitorDiscover] Error:", err);
    return NextResponse.json({ candidates: [], source: "error" });
  }
}
