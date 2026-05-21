// ============================================================================
// Virô — Helpers compartilhados pelos crons de cadência
// Autenticação + query de leads elegíveis pra cadência semanal.
// ============================================================================

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isoWeekLabel } from "@/lib/signals/collector";

export function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // sem secret = dev local OK
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

export function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface EligibleLead {
  id: string;
  name: string | null;
  whatsapp: string;
  cadence_preference: string | null;
  cadence_paused_until: string | null;
}

/**
 * Devolve leads elegíveis pra cadência conversacional desta semana:
 *   • subscription_status = 'active'
 *   • whatsapp_optin = true AND whatsapp_optout_at IS NULL
 *   • cadence_paused_until <= now() OR null
 *   • cadence_preference compatível com a semana atual
 *     (weekly = todas; biweekly = ISO week par; monthly = primeira semana do mês)
 */
export async function getEligibleLeads(): Promise<EligibleLead[]> {
  const sb = getSb();
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("leads")
    .select("id, name, whatsapp, cadence_preference, cadence_paused_until, subscription_status, whatsapp_optin, whatsapp_optout_at")
    .eq("subscription_status", "active")
    .eq("whatsapp_optin", true)
    .is("whatsapp_optout_at", null);
  if (error) throw error;

  const week = isoWeekLabel();
  const weekNumber = parseInt(week.split("W")[1] || "1", 10);
  const today = new Date();
  const firstWeekOfMonth = today.getDate() <= 7;

  return (data || [])
    .filter((l: any) => !l.cadence_paused_until || l.cadence_paused_until <= nowIso)
    .filter((l: any) => {
      const pref = l.cadence_preference || "weekly";
      if (pref === "weekly") return true;
      if (pref === "biweekly") return weekNumber % 2 === 0;
      if (pref === "monthly") return firstWeekOfMonth;
      return true;
    })
    .filter((l: any) => !!l.whatsapp)
    .map((l: any) => ({
      id: l.id,
      name: l.name,
      whatsapp: l.whatsapp,
      cadence_preference: l.cadence_preference,
      cadence_paused_until: l.cadence_paused_until,
    }));
}

export function firstName(name: string | null): string {
  if (!name) return "Olá";
  return name.split(" ")[0] || "Olá";
}
