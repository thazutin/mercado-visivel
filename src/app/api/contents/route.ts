// ============================================================================
// Virô — Contents API (list generated contents)
// GET /api/contents?leadId=X — lista conteúdos gerados para um lead
// File: src/app/api/contents/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Verifica se o lead pertence ao usuário
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("clerk_user_id", userId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const { data: contents, error } = await supabase
    .from("generated_contents")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[contents] Erro ao buscar:", error);
    return NextResponse.json({ error: "Erro ao buscar conteúdos" }, { status: 500 });
  }

  return NextResponse.json({ contents: contents || [] });
}
