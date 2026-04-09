// GET  /api/reviews?leadId=X           — lista todas as review_responses do lead
// PATCH /api/reviews { id, status }    — marca como copied|dismissed

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("review_responses")
    .select("*")
    .eq("lead_id", leadId)
    .order("review_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data || [] });
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !["copied", "dismissed", "pending"].includes(status)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const update: any = { status };
    if (status === "copied") update.copied_at = new Date().toISOString();
    const { error } = await supabase.from("review_responses").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
