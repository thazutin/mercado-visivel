// ============================================================================
// Virô — Admin Dashboard (Server)
// Protected by Clerk. Shows funnel, leads, feedback, audit.
// ============================================================================
// File: src/app/admin/page.tsx

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AdminClient from "./AdminClient";

// Add admin Clerk user IDs here
const ADMIN_USER_IDS = (process.env.ADMIN_CLERK_USER_IDS || "").split(",").filter(Boolean);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function AdminPage() {
  const { userId } = await auth();

  if (!userId || (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(userId))) {
    redirect("/");
  }

  const supabase = getSupabase();

  // ─── Load funnel data (last 30 days) ───
  const { data: funnelData } = await supabase
    .from("events")
    .select("event_type, created_at")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  // ─── Load active leads ───
  const { data: leads } = await supabase
    .from("leads")
    .select("id, email, product, region, status, plan_status, weeks_active, created_at, paid_at, instagram")
    .order("created_at", { ascending: false })
    .limit(100);

  // ─── Load feedback summary ───
  const { data: feedback } = await supabase
    .from("feedback")
    .select("trigger_point, rating, rating_type, comment, created_at, lead_id")
    .order("created_at", { ascending: false })
    .limit(200);

  // ─── Load diagnoses for audit ───
  const { data: diagnoses } = await supabase
    .from("diagnoses")
    .select("id, lead_id, confidence_level, source, total_volume, influence_percent, market_low, market_high, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // ─── Load plans ───
  const { data: plans } = await supabase
    .from("plans")
    .select("id, lead_id, status, plan_version, view_count, generated_at")
    .order("generated_at", { ascending: false })
    .limit(50);

  // ─── Compute funnel counts ───
  const funnelCounts: Record<string, number> = {};
  for (const event of funnelData || []) {
    funnelCounts[event.event_type] = (funnelCounts[event.event_type] || 0) + 1;
  }

  return (
    <AdminClient
      funnelCounts={funnelCounts}
      leads={leads || []}
      feedback={feedback || []}
      diagnoses={diagnoses || []}
      plans={plans || []}
    />
  );
}
