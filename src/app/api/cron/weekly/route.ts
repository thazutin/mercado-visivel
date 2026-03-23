// DEPRECATED — substituído por /api/cron/weekly-contents em 2026-03-23
// ============================================================================
// Virô — Weekly Cron Job
// Runs every Monday at 7am BRT (10:00 UTC).
// For each active paid lead (week < 12): re-scrape → diff → briefing → email.
// ============================================================================
// File: src/app/api/cron/weekly/route.ts
//
// Vercel Cron config (add to vercel.json):
// {
//   "crons": [{
//     "path": "/api/cron/weekly",
//     "schedule": "0 10 * * 1"
//   }]
// }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { weeklyRescrape } from "@/lib/pipeline/weekly-rescrape";
import { calculateDiff } from "@/lib/pipeline/diff-engine";
import { generateBriefing, getTopActionForWeek } from "@/lib/pipeline/briefing-generator";
import { sendWeeklyEmail } from "@/lib/email/weekly-email";
import { sendWhatsAppReminder } from "@/lib/email/whatsapp-reminder";
import { notifyUpsell, notifyClosure } from "@/lib/notify";
import { trackEvent } from "@/lib/events";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  // ─── Verify cron secret (Vercel sends this header) ───
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const startTime = Date.now();

  console.log("[Cron] Weekly briefing job started");

  // ─── 1. Get all active leads (paid, within 12 weeks) ───
  const { data: activeLeads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("status", "paid")
    .lt("weeks_active", 12)
    .not("plan_status", "eq", "error");

  if (error) {
    console.error("[Cron] Failed to fetch active leads:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!activeLeads || activeLeads.length === 0) {
    console.log("[Cron] No active leads to process");
    return NextResponse.json({ ok: true, processed: 0 });
  }

  console.log(`[Cron] Processing ${activeLeads.length} active leads`);

  const results: { leadId: string; success: boolean; error?: string }[] = [];

  // ─── 2. Process each lead sequentially (to avoid rate limits) ───
  for (const lead of activeLeads) {
    try {
      await processLeadWeekly(supabase, lead);
      results.push({ leadId: lead.id, success: true });
    } catch (err) {
      const errorMsg = (err as Error).message || String(err);
      console.error(`[Cron] Failed for lead ${lead.id}:`, errorMsg);
      results.push({ leadId: lead.id, success: false, error: errorMsg });
    }

    // Small delay between leads to be kind to Apify rate limits
    await sleep(2000);
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const durationMs = Date.now() - startTime;

  console.log(
    `[Cron] Done in ${durationMs}ms | Processed: ${activeLeads.length} | Success: ${successful} | Failed: ${failed}`
  );

  return NextResponse.json({
    ok: true,
    processed: activeLeads.length,
    successful,
    failed,
    durationMs,
    results,
  });
}

// ─── PROCESS SINGLE LEAD ─────────────────────────────────────────────

async function processLeadWeekly(supabase: any, lead: any): Promise<void> {
  const nextWeek = (lead.weeks_active || 0) + 1;

  if (nextWeek > 12) {
    console.log(`[Cron] Lead ${lead.id} completed all 12 weeks, skipping`);
    return;
  }

  console.log(`[Cron] Processing lead ${lead.id} — week ${nextWeek}`);

  // ─── Load original diagnosis for terms + volumes ───
  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!diagnosis) {
    throw new Error("No diagnosis found");
  }

  const rawData = diagnosis.raw_data || {};
  const originalTerms = (rawData.terms?.terms || diagnosis.terms || []).map(
    (t: any) => t.term || t
  );
  const termVolumes = rawData.volumes?.termVolumes || [];

  // ─── Load previous snapshot ───
  const { data: previousSnapshot } = await supabase
    .from("snapshots")
    .select("*")
    .eq("lead_id", lead.id)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  // ─── Re-scrape ───
  const rescrapeResult = await weeklyRescrape({
    leadId: lead.id,
    product: lead.product,
    region: lead.region,
    instagram: lead.instagram || "",
    site: lead.site || "",
    competitors: lead.competitors || [],
    terms: originalTerms,
    termVolumes,
  });

  // ─── Save snapshot ───
  await supabase.from("snapshots").upsert(
    {
      lead_id: lead.id,
      week_number: nextWeek,
      data: rescrapeResult.rawData,
      sources_used: rescrapeResult.sourcesUsed,
      sources_unavailable: rescrapeResult.sourcesUnavailable,
      collection_duration_ms: rescrapeResult.durationMs,
    },
    { onConflict: "lead_id,week_number" }
  );

  // ─── Calculate diff ───
  const previousData = previousSnapshot?.data || rawData;
  const previousWeek = previousSnapshot?.week_number ?? 0;

  const diff = calculateDiff(
    rescrapeResult.rawData,
    previousData,
    nextWeek,
    previousWeek
  );

  // Save diff in snapshot
  await supabase
    .from("snapshots")
    .update({ diff_from_previous: diff })
    .eq("lead_id", lead.id)
    .eq("week_number", nextWeek);

  // ─── Get planned action for this week ───
  const { data: plan } = await supabase
    .from("plans")
    .select("content")
    .eq("lead_id", lead.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let plannedAction = null;
  if (plan?.content?.weeklyPlan && Array.isArray(plan.content.weeklyPlan)) {
    // weeklyPlan is a root-level array, indexed 0-11 for weeks 1-12
    plannedAction = plan.content.weeklyPlan[nextWeek - 1] || null;
  } else if (plan?.content?.weekly_plan && Array.isArray(plan.content.weekly_plan)) {
    // Fallback: snake_case variant
    plannedAction = plan.content.weekly_plan[nextWeek - 1] || null;
  }
  console.log(`[Cron] plannedAction semana ${nextWeek}:`, plannedAction ? `title="${plannedAction.title}", action="${(plannedAction.mainAction || plannedAction.action || '').slice(0, 80)}"` : 'null');

  // ─── Get top action for this week (Feature 2) ───
  let topTaskTitle: string | null = null;
  try {
    topTaskTitle = await getTopActionForWeek(lead.id);
    if (topTaskTitle) {
      console.log(`[Cron] Top action for lead ${lead.id} week ${nextWeek}: "${topTaskTitle}"`);
    }
  } catch (err) {
    console.warn(`[Cron] getTopActionForWeek failed for lead ${lead.id}:`, (err as Error).message);
  }

  // ─── Generate briefing ───
  const igProfile = rescrapeResult.rawData?.instagramProfile;

  const briefing = await generateBriefing({
    leadId: lead.id,
    weekNumber: nextWeek,
    product: lead.product,
    region: lead.region,
    diff,
    plannedAction,
    currentInfluence: rescrapeResult.influenceScore,
    currentFollowers: igProfile?.followers || 0,
    currentRating: rescrapeResult.mapsPresence?.rating || null,
    topTaskTitle,
  });

  // ─── Save briefing ───
  await supabase.from("briefings").upsert(
    {
      lead_id: lead.id,
      week_number: nextWeek,
      content: briefing,
      snapshot_id: null, // Could FK to snapshot if needed
      generation_model: briefing.meta.model,
      prompt_version: "v1",
    },
    { onConflict: "lead_id,week_number" }
  );

  // ─── Send email ───
  try {
    await sendWeeklyEmail({
      email: lead.email,
      leadId: lead.id,
      weekNumber: nextWeek,
      product: lead.product,
      region: lead.region,
      briefing,
      topTaskTitle,
    });

    // Mark email as sent
    await supabase
      .from("briefings")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("lead_id", lead.id)
      .eq("week_number", nextWeek);
  } catch (err) {
    console.error(`[Cron] Email failed for lead ${lead.id}:`, err);
    // Non-fatal — briefing is still saved and accessible on dashboard
  }

  // ─── Send WhatsApp reminder ───
  if (lead.whatsapp) {
    try {
      await sendWhatsAppReminder({
        to: lead.whatsapp,
        leadId: lead.id,
        weekNumber: nextWeek,
        product: lead.product,
        changesCount: diff.summary.totalChanges,
      });

      await supabase
        .from("briefings")
        .update({ whatsapp_sent_at: new Date().toISOString() })
        .eq("lead_id", lead.id)
        .eq("week_number", nextWeek);
    } catch (err) {
      console.error(`[Cron] WhatsApp failed for lead ${lead.id}:`, err);
    }
  }

  // ─── Update lead ───
  await supabase
    .from("leads")
    .update({
      weeks_active: nextWeek,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  // ─── Lifecycle emails (upsell week 8, closure week 10) ───
  if (nextWeek === 8 && !lead.upsell_email_sent) {
    try {
      await notifyUpsell({
        email: lead.email,
        name: lead.name || "",
        product: lead.product,
        leadId: lead.id,
      });
      await supabase.from("leads").update({ upsell_email_sent: true }).eq("id", lead.id);
      console.log(`[Cron] Upsell email sent for lead ${lead.id}`);
    } catch (err) {
      console.warn(`[Cron] Upsell email failed for lead ${lead.id}:`, (err as Error).message);
    }
  }

  if (nextWeek === 10 && !lead.closure_email_sent) {
    try {
      // Get initial and current scores
      const { data: initialSnapshot } = await supabase
        .from("snapshots")
        .select("data")
        .eq("lead_id", lead.id)
        .order("week_number", { ascending: true })
        .limit(1)
        .single();
      const scoreInicial = initialSnapshot?.data?.influenceScore ?? diagnosis.influence_percent ?? 0;
      const scoreAtual = rescrapeResult.influenceScore ?? scoreInicial;

      await notifyClosure({
        email: lead.email,
        name: lead.name || "",
        product: lead.product,
        leadId: lead.id,
        scoreInicial: Math.round(scoreInicial),
        scoreAtual: Math.round(scoreAtual),
      });
      await supabase.from("leads").update({ closure_email_sent: true }).eq("id", lead.id);
      console.log(`[Cron] Closure email sent for lead ${lead.id}`);
    } catch (err) {
      console.warn(`[Cron] Closure email failed for lead ${lead.id}:`, (err as Error).message);
    }
  }

  // ─── Track event ───
  await trackEvent({
    eventType: "briefing_viewed", // closest existing event type
    leadId: lead.id,
    metadata: {
      week_number: nextWeek,
      changes_count: diff.summary.totalChanges,
      influence: rescrapeResult.influenceScore,
    },
  });

  console.log(
    `[Cron] Lead ${lead.id} week ${nextWeek} complete | Changes: ${diff.summary.totalChanges} | Influence: ${rescrapeResult.influenceScore}%`
  );
}

// ─── UTILS ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
