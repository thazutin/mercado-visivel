// ============================================================================
// /api/cron/weekly-planner — QUI 18h UTC (15h BRT)
//
// Para cada lead elegível:
//   1. Coleta sinais da semana → weekly_signals
//   2. Pede Opus pra decidir tema → insere weekly_cycles status='planned'
//
// Roda DEPOIS do weekly-closure (que fecha o ciclo anterior).
// Roda ANTES do weekly-opening de sexta (que dispara o template).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, getEligibleLeads } from "@/lib/conversation/cron-helpers";
import { collectWeeklySignals, persistWeeklySignals } from "@/lib/signals/collector";
import { planNextCycle, persistPlannedCycle, isoWeekLabel } from "@/lib/conversation/cycle-planner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const t0 = Date.now();
  const leads = await getEligibleLeads();
  const weekIso = isoWeekLabel();
  console.log(`[Cron:Planner] ${leads.length} leads elegíveis, week=${weekIso}`);

  const results = { planned: 0, skipped: 0, failed: 0, withMaterialSignal: 0 };

  for (const lead of leads) {
    try {
      // 1. Sinais
      const signals = await collectWeeklySignals(lead.id);
      await persistWeeklySignals(lead.id, signals);
      if (signals.hasMaterialSignal) results.withMaterialSignal++;

      // 2. Planner
      const plan = await planNextCycle({ leadId: lead.id, signals });
      if (!plan) {
        console.warn(`[Cron:Planner] sem plan pra lead ${lead.id}`);
        results.skipped++;
        continue;
      }
      const cycleId = await persistPlannedCycle(lead.id, weekIso, plan);
      if (cycleId) {
        results.planned++;
        console.log(`[Cron:Planner] cycle ${cycleId} planned pra lead ${lead.id} (${plan.theme_short}, pilar=${plan.linked_pillar_id}, step=${plan.evolution_step})`);
      } else {
        results.failed++;
      }
    } catch (err) {
      console.error(`[Cron:Planner] lead ${lead.id} falhou:`, (err as Error).message);
      results.failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    weekIso,
    leadsProcessed: leads.length,
    durationMs: Date.now() - t0,
    ...results,
  });
}
