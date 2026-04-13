// ============================================================================
// GET  /api/growth-machine?leadId=X — retorna máquina de crescimento salva
// POST /api/growth-machine { leadId } — gera/regenera máquina de crescimento
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateGrowthMachine } from "@/lib/growth-machine";
import { classifyBusiness } from "@/lib/blueprints";

export const maxDuration = 120;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const supabase = getSupabase();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, product, region, instagram, site, client_type, blueprint_id, diagnosis_display, growth_machine")
    .eq("id", leadId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.growth_machine) {
    return NextResponse.json({ status: "ready", data: lead.growth_machine });
  }

  return NextResponse.json({ status: "not_generated" });
}

export async function POST(req: NextRequest) {
  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const supabase = getSupabase();

  // Load lead + diagnosis
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const diagnosis = lead.diagnosis_display;
  if (!diagnosis) return NextResponse.json({ error: "Diagnosis not ready" }, { status: 400 });

  // Get raw_data for deeper context
  const { data: diagRecord } = await supabase
    .from("diagnoses")
    .select("raw_data")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Classify if not done yet
  let blueprintId = lead.blueprint_id;
  if (!blueprintId) {
    const classification = await classifyBusiness({
      businessName: lead.name || lead.product,
      product: lead.product,
      clientType: lead.client_type || 'b2c',
      region: lead.region,
      instagram: lead.instagram,
      site: lead.site,
    });
    blueprintId = classification.blueprint.id;
    // Save blueprint_id
    await supabase.from("leads").update({ blueprint_id: blueprintId }).eq("id", leadId);
  }

  try {
    const result = await generateGrowthMachine({
      lead: {
        id: lead.id,
        name: lead.name || lead.product,
        product: lead.product,
        region: lead.region,
        instagram: lead.instagram,
        site: lead.site,
        client_type: lead.client_type,
        challenge: lead.challenge,
        ticket: lead.ticket,
      },
      diagnosis,
      blueprintId,
      rawData: diagRecord?.raw_data,
    });

    // Save to leads table
    await supabase
      .from("leads")
      .update({ growth_machine: result })
      .eq("id", leadId);

    return NextResponse.json({ status: "ready", data: result });
  } catch (err) {
    console.error("[GrowthMachine API]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
