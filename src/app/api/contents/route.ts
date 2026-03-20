// ============================================================================
// Virô — Contents API (list generated contents)
// GET /api/contents?leadId=X — lista conteúdos gerados para um lead
// File: src/app/api/contents/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();

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
