// ============================================================================
// Virô — Dashboard Index Redirect
// /dashboard → redirects to /dashboard/[leadId] for the logged-in user
// ============================================================================
// File: src/app/dashboard/page.tsx

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLeadsForUser } from "@/lib/auth";

export default async function DashboardIndex() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect_url=/dashboard");
  }

  const leads = await getLeadsForUser(userId);

  if (leads.length === 0) {
    // No paid leads — redirect to homepage
    redirect("/");
  }

  // Redirect to most recent lead's dashboard
  redirect(`/dashboard/${leads[0]}`);
}
