// ============================================================================
// Virô — Lifecycle Emails Cron
// Runs daily at 9am UTC (6am BRT).
// Handles: reengagement free (7d), churn prevention (14d), trial expiring (7d before end).
// Welcome email is sent inline at checkout, not here.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  notifyFreeReengagement,
  notifyChurnPrevention,
  notifyTrialExpiring,
} from "@/lib/notify";

export const maxDuration = 120;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();
  const results = { reengagement: 0, churn: 0, trial: 0, errors: 0 };

  // ─── 1. Reengajamento free: diagnóstico há 7 dias, não pagou ─────────
  try {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    const { data: freeLeads } = await supabase
      .from("leads")
      .select("id, name, email, product, diagnosis_display, reengagement_email_sent_at")
      .eq("status", "done")
      .is("stripe_session_id", null)
      .is("reengagement_email_sent_at", null)
      .lt("created_at", sevenDaysAgo.toISOString())
      .gt("created_at", eightDaysAgo.toISOString());

    for (const lead of freeLeads || []) {
      if (!lead.email) continue;
      try {
        const score = lead.diagnosis_display?.influencePercent || 0;
        const topAction = lead.diagnosis_display?.workRoutes?.[0]?.title || '';
        await notifyFreeReengagement({
          email: lead.email,
          name: lead.name || lead.product || '',
          product: lead.product || '',
          leadId: lead.id,
          score,
          topAction,
        });
        await supabase.from("leads").update({
          reengagement_email_sent_at: now.toISOString(),
        }).eq("id", lead.id);
        results.reengagement++;
      } catch { results.errors++; }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.error("[Lifecycle] Reengagement error:", e);
  }

  // ─── 2. Churn prevention: assinante, 14+ dias sem acesso, nunca enviou OU enviou há 60+ dias ──
  try {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const { data: churnLeads } = await supabase
      .from("leads")
      .select("id, name, email, product, last_active_at, churn_email_sent_at")
      .eq("subscription_status", "active");

    for (const lead of churnLeads || []) {
      if (!lead.email) continue;
      const lastActive = lead.last_active_at ? new Date(lead.last_active_at) : null;
      if (!lastActive || lastActive > fourteenDaysAgo) continue; // Active recently

      // Não repete: só envia se nunca enviou OU se o último envio foi há 60+ dias
      if (lead.churn_email_sent_at) {
        const lastSent = new Date(lead.churn_email_sent_at);
        if (lastSent > sixtyDaysAgo) continue; // Enviou recentemente, pula
      }

      const daysSince = Math.floor((now.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000));
      try {
        await notifyChurnPrevention({
          email: lead.email,
          name: lead.name || lead.product || '',
          product: lead.product || '',
          leadId: lead.id,
          daysSinceLastAccess: daysSince,
        });
        await supabase.from("leads").update({
          churn_email_sent_at: now.toISOString(),
        }).eq("id", lead.id);
        results.churn++;
      } catch { results.errors++; }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.error("[Lifecycle] Churn error:", e);
  }

  // ─── 3. Trial expirando: briefing_end_date em 7 dias, não enviou ainda ──
  try {
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sixDaysFromNow = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const { data: trialLeads } = await supabase
      .from("leads")
      .select("id, name, email, product, briefing_end_date, trial_expiry_email_sent")
      .eq("subscription_status", "active")
      .not("briefing_end_date", "is", null);

    for (const lead of trialLeads || []) {
      if (!lead.email || lead.trial_expiry_email_sent) continue;
      const endDate = new Date(lead.briefing_end_date);
      // Envia se expira em 6-8 dias
      if (endDate > sevenDaysFromNow || endDate < sixDaysFromNow) continue;

      try {
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        await notifyTrialExpiring({
          email: lead.email,
          name: lead.name || lead.product || '',
          product: lead.product || '',
          leadId: lead.id,
          daysRemaining,
        });
        await supabase.from("leads").update({
          trial_expiry_email_sent: true,
        }).eq("id", lead.id);
        results.trial++;
      } catch { results.errors++; }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.error("[Lifecycle] Trial error:", e);
  }

  console.log(`[Lifecycle] Done: reengagement=${results.reengagement}, churn=${results.churn}, trial=${results.trial}, errors=${results.errors}`);
  return NextResponse.json(results);
}
