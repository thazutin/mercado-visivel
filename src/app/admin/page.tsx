// ============================================================================
// Virô — Admin Dashboard
// File: src/app/admin/page.tsx
// Protected by checking Clerk user ID against ADMIN_CLERK_USER_IDS env var
// ============================================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AdminClient from "./AdminClient";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function AdminPage() {
  const { userId } = await auth();
  const adminIds = (process.env.ADMIN_CLERK_USER_IDS || "").split(",").map(s => s.trim());

  if (!userId || !adminIds.includes(userId)) {
    redirect("/");
  }

  const supabase = getSupabase();

  // Fetch all leads
  const { data: leads } = await supabase
    .from("leads")
    .select("id, email, whatsapp, product, region, status, plan_status, created_at, paid_at, instagram, challenge, differentiator")
    .order("created_at", { ascending: false })
    .limit(200);

  // Fetch diagnoses count
  const { count: diagnosesCount } = await supabase
    .from("diagnoses")
    .select("*", { count: "exact", head: true });

  // Fetch pipeline runs for performance
  const { data: pipelineRuns } = await supabase
    .from("pipeline_runs")
    .select("total_duration_ms, confidence_level, sources_used, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Calculate funnel metrics
  const total = leads?.length || 0;
  const paid = leads?.filter(l => l.status === "paid").length || 0;
  const processing = leads?.filter(l => l.status === "processing").length || 0;
  const withPlan = leads?.filter(l => l.plan_status === "ready").length || 0;

  return (
    <AdminClient
      leads={leads || []}
      stats={{
        total,
        paid,
        processing,
        withPlan,
        diagnosesCount: diagnosesCount || 0,
        conversionRate: total > 0 ? ((paid / total) * 100).toFixed(1) : "0",
        avgPipelineMs: pipelineRuns?.length
          ? Math.round(pipelineRuns.reduce((s, r) => s + (r.total_duration_ms || 0), 0) / pipelineRuns.length)
          : 0,
      }}
      pipelineRuns={pipelineRuns || []}
    />
  );
}
