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
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const supabase = getSupabase();

  // Try JSONB format first (single row with items array)
  const { data: single } = await supabase
    .from("checklists")
    .select("items")
    .eq("lead_id", leadId)
    .single();

  if (single?.items && Array.isArray(single.items)) {
    return NextResponse.json({ items: single.items });
  }

  // Fallback: multiple rows (legacy format)
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("lead_id", leadId)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function PATCH(req: NextRequest) {
  const { id, completed, leadId } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getSupabase();

  // Try JSONB format first
  if (leadId) {
    const { data: single } = await supabase
      .from("checklists")
      .select("items")
      .eq("lead_id", leadId)
      .single();

    if (single?.items && Array.isArray(single.items)) {
      const updated = single.items.map((item: any) =>
        String(item.id) === String(id) ? { ...item, concluida: completed } : item
      );
      const { error } = await supabase
        .from("checklists")
        .update({ items: updated })
        .eq("lead_id", leadId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
  }

  // Fallback: legacy row-per-item
  const { error } = await supabase
    .from("checklists")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
