// GET /api/checklist/[leadId] — retorna checklist mais recente do lead

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const { leadId } = params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json(data);
}
