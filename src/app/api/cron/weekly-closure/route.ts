// ============================================================================
// /api/cron/weekly-closure — QUI 17h UTC (14h BRT)
//
// Pra cada ciclo da semana atual ainda não fechado:
//   • status='engaged' OR 'checked' → manda template de fechamento,
//     marca status='closed' + closed_at
//   • status='opened' (user nunca respondeu) → status='abandoned'
//
// Roda ANTES do weekly-planner que vem em seguida (17h vs 18h UTC).
// Deixa o ciclo da semana corrente fechado pra que o planner já trabalhe
// com outcome quando montar o tema da próxima.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, getSb, firstName } from "@/lib/conversation/cron-helpers";
import { sendWeeklyClosure } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getSb();
  const t0 = Date.now();

  // Ciclos abertos nos últimos 8 dias (margem extra vs checkpoint pra cobrir
  // cycles que abriram no fim da janela esperada). Não filtra por week_iso
  // porque cycles cruzam fronteiras de semana ISO (abrem SEX, fecham QUI seguinte).
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cycles, error } = await sb
    .from("weekly_cycles")
    .select("id, lead_id, week_iso, theme_short, status, opened_at, leads(id, name, whatsapp, whatsapp_optin, whatsapp_optout_at, subscription_status)")
    .in("status", ["opened", "engaged", "checked"])
    .gte("opened_at", eightDaysAgo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(`[Cron:Closure] ${cycles?.length || 0} cycles abertos pra fechar`);
  const results = { closed: 0, abandoned: 0, skipped: 0, failed: 0 };

  for (const cycle of cycles || []) {
    const lead = (cycle.leads as any) || null;
    if (!lead) {
      results.skipped++;
      continue;
    }

    try {
      // Status='opened' sem engajamento = abandono. Não manda fechamento.
      if (cycle.status === "opened") {
        await sb
          .from("weekly_cycles")
          .update({ status: "abandoned", closed_at: new Date().toISOString() })
          .eq("id", cycle.id);
        // Fecha conversation associada (defensivo — janela 24h já passou)
        await sb
          .from("conversations")
          .update({ status: "closed" })
          .eq("weekly_cycle_id", cycle.id)
          .eq("status", "active");
        results.abandoned++;
        continue;
      }

      // Engaged/checked: manda template de fechamento (se Meta aprovou
      // e env var setada). User respondeu = janela 24h aberta (ou
      // template aprovado serve fora de janela).
      if (lead.whatsapp_optin && !lead.whatsapp_optout_at && lead.subscription_status === "active") {
        const sent = await sendWeeklyClosure({
          whatsapp: lead.whatsapp,
          firstName: firstName(lead.name),
          themeShort: cycle.theme_short as string,
        });
        if (!sent) {
          // Template não setado — só fecha sem mensagem
          console.warn(`[Cron:Closure] template missing, fechando cycle ${cycle.id} silenciosamente`);
        }
      }

      await sb
        .from("weekly_cycles")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", cycle.id);

      // BUG 2 fix: também fecha a conversation associada pra que o opening
      // da próxima semana crie uma nova clean e o getOrCreateActiveConversation
      // não pegue uma stale.
      await sb
        .from("conversations")
        .update({ status: "closed" })
        .eq("weekly_cycle_id", cycle.id)
        .eq("status", "active");

      results.closed++;
    } catch (err) {
      console.error(`[Cron:Closure] cycle ${cycle.id} falhou:`, (err as Error).message);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, durationMs: Date.now() - t0, ...results });
}
