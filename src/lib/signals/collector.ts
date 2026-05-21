// ============================================================================
// Virô — Weekly Signals Collector
//
// Roda na 5ª antes do planner. Para cada lead assinante, monta um snapshot
// da semana com 3 dimensões:
//
//   • macro       — herdado de diagnoses.macro_context (já gerado no enrichment)
//   • competitors — comparação dos concorrentes atuais vs snapshot anterior
//   • own_business — comparação do score/IG/reviews atuais vs anterior
//
// Não dispara scrapes pesados aqui — usa o que está no DB. O re-scrape semanal
// já existe em /api/cron/weekly e pode rodar em paralelo (segunda 7am BRT).
// Quando ele atualiza diagnosis_display, o próximo collector já vê os deltas.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** ISO week label: "2026-W20" — chave única semanal por lead. */
export function isoWeekLabel(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface MacroSignal {
  summary: string;
  indicators: { name: string; value: string; impact: "positive" | "neutral" | "negative" }[];
  source: "diagnoses.macro_context";
}

interface CompetitorSignal {
  handle: string;
  signal: string;            // ex: "subiu 800 seg em 7d"
  delta_followers?: number;
  delta_posts?: number;
}

interface OwnBusinessSignal {
  score_current: number;
  score_delta: number | null;
  ig_followers_delta: number | null;
  ig_posts_delta: number | null;
  reviews_count_current: number | null;
  reviews_delta: number | null;
}

export interface WeeklySignalsBundle {
  weekIso: string;
  macro: MacroSignal | null;
  competitors: CompetitorSignal[];
  ownBusiness: OwnBusinessSignal | null;
  linkedPillars: string[];   // quais pilares esses sinais tocam
  hasMaterialSignal: boolean; // true se há algo digno de pautar a semana
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function pillarsTouchedByCompetitor(c: CompetitorSignal): string[] {
  // Heurística simples: concorrente movendo IG mexe com presença/conteúdo.
  // Em iterações futuras, mapear por blueprint.
  return ["pilar-2", "pilar-3"];
}

function pillarsTouchedByOwn(own: OwnBusinessSignal): string[] {
  const touched: string[] = [];
  if (own.reviews_delta && own.reviews_delta > 0) touched.push("pilar-2");
  if (own.ig_posts_delta && own.ig_posts_delta > 0) touched.push("pilar-3");
  if (own.score_delta && own.score_delta !== 0) touched.push("pilar-1");
  return touched;
}

// ─── Collector principal ────────────────────────────────────────────────

export async function collectWeeklySignals(leadId: string): Promise<WeeklySignalsBundle> {
  const sb = getSb();
  const weekIso = isoWeekLabel();

  // 1. Display atual + diagnosis (macro_context, etc.)
  const { data: lead } = await sb
    .from("leads")
    .select("id, diagnosis_display")
    .eq("id", leadId)
    .single();
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const display = (lead.diagnosis_display as any) || {};

  const { data: diagnosisRow } = await sb
    .from("diagnoses")
    .select("macro_context")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Última weekly_signals (pra calcular deltas)
  const { data: previousSignals } = await sb
    .from("weekly_signals")
    .select("week_iso, own_business, competitors")
    .eq("lead_id", leadId)
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevOwn = (previousSignals?.own_business as any) || null;
  const prevCompetitors = (previousSignals?.competitors as CompetitorSignal[]) || [];

  // 3. MACRO — herdado de diagnoses.macro_context
  const macroRaw = (diagnosisRow?.macro_context as any) || null;
  const macro: MacroSignal | null = macroRaw && macroRaw.summary
    ? {
        summary: String(macroRaw.summary).slice(0, 500),
        indicators: Array.isArray(macroRaw.indicators)
          ? macroRaw.indicators.slice(0, 4).map((i: any) => ({
              name: String(i.name || ""),
              value: String(i.value || ""),
              impact: ["positive", "neutral", "negative"].includes(i.impact) ? i.impact : "neutral",
            }))
          : [],
        source: "diagnoses.macro_context",
      }
    : null;

  // 4. CONCORRENTES — top 3 com posts/30d > 0, comparados com snapshot anterior
  const competitorIG = Array.isArray(display.competitorInstagram)
    ? display.competitorInstagram
    : [];
  const competitors: CompetitorSignal[] = competitorIG
    .filter((c: any) => c && c.handle)
    .slice(0, 3)
    .map((c: any): CompetitorSignal => {
      const prev = prevCompetitors.find((p) => p.handle === c.handle);
      const deltaFollowers = prev?.delta_followers != null
        ? (c.followers || 0) - ((c.followers || 0) - (prev.delta_followers || 0))
        : null;
      const deltaPosts = prev?.delta_posts != null
        ? (c.postsLast30d || 0) - ((c.postsLast30d || 0) - (prev.delta_posts || 0))
        : null;

      // Frase do sinal — prioriza movimentos significativos
      const parts: string[] = [];
      if (deltaFollowers && Math.abs(deltaFollowers) >= 100) {
        parts.push(`${deltaFollowers > 0 ? "+" : ""}${deltaFollowers} seguidores na semana`);
      }
      if (deltaPosts && Math.abs(deltaPosts) >= 2) {
        parts.push(`${deltaPosts > 0 ? "+" : ""}${deltaPosts} posts vs semana anterior`);
      }
      if (parts.length === 0) {
        parts.push(`${c.followers || 0} seg · ${c.postsLast30d || 0} posts/30d`);
      }

      return {
        handle: c.handle,
        signal: parts.join(" · "),
        delta_followers: deltaFollowers ?? undefined,
        delta_posts: deltaPosts ?? undefined,
      };
    });

  // 5. OWN BUSINESS — score, IG, reviews vs anterior
  const scoreCurrent = Number(display.influencePercent || 0);
  const igFollowersCurrent = Number(display.instagram?.followers || 0);
  const igPostsCurrent = Number(display.instagram?.postsLast30d || display.instagram?.recentPostsCount || 0);
  const reviewsCurrent = Number(display.maps?.reviewCount || 0);

  const ownBusiness: OwnBusinessSignal = {
    score_current: scoreCurrent,
    score_delta: prevOwn?.score_current != null ? scoreCurrent - prevOwn.score_current : null,
    ig_followers_delta: prevOwn?.ig_followers != null ? igFollowersCurrent - prevOwn.ig_followers : null,
    ig_posts_delta: prevOwn?.ig_posts != null ? igPostsCurrent - prevOwn.ig_posts : null,
    reviews_count_current: reviewsCurrent || null,
    reviews_delta: prevOwn?.reviews_count != null ? reviewsCurrent - prevOwn.reviews_count : null,
  };

  // 6. Pilares tocados pelos sinais
  const linkedPillars = Array.from(
    new Set<string>([
      ...competitors.flatMap(pillarsTouchedByCompetitor),
      ...pillarsTouchedByOwn(ownBusiness),
    ]),
  );

  // Material signal = algo mexeu o suficiente pra ser tema da semana
  const hasMaterialSignal =
    !!macro ||
    competitors.some((c) => (c.delta_followers && Math.abs(c.delta_followers) >= 100) || (c.delta_posts && Math.abs(c.delta_posts) >= 2)) ||
    !!(ownBusiness.score_delta && Math.abs(ownBusiness.score_delta) >= 3) ||
    !!(ownBusiness.reviews_delta && ownBusiness.reviews_delta >= 1);

  return {
    weekIso,
    macro,
    competitors,
    ownBusiness,
    linkedPillars,
    hasMaterialSignal,
  };
}

/** Persiste o bundle em weekly_signals. Idempotente: ON CONFLICT (lead_id, week_iso). */
export async function persistWeeklySignals(leadId: string, bundle: WeeklySignalsBundle): Promise<void> {
  const sb = getSb();
  // Salvamos snapshots brutos pra delta da semana que vem
  const ownPayload = bundle.ownBusiness
    ? {
        score_current: bundle.ownBusiness.score_current,
        ig_followers: 0,    // será sobrescrito abaixo se houver dado
        ig_posts: 0,
        reviews_count: bundle.ownBusiness.reviews_count_current ?? 0,
        score_delta: bundle.ownBusiness.score_delta,
        ig_followers_delta: bundle.ownBusiness.ig_followers_delta,
        ig_posts_delta: bundle.ownBusiness.ig_posts_delta,
        reviews_delta: bundle.ownBusiness.reviews_delta,
      }
    : null;

  // Recupera snapshot atual dos counters pra próxima comparação
  const { data: lead } = await sb
    .from("leads")
    .select("diagnosis_display")
    .eq("id", leadId)
    .single();
  const display = (lead?.diagnosis_display as any) || {};
  if (ownPayload) {
    ownPayload.ig_followers = Number(display.instagram?.followers || 0);
    ownPayload.ig_posts = Number(display.instagram?.postsLast30d || display.instagram?.recentPostsCount || 0);
  }

  const { error } = await sb
    .from("weekly_signals")
    .upsert(
      {
        lead_id: leadId,
        week_iso: bundle.weekIso,
        macro: bundle.macro as any,
        competitors: bundle.competitors as any,
        own_business: ownPayload as any,
        linked_pillars: bundle.linkedPillars,
        collected_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,week_iso" },
    );
  if (error) {
    console.error(`[SignalsCollector] persist falhou pra lead ${leadId}:`, error.message);
    throw error;
  }
}
