// ============================================================================
// Virô — Dashboard Index (redirect to lead-specific page)
// File: src/app/dashboard/page.tsx
// ============================================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default async function DashboardIndex() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Find lead by clerk_user_id
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("clerk_user_id", userId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lead) {
    redirect(`/dashboard/${lead.id}`);
  }

  // No paid lead found
  redirect("/?error=no_plan");
}
