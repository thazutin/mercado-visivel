// ============================================================================
// Virô — Feedback Page (NPS + comentários)
// Acessado via link no email de closure (semana 10)
// File: src/app/feedback/[leadId]/page.tsx
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import FeedbackClient from "./FeedbackClient";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function FeedbackPage({ params }: { params: { leadId: string } }) {
  const { leadId } = params;
  const supabase = getSupabase();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, product, region, feedback_score, feedback_text")
    .eq("id", leadId)
    .single();

  if (!lead) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F4F7" }}>
        <p style={{ fontSize: 15, color: "#6E6E78" }}>Link inválido.</p>
      </div>
    );
  }

  const alreadySubmitted = lead.feedback_score !== null && lead.feedback_score !== undefined;

  return (
    <FeedbackClient
      leadId={leadId}
      product={lead.product}
      alreadySubmitted={alreadySubmitted}
    />
  );
}
