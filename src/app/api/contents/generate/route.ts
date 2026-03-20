// ============================================================================
// Virô — Content Generation API (manual trigger from dashboard)
// POST /api/contents/generate — gera conteúdos para redes sociais via Claude
// File: src/app/api/contents/generate/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { triggerContentGeneration } from "@/lib/generateContents";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { leadId } = body;

  if (!leadId) {
    return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Verifica se o lead pertence ao usuário
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, clerk_user_id")
    .eq("id", leadId)
    .eq("clerk_user_id", userId)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
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
