// ============================================================================
// Virô — Dashboard Index (redirect — leadId required)
// File: src/app/dashboard/page.tsx
// ============================================================================

import { redirect } from "next/navigation";

export default async function DashboardIndex() {
  // Dashboard requires leadId in the URL — /dashboard/[leadId]
  // Without a leadId, redirect to homepage
  redirect("/?error=no_plan");
}
