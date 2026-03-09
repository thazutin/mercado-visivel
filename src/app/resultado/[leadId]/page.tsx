// File: src/app/resultado/[leadId]/page.tsx

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import ResultadoClient from "./ResultadoClient";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function ResultadoPage({ params }: { params: { leadId: string } }) {
  const { leadId } = params;
  const supabase = getSupabase();

  const { data: lead } = await supabase
    .from("leads").select("id, product, region, email, status").eq("id", leadId).single();

  if (!lead) redirect("/?error=not_found");

  const { data: diagnosis } = await supabase
    .from("diagnoses").select("*").eq("lead_id", leadId)
    .order("created_at", { ascending: false }).limit(1).single();

  if (!diagnosis) redirect("/?error=no_diagnosis");

  const raw = diagnosis.raw_data || {};
  const display = buildDisplay(raw);

  return <ResultadoClient product={lead!.product} region={lead!.region} leadId={leadId} results={display} isPaid={lead!.status === "paid"} />;
}

function buildDisplay(raw: any) {
  const sizing = raw.marketSizing?.sizing || {};
  const influence = raw.influence?.influence || {};
  const gaps = raw.gaps?.analysis || {};
  const serpPositions = influence.rawGoogle?.serpPositions || [];
  const igData = influence.rawInstagram || null;

  const terms = (raw.terms?.terms || []).slice(0, 10).map((t: any) => {
    const vol = (raw.volumes?.termVolumes || []).find((v: any) => v.term === t.term);
    const serp = serpPositions.find((sp: any) => sp.term?.toLowerCase() === t.term.toLowerCase());
    return { term: t.term, volume: vol?.monthlyVolume || 0, cpc: vol?.cpcBrl || 0, intent: t.intent, position: serp?.position ? String(serp.position) : "—", serpFeatures: serp?.serpFeatures || [] };
  });

  return {
    terms, totalVolume: raw.volumes?.totalMonthlyVolume || 0, avgCpc: 0,
    marketLow: sizing.marketPotential?.low || 0, marketHigh: sizing.marketPotential?.high || 0,
    influencePercent: Math.round(influence.totalInfluence || 0),
    source: (raw.sourcesUsed || []).join(", "), confidence: raw.confidenceLevel || "low",
    pipeline: { version: raw.pipelineVersion || "", durationMs: raw.totalProcessingTimeMs || 0, sourcesUsed: raw.sourcesUsed || [], sourcesUnavailable: raw.sourcesUnavailable || [] },
    gapHeadline: gaps.headlineInsight || "", gapPattern: gaps.primaryPattern || null,
    gaps: gaps.gaps || [], workRoutes: gaps.workRoutes || [],
    influenceBreakdown: { google: influence.google?.score || 0, instagram: influence.instagram?.score || 0, web: influence.web?.available ? influence.web.score : null },
    maps: influence.rawGoogle?.mapsPresence || null,
    instagram: igData?.profile ? { handle: igData.profile.handle || "", followers: igData.profile.followers || 0, engagementRate: igData.profile.engagementRate || 0, postsLast30d: igData.profile.postsLast30d || 0, avgLikes: igData.profile.avgLikesLast30d || 0, avgViews: igData.profile.avgViewsReelsLast30d || 0, dataAvailable: igData.profile.dataAvailable || false } : null,
    competitorInstagram: (igData?.competitors || []).filter((c: any) => c.dataAvailable).map((c: any) => ({ handle: c.handle, followers: c.followers || 0, engagementRate: c.engagementRate || 0, postsLast30d: c.postsLast30d || 0, avgLikes: c.avgLikesLast30d || 0, avgViews: c.avgViewsReelsLast30d || 0 })),
    serpSummary: { termsScraped: serpPositions.length, termsRanked: serpPositions.filter((sp: any) => sp.position && sp.position <= 10).length, hasLocalPack: serpPositions.some((sp: any) => sp.serpFeatures?.includes("local_pack")), hasAds: serpPositions.some((sp: any) => sp.serpFeatures?.includes("ads")) },
    aiVisibility: raw.aiVisibility || null,
    termGeneration: { count: raw.terms?.termCount || 0 },
  };
}
