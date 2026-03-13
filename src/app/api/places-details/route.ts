// ============================================================================
// Proxy para Google Place Details — obtém lat/lng de um place_id
// GET /api/places-details?place_id=xxx&sessiontoken=xxx
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("place_id");
  const sessiontoken = req.nextUrl.searchParams.get("sessiontoken") || "";

  if (!placeId) {
    return NextResponse.json({ error: "place_id required" }, { status: 400 });
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key,
      fields: "formatted_address,geometry,place_id",
      ...(sessiontoken ? { sessiontoken } : {}),
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      console.error("[Places Details] Google API error:", res.status);
      return NextResponse.json({ error: "Google API error" }, { status: 502 });
    }

    const data = await res.json();
    const result = data.result;

    if (!result) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json({
      address: result.formatted_address || "",
      placeId: result.place_id || placeId,
      lat: result.geometry?.location?.lat || 0,
      lng: result.geometry?.location?.lng || 0,
    });
  } catch (err) {
    console.error("[Places Details] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
