/**
 * scripts/backfill-paid-optin.ts
 *
 * Roda uma vez pra convidar todos os paid/subscriber existentes a aceitar
 * a cadência conversacional do WhatsApp via email com link único (HMAC token).
 *
 * O que faz:
 *   1. Lê todos leads com (paid_at IS NOT NULL OR subscription_status='active')
 *      AND (whatsapp_optin = false OR whatsapp_optin IS NULL)
 *      AND email não é null
 *   2. Pra cada um, gera token HMAC e envia notifyReoptInInvite
 *   3. Log do que foi enviado/pulado
 *
 * Uso:
 *   npx tsx scripts/backfill-paid-optin.ts             # dry-run (lista sem enviar)
 *   npx tsx scripts/backfill-paid-optin.ts --send      # envia de verdade
 *   npx tsx scripts/backfill-paid-optin.ts --send --limit 5   # envia só 5 (teste)
 *
 * Pré-requisitos:
 *   • .env.local com SUPABASE/SERVICE_ROLE + RESEND + OPTOUT_SECRET
 *   • Schema v3 aplicado (whatsapp_optin column existe)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { buildOptinToken } from "../src/app/api/optin/route";
import { notifyReoptInInvite } from "../src/lib/notify";

interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  product: string;
  whatsapp: string | null;
  whatsapp_optin: boolean | null;
  paid_at: string | null;
  subscription_status: string | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    send: args.includes("--send"),
    limit: (() => {
      const idx = args.indexOf("--limit");
      if (idx >= 0 && args[idx + 1]) return parseInt(args[idx + 1], 10) || 0;
      return 0;
    })(),
  };
}

async function main() {
  const { send, limit } = parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE env vars missing");

  const sb = createClient(url, key);

  // Paid (one-time) OR subscriber ativo, sem opt-in ainda
  const { data, error } = await sb
    .from("leads")
    .select("id, name, email, product, whatsapp, whatsapp_optin, paid_at, subscription_status")
    .or("paid_at.not.is.null,subscription_status.eq.active")
    .or("whatsapp_optin.is.null,whatsapp_optin.eq.false")
    .not("email", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Query falhou:", error.message);
    process.exit(1);
  }

  const leads = (data as unknown as LeadRow[]) || [];
  const eligible = leads.filter((l) => l.email && l.email.includes("@"));
  const target = limit > 0 ? eligible.slice(0, limit) : eligible;

  console.log("─".repeat(70));
  console.log(`Backfill paid → opt-in`);
  console.log(`Total elegível: ${eligible.length}  ·  alvo desta rodada: ${target.length}  ·  modo: ${send ? "ENVIANDO" : "DRY-RUN"}`);
  console.log("─".repeat(70));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of target) {
    const hasWa = !!lead.whatsapp && lead.whatsapp.replace(/\D/g, "").length >= 10;
    const tag = lead.subscription_status === "active" ? "subscriber" : "paid";
    const waTag = hasWa ? "wa✓" : "wa✗";
    const line = `${tag.padEnd(10)} ${waTag}  ${lead.email!.padEnd(40)}  ${(lead.name || lead.product).slice(0, 30)}`;

    if (!send) {
      console.log(`[DRY] ${line}`);
      continue;
    }

    try {
      const token = buildOptinToken(lead.id);
      await notifyReoptInInvite({
        email: lead.email!,
        name: lead.name || "",
        product: lead.product,
        leadId: lead.id,
        optinToken: token,
      });
      sent++;
      console.log(`[OK ] ${line}`);
      // Throttle leve pra não estourar rate-limit Resend
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      failed++;
      console.error(`[ERR] ${line}  ${(err as Error).message}`);
    }
  }

  console.log("─".repeat(70));
  console.log(`Resumo: enviado=${sent} · falhou=${failed} · pulado=${skipped}`);
  console.log("─".repeat(70));
}

main().catch((err) => {
  console.error("Backfill falhou:", err);
  process.exit(1);
});
