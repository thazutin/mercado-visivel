// PATCH /api/checklist/[leadId]/items/[itemId] — toggle item status

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { leadId: string; itemId: string } }
) {
  const { leadId, itemId } = params;
  const body = await req.json();
  const newStatus = body.status;

  if (!newStatus || !["pending", "done"].includes(newStatus)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Busca checklist mais recente do lead
  const { data: checklist, error: fetchError } = await supabase
    .from("checklists")
    .select("id, items")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !checklist) {
    return NextResponse.json({ error: "Checklist não encontrado" }, { status: 404 });
  }

  // Atualiza o item no array jsonb
  const items = (checklist.items as any[]) || [];
  const itemIndex = items.findIndex((i: any) => i.id === itemId);

  if (itemIndex === -1) {
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }

  items[itemIndex] = { ...items[itemIndex], status: newStatus };

  const { error: updateError } = await supabase
    .from("checklists")
    .update({ items })
    .eq("id", checklist.id);

  if (updateError) {
    console.error("[checklist] Erro ao atualizar:", updateError);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
