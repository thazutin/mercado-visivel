// ============================================================================
// Proxy para Google Places Autocomplete — evita expor API key no frontend
// GET /api/places-autocomplete?input=texto&sessiontoken=xxx
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input");
  const sessiontoken = req.nextUrl.searchParams.get("sessiontoken") || "";

  if (!input || input.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
  if (!key) {
    console.error("[Places Proxy] Nenhuma key configurada: GOOGLE_PLACES_API_KEY e NEXT_PUBLIC_GOOGLE_PLACES_KEY ausentes");
    return NextResponse.json({ predictions: [], error: "API key not configured" });
  }

  try {
    const params = new URLSearchParams({
      input,
      key,
      components: "country:br",
      language: "pt-BR",
      ...(sessiontoken ? { sessiontoken } : {}),
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      console.error("[Places Proxy] Google API error:", res.status);
      return NextResponse.json({ predictions: [] });
    }

    const data = await res.json();
    console.log(`[Places Proxy] Google status="${data.status}", predictions=${data.predictions?.length ?? 0}, input="${input}"`);

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(`[Places Proxy] Google error: status="${data.status}", error_message="${data.error_message || 'none'}"`);
    }

    // Retorna apenas o necessário (description + place_id)
    const predictions = (data.predictions || []).slice(0, 5).map((p: any) => ({
      description: p.description,
      place_id: p.place_id,
    }));

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error("[Places Proxy] Error:", err);
    return NextResponse.json({ predictions: [] });
  }
}
