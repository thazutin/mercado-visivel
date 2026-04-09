// POST /api/reviews/generate { leadId }
// Dispara geração de drafts pras reviews pendentes. Usado pelo botão
// "Gerar respostas" no item de reviews do plano de ação.

import { NextRequest, NextResponse } from "next/server";
import { generateReviewResponses } from "@/lib/generateReviewResponses";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }
    const result = await generateReviewResponses(leadId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/reviews/generate] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
