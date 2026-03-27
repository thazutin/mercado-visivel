// ============================================================================
// Virô — Weekly Contents Cron Job
// Runs every Friday at 8am UTC (5am BRT).
// For each active subscriber: generate new contents → notify by email.
// ============================================================================
// File: src/app/api/cron/weekly-contents/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { triggerContentGenerationWithContext } from "@/lib/generateContents";
import { notifyWeeklyContents } from "@/lib/notify";
import { generateRelatorioSetorial } from "@/lib/pipeline/relatorio-setorial";

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

  console.log("[Cron/Contents] Weekly contents job started");

  // ─── 1. Get all active subscribers ───
  const { data: subscribers, error } = await supabase
    .from("leads")
    .select("id, email, name, product, region, client_type")
    .eq("subscription_status", "active");

  if (error) {
    console.error("[Cron/Contents] Failed to fetch subscribers:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    console.log("[Cron/Contents] No active subscribers to process");
    return NextResponse.json({ ok: true, processed: 0, failed: 0 });
  }

  console.log(`[Cron/Contents] Processing ${subscribers.length} active subscribers`);

  let processed = 0;
  let failed = 0;
  const errors: { leadId: string; error: string }[] = [];

  // ─── 2. Process each lead sequentially ───
  for (const lead of subscribers) {
    try {
      // 1. Gerar relatório setorial da semana
      let relatorioSetorial = null;
      try {
        console.log(`[Cron/Contents] Gerando relatório setorial para lead ${lead.id}...`);
        relatorioSetorial = await generateRelatorioSetorial(
          lead.product || '',
          lead.region || '',
          lead.client_type || 'b2c',
        );
        console.log(`[Cron/Contents] Relatório setorial OK: "${relatorioSetorial?.destaque?.slice(0, 60)}"`);

        // Salvar relatório setorial no plano (atualiza semanalmente)
        const supabase = getSupabase();
        const { data: existingPlan } = await supabase
          .from("plans")
          .select("id, content")
          .eq("lead_id", lead.id)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingPlan) {
          await supabase
            .from("plans")
            .update({
              content: {
                ...existingPlan.content,
                relatorioSetorial,
                relatorioSetorialUpdatedAt: new Date().toISOString(),
              }
            })
            .eq("id", existingPlan.id);
          console.log(`[Cron/Contents] Relatório setorial salvo no plano ${existingPlan.id}`);
        }
      } catch (err) {
        console.error(`[Cron/Contents] Relatório setorial falhou (non-fatal):`, (err as Error).message);
      }

      // 2. Gerar conteúdos com contexto setorial
      await triggerContentGenerationWithContext(lead.id, relatorioSetorial);
      console.log(`[Cron/Contents] Contents generated for lead ${lead.id}`);

      // 3. Notificar
      await notifyWeeklyContents({
        leadId: lead.id,
        email: lead.email,
        name: lead.name || '',
      });
      console.log(`[Cron/Contents] Email sent to ${lead.email}`);

      processed++;
    } catch (err) {
      const errorMsg = (err as Error).message || String(err);
      console.error(`[Cron/Contents] Failed for lead ${lead.id}:`, errorMsg);
      errors.push({ leadId: lead.id, error: errorMsg });
      failed++;
    }

    // Small delay between leads to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const durationMs = Date.now() - startTime;

  console.log(
    `[Cron/Contents] Done in ${durationMs}ms | Processed: ${processed} | Failed: ${failed}`
  );

  return NextResponse.json({ processed, failed, errors, durationMs });
}
