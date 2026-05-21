// ============================================================================
// /api/cron/weekly-opening — SEX 08h UTC (5h BRT) — alvo: 5h-9h BRT
//
// Dispara o template Meta `viro_abertura_semanal` pros ciclos status='planned'
// da semana atual. Atualiza status='opened' + opened_at.
//
// Pré-requisito: template aprovado pela Meta + WA_TEMPLATE_ABERTURA_SEMANAL
// setada no Vercel (vem do ContentSid Twilio).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, getSb, firstName } from "@/lib/conversation/cron-helpers";
import { isoWeekLabel } from "@/lib/signals/collector";
import { sendWeeklyOpening } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getSb();
  const weekIso = isoWeekLabel();
  const t0 = Date.now();

  // Junta ciclos planned com info do lead
  const { data: cycles, error } = await sb
    .from("weekly_cycles")
    .select("id, lead_id, theme_short, leads(id, name, whatsapp, whatsapp_optin, whatsapp_optout_at, subscription_status)")
    .eq("week_iso", weekIso)
    .eq("status", "planned");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(`[Cron:Opening] ${cycles?.length || 0} cycles planned pra ${weekIso}`);
  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const cycle of cycles || []) {
    const lead = (cycle.leads as any) || null;
    if (!lead || !lead.whatsapp_optin || lead.whatsapp_optout_at || lead.subscription_status !== "active") {
      console.warn(`[Cron:Opening] cycle ${cycle.id} skip: lead inelegível`);
      results.skipped++;
      continue;
    }
    try {
      const sent = await sendWeeklyOpening({
        whatsapp: lead.whatsapp,
        firstName: firstName(lead.name),
        themeShort: cycle.theme_short as string,
      });
      if (!sent) {
        results.skipped++;
        continue;
      }

      // Atualiza ciclo + cria conversation pré-associada (loop conversacional
      // vai usá-la quando o user responder).
      await sb
        .from("weekly_cycles")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("id", cycle.id);

      // BUG 3 fix: fecha qualquer conversation 'active' antiga deste lead
      // ANTES de criar a nova. Sem isso, se o closure anterior tiver falhado,
      // getOrCreateActiveConversation no loop pode pegar a conversation stale
      // do ciclo passado e atrelar mensagens novas a ele.
      await sb
        .from("conversations")
        .update({ status: "closed" })
        .eq("lead_id", cycle.lead_id)
        .eq("status", "active");

      const META_WINDOW_MS = 24 * 60 * 60 * 1000;
      await sb
        .from("conversations")
        .insert({
          lead_id: cycle.lead_id,
          weekly_cycle_id: cycle.id,
          channel: "whatsapp",
          status: "active",
          // Janela Meta começa quando o user responder; aqui só inicializa
          meta_window_expires_at: new Date(Date.now() + META_WINDOW_MS).toISOString(),
        });

      results.sent++;
    } catch (err) {
      console.error(`[Cron:Opening] cycle ${cycle.id} falhou:`, (err as Error).message);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, weekIso, durationMs: Date.now() - t0, ...results });
}
