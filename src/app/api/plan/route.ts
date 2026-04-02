// GET /api/plan?leadId=X — retorna plano mais recente do lead
// Usado pelo DashboardClient para refetch in-place sem page reload

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
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: plan, error } = await supabase
      .from("plans")
      .select("*")
      .eq("lead_id", leadId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !plan) {
      return NextResponse.json(null);
    }

    return NextResponse.json(plan);
  } catch (err) {
    console.error("[Plan GET] Error:", err);
    return NextResponse.json(null);
  }
}
