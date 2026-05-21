// ============================================================================
// /api/cron/weekly-checkpoint — TER 13h UTC (10h BRT)
//
// Pra ciclos status in ('opened', 'engaged') da semana atual, dispara o
// template Meta `viro_checkpoint_semanal`. Atualiza checked_at.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, getSb, firstName } from "@/lib/conversation/cron-helpers";
import { sendWeeklyCheckpoint } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getSb();
  const t0 = Date.now();

  // Pega ciclos ativos abertos nos últimos 7 dias.
  // IMPORTANTE: NÃO filtramos por week_iso aqui — o ciclo aberto na sexta da
  // semana N continua "vivo" até a quinta da semana N+1, cruzando a fronteira
  // da semana ISO. Filtrar por status + opened_at é mais robusto.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cycles, error } = await sb
    .from("weekly_cycles")
    .select("id, lead_id, week_iso, theme_short, status, opened_at, leads(id, name, whatsapp, whatsapp_optin, whatsapp_optout_at, subscription_status)")
    .in("status", ["opened", "engaged"])
    .gte("opened_at", sevenDaysAgo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(`[Cron:Checkpoint] ${cycles?.length || 0} cycles ativos (opened nos últimos 7d)`);
  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const cycle of cycles || []) {
    const lead = (cycle.leads as any) || null;
    if (!lead || !lead.whatsapp_optin || lead.whatsapp_optout_at || lead.subscription_status !== "active") {
      results.skipped++;
      continue;
    }
    try {
      const sent = await sendWeeklyCheckpoint({
        whatsapp: lead.whatsapp,
        firstName: firstName(lead.name),
        themeShort: cycle.theme_short as string,
      });
      if (!sent) {
        results.skipped++;
        continue;
      }
      await sb
        .from("weekly_cycles")
        .update({ checked_at: new Date().toISOString() })
        .eq("id", cycle.id);
      results.sent++;
    } catch (err) {
      console.error(`[Cron:Checkpoint] cycle ${cycle.id} falhou:`, (err as Error).message);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, durationMs: Date.now() - t0, ...results });
}
