// ============================================================================
// Virô — Dashboard Page (post-payment)
// File: src/app/dashboard/[leadId]/page.tsx
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import RadarDashboard from "./RadarDashboard";

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
  let { data: checklist } = await supabase
    .from("checklists")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fallback: se não tem checklist, converte plan_tasks para formato de checklist
  if (!checklist) {
    const { data: planTasks } = await supabase
      .from("plan_tasks")
      .select("*")
      .eq("lead_id", leadId)
      .order("week", { ascending: true });

    if (planTasks && planTasks.length > 0) {
      checklist = {
        id: null,
        lead_id: leadId,
        generated_at: null,
        created_at: null,
        items: planTasks.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          completed: task.completed,
          channel: task.channel,
          week: task.week,
        })),
      };
    }
  }

  // Radar Dashboard para novos leads (com blueprint) ou todos os novos leads
  // DashboardClient legado só para leads antigos sem blueprint
  const useRadar = lead.blueprint_id || lead.growth_machine;

  if (useRadar) {
    return (
      <RadarDashboard
        lead={lead}
        diagnosis={diagnosis}
        tier={tier}
        initialGrowthMachine={lead.growth_machine || null}
      />
    );
  }

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
