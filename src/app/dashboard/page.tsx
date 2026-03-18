// ============================================================================
// Virô — Dashboard Index (redirect to lead-specific page)
// File: src/app/dashboard/page.tsx
// ============================================================================

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default async function DashboardIndex() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Try by clerk_user_id first, then fallback to email
  const { data: lead } = await supabase
    .from("leads")
    .select("id, clerk_user_id")
    .eq("clerk_user_id", userId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lead) {
    redirect(`/dashboard/${lead.id}`);
  }

  // Fallback: find by email and link clerk_user_id
  if (email) {
    const { data: leadByEmail } = await supabase
      .from("leads")
      .select("id")
      .eq("email", email)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (leadByEmail) {
      await supabase
        .from("leads")
        .update({ clerk_user_id: userId })
        .eq("id", leadByEmail.id);

      redirect(`/dashboard/${leadByEmail.id}`);
    }
  }

  // No paid lead found
  redirect("/?error=no_plan");
}
