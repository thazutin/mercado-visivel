// ============================================================================
// Virô — Dashboard Page (post-payment)
// File: src/app/dashboard/[leadId]/page.tsx
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

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

  if (!lead || lead.status !== "paid") {
    redirect("/?error=not_found");
  }

  // Load plan
  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("lead_id", leadId)
    .single();

  // Load briefings
  const { data: briefings } = await supabase
    .from("briefings")
    .select("*")
    .eq("lead_id", leadId)
    .order("week_number", { ascending: true });

  // Load diagnosis for summary data
  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <DashboardClient
      lead={lead}
      plan={plan}
      briefings={briefings || []}
      diagnosis={diagnosis}
    />
  );
}
