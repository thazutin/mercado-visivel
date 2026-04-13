// GET /api/admin/test-bigquery?city=Campinas&uf=SP — testa Anatel BigQuery end-to-end
import { NextRequest, NextResponse } from "next/server";
import { fetchAnatelBandaLarga } from "@/lib/pipeline/anatel";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const city = req.nextUrl.searchParams.get("city") || "Campinas";
  const uf = req.nextUrl.searchParams.get("uf") || "SP";

  const t0 = Date.now();
  try {
    const result = await fetchAnatelBandaLarga(city, uf);
    const elapsed = Date.now() - t0;
    return NextResponse.json({
      ok: true,
      elapsed_ms: elapsed,
      result,
      env: {
        projectId: !!process.env.GOOGLE_BIGQUERY_PROJECT_ID,
        serviceKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      elapsed_ms: Date.now() - t0,
      error: (err as Error).message,
      stack: (err as Error).stack?.split('\n').slice(0, 5),
    });
  }
}
