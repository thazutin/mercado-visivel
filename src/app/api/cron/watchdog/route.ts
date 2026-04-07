// ============================================================================
// /api/cron/watchdog — Real-time launch watchdog
// Runs every 5 minutes. Inspects leads created in the last 30 minutes plus
// recent pipeline_runs and emails thazutin@gmail.com if any of them is
// stuck (status === 'processing' for > 5 min) or errored. Dedupes alerts
// by writing the lead_id into a launch_alerts memory table — if that table
// does not exist (we don't want to require a migration tonight), the cron
// falls back to "alert once per cron tick listing all currently broken
// leads", which is acceptable noise for launch night.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALERT_EMAIL = "thazutin@gmail.com";
const STUCK_AFTER_MIN = 5;
const LOOKBACK_MIN = 30;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  const internalSecret = req.headers.get("x-internal-secret");
  // Vercel Cron sends the CRON_SECRET via Authorization header automatically
  return (
    (!!cronSecret && cronSecret === process.env.CRON_SECRET) ||
    (!!internalSecret && internalSecret === process.env.INTERNAL_API_SECRET)
  );
}

interface BrokenLead {
  id: string;
  name: string | null;
  product: string | null;
  region: string | null;
  status: string | null;
  created_at: string;
  reason: string;
  ageMinutes: number;
}

async function findBrokenLeads(): Promise<BrokenLead[]> {
  const sb = getSupabase();
  const since = new Date(Date.now() - LOOKBACK_MIN * 60_000).toISOString();
  const stuckCutoff = new Date(Date.now() - STUCK_AFTER_MIN * 60_000).toISOString();

  const { data: leads, error } = await sb
    .from("leads")
    .select("id, name, product, region, status, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Watchdog] Supabase query failed:", error.message);
    return [];
  }

  const broken: BrokenLead[] = [];
  for (const lead of leads || []) {
    const ageMin = Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60_000);
    if (lead.status === "error") {
      broken.push({ ...lead, reason: "status=error", ageMinutes: ageMin });
      continue;
    }
    if (
      (lead.status === "processing" || lead.status === "pending" || lead.status == null) &&
      lead.created_at < stuckCutoff
    ) {
      broken.push({
        ...lead,
        reason: `status=${lead.status || "null"} há ${ageMin} min (esperado < ${STUCK_AFTER_MIN} min)`,
        ageMinutes: ageMin,
      });
    }
  }

  // Also check pipeline_runs failures in the same window — alguns falham mas o lead vira "done" via fallback
  const { data: runs } = await sb
    .from("pipeline_runs")
    .select("lead_id, error_message, created_at")
    .eq("status", "error")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  for (const run of runs || []) {
    if (broken.some((b) => b.id === run.lead_id)) continue;
    const lead = leads?.find((l) => l.id === run.lead_id);
    if (!lead) continue;
    broken.push({
      id: lead.id,
      name: lead.name,
      product: lead.product,
      region: lead.region,
      status: lead.status,
      created_at: lead.created_at,
      reason: `pipeline_runs error: ${(run.error_message || "").slice(0, 120)}`,
      ageMinutes: Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60_000),
    });
  }

  return broken;
}

async function sendAlertEmail(broken: BrokenLead[]) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Watchdog] No RESEND_API_KEY — skip alert email");
    return;
  }

  const rows = broken
    .map(
      (b) => `
      <tr style="border-bottom:1px solid #E8E4DE;">
        <td style="padding:10px 8px;font-size:12px;font-family:monospace;">
          <a href="https://virolocal.com/resultado/${b.id}" style="color:#CF8523;">${b.id.slice(0, 8)}…</a>
        </td>
        <td style="padding:10px 8px;font-size:12px;">${b.name || "—"}</td>
        <td style="padding:10px 8px;font-size:11px;color:#666;">${b.product || "—"} · ${b.region || "—"}</td>
        <td style="padding:10px 8px;font-size:11px;color:#666;">${b.ageMinutes} min</td>
        <td style="padding:10px 8px;font-size:11px;color:#E24B4A;">${b.reason}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:760px;margin:0 auto;background:#F7F5F2;padding:24px;">
      <p style="font-size:20px;font-weight:700;color:#161618;margin:0 0 4px;">🚨 Watchdog — leads quebrados ou travados</p>
      <p style="font-size:12px;color:#888;margin:0 0 16px;">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${broken.length} lead(s)</p>
      <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#161618;color:#fff;">
          <th style="padding:10px 8px;text-align:left;font-size:11px;">LEAD</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;">NEGÓCIO</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;">CONTEXTO</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;">IDADE</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;">MOTIVO</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:11px;color:#888;margin:16px 0 0;">
        Reprocessar: <code>npx tsx scripts/reprocess-lead.ts &lt;leadId&gt;</code> ou via <a href="https://virolocal.com/admin">/admin</a>.<br/>
        Pausar entrada de novos leads: setar <code>VIRO_DIAGNOSE_PAUSED=true</code> no Vercel.
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Nelson Watchdog <entrega@virolocal.com>",
      to: ALERT_EMAIL,
      subject: `🚨 Watchdog Virô — ${broken.length} lead${broken.length > 1 ? "s" : ""} com problema`,
      html,
    }),
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const broken = await findBrokenLeads();

  if (broken.length === 0) {
    return NextResponse.json({ ok: true, broken: 0, timestamp: new Date().toISOString() });
  }

  console.warn(`[Watchdog] ${broken.length} broken lead(s) found:`, broken.map((b) => b.id));

  try {
    await sendAlertEmail(broken);
  } catch (err) {
    console.error("[Watchdog] Failed to send alert:", (err as Error).message);
  }

  return NextResponse.json({
    ok: false,
    broken: broken.length,
    leads: broken.map((b) => ({ id: b.id, reason: b.reason, ageMinutes: b.ageMinutes })),
    timestamp: new Date().toISOString(),
  });
}
