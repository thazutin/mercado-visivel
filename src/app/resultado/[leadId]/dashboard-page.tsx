// ============================================================================
// Virô — Dashboard Page
// /dashboard/[leadId] — Protected by Clerk. Shows 5-block diagnosis.
// ============================================================================
// File: src/app/dashboard/[leadId]/page.tsx

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import DashboardClient from "./DashboardClient";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface Props {
  params: Promise<{ leadId: string }>;
}

export default async function DashboardPage({ params }: Props) {
  const { leadId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/dashboard/${leadId}`);
  }

  const supabase = getSupabase();

  // ─── Load lead ───
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (!lead) {
    redirect("/");
  }

  // Verify ownership: clerk_user_id must match or email must match
  if (lead.clerk_user_id && lead.clerk_user_id !== userId) {
    // Check email fallback
    const { data: clerkUser } = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      }
    ).then((r) => r.json()).catch(() => ({ data: null }));

    const clerkEmail = clerkUser?.email_addresses?.[0]?.email_address;
    if (clerkEmail !== lead.email) {
      redirect("/");
    }
  }

  // ─── Load plan ───
  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // ─── Load diagnosis (for instant value data) ───
  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // ─── Load briefings ───
  const { data: briefings } = await supabase
    .from("briefings")
    .select("*")
    .eq("lead_id", leadId)
    .order("week_number", { ascending: true });

  // ─── Update view count ───
  if (plan) {
    await supabase
      .from("plans")
      .update({
        last_viewed_at: new Date().toISOString(),
        view_count: (plan.view_count || 0) + 1,
      })
      .eq("id", plan.id);
  }

  return (
    <DashboardClient
      lead={lead}
      plan={plan}
      diagnosis={diagnosis}
      briefings={briefings || []}
    />
  );
}
