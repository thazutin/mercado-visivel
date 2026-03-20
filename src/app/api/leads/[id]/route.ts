// ============================================================================
// Virô — Lead API (single lead fetch)
// GET /api/leads/:id — retorna dados do lead para o dashboard
// File: src/app/api/leads/[id]/route.ts
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = params;
  const supabase = getSupabase();

  // Busca lead vinculado ao clerk_user_id
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("clerk_user_id", userId)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  return NextResponse.json(lead);
}
