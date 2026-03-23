// ============================================================================
// Virô — Dashboard Page (post-payment)
// File: src/app/dashboard/[leadId]/page.tsx
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function DashboardPage({ params }: { params: { leadId: string } }) {
  const { leadId } = params;
  const supabase = getSupabase();

  // Load lead
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (!lead) {
    redirect("/?error=not_found");
  }

  // Determine tier
  const tier: "free" | "paid" | "subscriber" =
    lead.subscription_status === "active"
      ? "subscriber"
      : lead.paid_at
        ? "paid"
        : "free";

  // Load plan
  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("lead_id", leadId)
    .single();

  // Load diagnosis for summary data
  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Load checklist
  const { data: checklist } = await supabase
    .from("checklists")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <DashboardClient
      lead={lead}
      plan={plan}
      diagnosis={diagnosis}
      tier={tier}
      checklist={checklist || null}
    />
  );
}
