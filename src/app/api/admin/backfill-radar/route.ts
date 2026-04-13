// POST /api/admin/backfill-radar
// Migra pagantes legados pro RadarDashboard:
// 1. Classifica blueprint
// 2. Gera growth machine
// 3. Dá 3 meses de assinatura grátis (subscription_status=active)
// Header: x-internal-secret

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyBusiness } from "@/lib/blueprints";
import { generateGrowthMachine } from "@/lib/growth-machine";

export const maxDuration = 300;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const excludeEmail = body.excludeEmail || '';
  const grantMonths = body.grantMonths || 3;

  const supabase = getSupabase();

  // Find paid leads without blueprint (legado)
  let query = supabase
    .from("leads")
    .select("*")
    .is("blueprint_id", null)
    .not("stripe_session_id", "is", null);

  if (excludeEmail) {
    query = query.neq("email", excludeEmail);
  }

  const { data: leads, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ message: "No leads to backfill", count: 0 });
  }

  const results: any[] = [];
  const subscriptionEnd = new Date();
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + grantMonths);

  for (const lead of leads) {
    try {
      // 1. Classify blueprint
      const classification = await classifyBusiness({
        businessName: lead.name || lead.product,
        product: lead.product,
        clientType: lead.client_type || 'b2c',
        region: lead.region,
        instagram: lead.instagram,
        site: lead.site,
      });
      const blueprintId = classification.blueprint.id;

      // 2. Generate growth machine
      const diagnosis = lead.diagnosis_display;
      if (!diagnosis) {
        results.push({ id: lead.id, name: lead.name, error: "no diagnosis_display" });
        continue;
      }

      // Get raw_data for deeper context
      const { data: diagRecord } = await supabase
        .from("diagnoses")
        .select("raw_data")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const gm = await generateGrowthMachine({
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

      // 3. Update lead: blueprint + growth machine + subscription
      await supabase
        .from("leads")
        .update({
          blueprint_id: blueprintId,
          growth_machine: gm,
          subscription_status: "active",
          subscription_started_at: new Date().toISOString(),
          // briefing_end_date marca até quando a assinatura é válida
          briefing_end_date: subscriptionEnd.toISOString(),
        })
        .eq("id", lead.id);

      results.push({
        id: lead.id,
        name: lead.name || lead.product,
        email: lead.email,
        blueprint: blueprintId,
        quickWins: gm.quickWins?.length,
        pillars: gm.strategicPillars?.length,
        grantedUntil: subscriptionEnd.toISOString(),
        status: "migrated",
      });

      console.log(`[Backfill] ${lead.name || lead.product} → ${blueprintId} ✅`);

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      results.push({
        id: lead.id,
        name: lead.name || lead.product,
        error: (err as Error).message,
      });
      console.error(`[Backfill] ${lead.name} failed:`, (err as Error).message);
    }
  }

  const migrated = results.filter(r => r.status === "migrated").length;
  const failed = results.filter(r => r.error).length;

  return NextResponse.json({
    total: leads.length,
    migrated,
    failed,
    grantedUntil: subscriptionEnd.toISOString(),
    results,
  });
}
