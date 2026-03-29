// File: src/app/resultado/[leadId]/page.tsx

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import ResultadoClient from "./ResultadoClient";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ErrorScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">🔍</div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">{title}</h1>
        <p className="text-[var(--text-secondary)] mb-8">{subtitle}</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-colors"
          style={{ backgroundColor: "var(--accent-primary)" }}
        >
          Fazer novo diagnóstico
        </Link>
      </div>
    </div>
  );
}

export default async function ResultadoPage({ params }: { params: { leadId: string } }) {
  const { leadId } = params;

  if (!UUID_REGEX.test(leadId)) {
    return <ErrorScreen title="Resultado não encontrado" subtitle="O link que você acessou é inválido. Verifique se copiou o endereço corretamente." />;
  }

  const supabase = getSupabase();

  const { data: lead } = await supabase
    .from("leads").select("id, product, region, email, status, paid_at").eq("id", leadId).single();

  if (!lead) {
    return <ErrorScreen title="Resultado não encontrado" subtitle="Não encontramos nenhum diagnóstico com esse link. Ele pode ter expirado ou sido removido." />;
  }

  // Se já pagou, redireciona para o dashboard
  if (lead.paid_at) {
    redirect(`/dashboard/${leadId}`);
  }

  const { data: diagnosis } = await supabase
    .from("diagnoses").select("*").eq("lead_id", leadId)
    .order("created_at", { ascending: false }).limit(1).single();

  if (!diagnosis) {
    return <ErrorScreen title="Estou vasculhando seu mercado." subtitle="Cruzo Google, Maps, Instagram e IA para montar sua leitura. Volto em alguns minutos." />;
  }

  const raw = diagnosis.raw_data || {};
  const display = buildDisplay(raw);

  return <ResultadoClient product={lead.product} region={lead.region} leadId={leadId} results={display} />;
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
    audiencia: raw.audiencia || null,
    competitionIndex: raw.competitionIndex || null,
    clientType: raw.clientType || 'b2c',
    volumeGeo: raw.volumeGeo || null,
    pncp: raw.pncp || null,
  };
}
