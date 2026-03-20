// ============================================================================
// Virô — Content Generation API (manual trigger from dashboard)
// POST /api/contents/generate — gera conteúdos para redes sociais via Claude
// File: src/app/api/contents/generate/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { triggerContentGeneration } from "@/lib/generateContents";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { leadId } = body;

  if (!leadId) {
    return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });
  }

  try {
    await triggerContentGeneration(leadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contents/generate] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao gerar conteúdos" },
      { status: 500 }
    );
  }
}
