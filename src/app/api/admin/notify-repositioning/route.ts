// POST /api/admin/notify-repositioning
// Envia email de reposicionamento pra todos os leads com diagnóstico pronto.
// Header: x-internal-secret
// Body: { excludeEmail?: string, dryRun?: boolean }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyRepositioning } from "@/lib/notify";

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
  const dryRun = body.dryRun === true;

  const supabase = getSupabase();

  // All leads with done diagnosis (both free and paid)
  let query = supabase
    .from("leads")
    .select("id, name, email, product, region, stripe_session_id, status")
    .eq("status", "done");

  if (excludeEmail) {
    query = query.neq("email", excludeEmail);
  }

  const { data: leads, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads || leads.length === 0) {
    return NextResponse.json({ message: "No leads to notify", count: 0 });
  }

  // Deduplicate by email (keep most recent)
  const byEmail = new Map<string, any>();
  for (const lead of leads) {
    if (!lead.email) continue;
    const existing = byEmail.get(lead.email);
    if (!existing || lead.stripe_session_id) {
      byEmail.set(lead.email, lead);
    }
  }

  const uniqueLeads = Array.from(byEmail.values());

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalLeads: leads.length,
      uniqueEmails: uniqueLeads.length,
      paid: uniqueLeads.filter(l => l.stripe_session_id).length,
      free: uniqueLeads.filter(l => !l.stripe_session_id).length,
      preview: uniqueLeads.slice(0, 5).map(l => ({
        email: l.email,
        name: l.name,
        isPaid: !!l.stripe_session_id,
      })),
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const lead of uniqueLeads) {
    try {
      await notifyRepositioning({
        email: lead.email,
        name: lead.name || lead.product || '',
        product: lead.product || '',
        leadId: lead.id,
        isPaid: !!lead.stripe_session_id,
      });
      sent++;
      console.log(`[Repositioning] Sent to ${lead.email} (${lead.stripe_session_id ? 'paid' : 'free'})`);
      // Rate limit: 2/second
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      failed++;
      errors.push({ email: lead.email, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    sent,
    failed,
    total: uniqueLeads.length,
    errors: errors.slice(0, 10),
  });
}
