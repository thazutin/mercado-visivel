// GET /api/contents?leadId=X — lista conteúdos (latest week)
// GET /api/contents?leadId=X&week=14 — conteúdos de semana específica
// GET /api/contents?leadId=X&all=true — todas as semanas (para histórico)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();
  const weekParam = req.nextUrl.searchParams.get("week");
  const allParam = req.nextUrl.searchParams.get("all");

  // All weeks — for history selector
  if (allParam === "true") {
    const { data, error } = await supabase
      .from("generated_contents")
      .select("*")
      .eq("lead_id", leadId)
      .order("week_number", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: "Erro ao buscar" }, { status: 500 });

    // Group by week
    const byWeek: Record<number, any[]> = {};
    for (const c of (data || [])) {
      const wk = c.week_number || 0;
      if (!byWeek[wk]) byWeek[wk] = [];
      byWeek[wk].push(c);
    }
    const weeks = Object.keys(byWeek).map(Number).sort((a, b) => b - a);

    return NextResponse.json({ contents: data || [], weeks, byWeek });
  }

  // Specific week
  if (weekParam) {
    const { data, error } = await supabase
      .from("generated_contents")
      .select("*")
      .eq("lead_id", leadId)
      .eq("week_number", parseInt(weekParam))
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: "Erro ao buscar" }, { status: 500 });
    return NextResponse.json({ contents: data || [] });
  }

  // Latest week (default)
  const { data, error } = await supabase
    .from("generated_contents")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Erro ao buscar" }, { status: 500 });
  return NextResponse.json({ contents: data || [] });
}
