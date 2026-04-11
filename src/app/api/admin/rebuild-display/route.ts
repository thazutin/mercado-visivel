// POST /api/admin/rebuild-display
// Re-calcula buildDisplayData para todos os leads com score 0 ou para um leadId específico.
// NÃO re-roda o pipeline — usa raw_data existente. Útil pra corrigir bugs em buildDisplayData.
// Header: x-internal-secret

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDisplayData } from "@/lib/analysis";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { leadId } = body;
  const supabase = getSupabase();

  let diagnoses: any[];

  if (leadId) {
    // Rebuild single lead
    const { data } = await supabase
      .from("diagnoses")
      .select("id, lead_id, raw_data")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1);
    diagnoses = data || [];
  } else {
    // Rebuild all leads with score 0 or missing display
    const { data: leads } = await supabase
      .from("leads")
      .select("id, diagnosis_display")
      .eq("status", "done");

    const zeroScoreLeadIds = (leads || [])
      .filter((l: any) => {
        const dp = l.diagnosis_display;
        if (!dp) return true;
        if (dp.influencePercent === 0) return true;
        return false;
      })
      .map((l: any) => l.id);

    if (zeroScoreLeadIds.length === 0) {
      return NextResponse.json({ message: "No leads with score 0 found", rebuilt: 0 });
    }

    // Fetch diagnoses for those leads
    const { data } = await supabase
      .from("diagnoses")
      .select("id, lead_id, raw_data")
      .in("lead_id", zeroScoreLeadIds);
    diagnoses = data || [];
  }

  let rebuilt = 0;
  let errors = 0;
  const details: any[] = [];

  for (const diag of diagnoses) {
    try {
      if (!diag.raw_data) {
        details.push({ lead_id: diag.lead_id, error: "no raw_data" });
        errors++;
        continue;
      }

      const newDisplay = buildDisplayData(diag.raw_data);
      const oldScore = 0; // was 0, that's why we're here

      await supabase
        .from("leads")
        .update({
          diagnosis_display: newDisplay,
          status: "done",
        })
        .eq("id", diag.lead_id);

      rebuilt++;
      details.push({
        lead_id: diag.lead_id,
        old_score: oldScore,
        new_score: newDisplay.influencePercent,
        has_4d: !!newDisplay.influenceBreakdown4D,
      });

      console.log(
        `[RebuildDisplay] ${diag.lead_id}: score 0 → ${newDisplay.influencePercent}`,
      );
    } catch (err) {
      errors++;
      details.push({
        lead_id: diag.lead_id,
        error: (err as Error).message,
      });
    }
  }

  return NextResponse.json({
    rebuilt,
    errors,
    total: diagnoses.length,
    details,
  });
}
