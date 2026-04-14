"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";
// FeedbackWidget removido — será adicionado em outro momento da jornada
import { NelsonLogo } from "./NelsonLogo";
import { V, ICONS, PILAR_COLORS } from "@/lib/design-tokens";

interface TermData { term: string; volume: number; cpc: number; position: string; intent?: string; serpFeatures?: string[]; }
interface Results {
  terms: TermData[]; totalVolume: number; avgCpc: number;
  marketLow: number; marketHigh: number; influencePercent: number;
  source: string; confidence: string; gapHeadline?: string;
  termGeneration?: { count: number };
  influenceBreakdown?: {
    google: number;
    instagram: number;
    web: number | null;
    levers?: Array<{
      dimension: 'alcance' | 'descoberta' | 'credibilidade';
      action: string;
      impact: number;
      effort: 'baixo' | 'médio' | 'alto';
      horizon: '1-2 semanas' | '1-2 meses' | '3-6 meses';
      currentValue?: string;
      targetValue?: string;
    }>;
  };
  maps?: { found: boolean; rating: number | null; reviewCount: number | null; categories: string[]; inLocalPack: boolean; photos: number };
  instagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes: number; avgViews: number; recentPostsCount?: number; recentAvgReach?: number; dataAvailable: boolean };
  competitorInstagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes?: number; avgViews?: number }[];
  serpSummary?: { termsScraped: number; termsRanked: number; hasLocalPack: boolean; hasAds: boolean };
  pipeline?: { version: string; durationMs: number; sourcesUsed: string[]; sourcesUnavailable: string[] };
  gaps?: any[]; gapPattern?: any;
  workRoutes?: { priority: number; title: string; rationale: string; connection: string; horizon: string; expectedImpact: string }[];
  aiVisibility?: { score: number; summary: string; likelyMentioned: boolean; factors: any[]; competitorMentions: any[] } | null;
  audiencia?: {
    populacaoRaio: number; raioKm: number | null; densidade: string;
    municipioNome: string; targetProfile: string; estimatedPercentage: number;
    audienciaTarget: number; rationale: string; ibgeAno?: number;
  } | null;
  competitionIndex?: {
    totalCompetitors: number; activeCompetitors: number; totalSearchVolume: number;
    indexValue: number; label: 'subatendido' | 'equilibrado' | 'saturado';
    labelText: string; color: 'green' | 'yellow' | 'red';
    competitors: { name: string; hasWebsite: boolean; hasInstagram: boolean; mapsPosition?: number; rating?: number; reviewCount?: number }[];
  } | null;
  lat?: number | null;
  lng?: number | null;
  clientType?: 'b2c' | 'b2b' | 'b2g';
  volumeGeo?: { level: string; label: string } | null;
  pncp?: {
    totalEncontradas: number; valorTotalEstimado: number;
    modalidades: { modalidade: string; count: number }[];
    orgaosUnicos: number; periodoConsultado: string;
    contratacoes: { objeto: string; orgaoEntidade: string; valorEstimado: number; modalidade: string }[];
  } | null;
  projecaoFinanceira?: {
    buscasNoRaio: number;
    receitaAtual: number;
    receitaPotencial: number;
    gapCaptura: number;
    clientesAtual: number;
    clientesPotencial: number;
    clientesGap: number;
    audienciaTarget: number;
    familiasAtual: number;
    familiasPotencial: number;
    familiasGap: number;
    mercadoTotal: number;
    posicaoLider: number | null;
    receitaLider: number | null;
    nomeLider: string | null;
    influenciaAtual: number;
    influenciaMeta: number;
    ticketMedio: number;
    taxaConversao: number;
    ticketRationale: string;
    geoAdjustedVolume: number;
    gapMensal?: number;
    buscasNoTarget?: number;
    mercadoLabel?: string;
    demandType?: string;
  } | null;
  demandType?: string;
  expandedData?: {
    sources?: string[];
    reclameAqui?: { found: boolean; score?: number; reputation?: string; responseRate?: number; totalComplaints?: number; url?: string };
    ifood?: { found: boolean; url?: string; restaurantName?: string };
    mercadoLivre?: { found: boolean; sellerName?: string; reputation?: { level?: string; powerSellerStatus?: string; transactions?: number; ratings?: { positive: number; neutral: number; negative: number } }; permalink?: string };
    adsTransparency?: { searched: boolean; termsWithAds: number; totalTerms: number; adsDetected: boolean; summary: string };
    seasonality?: { bestMonths?: string[]; worstMonths?: string[]; seasonalityStrength: string; summary: string; source: string };
    instagramExpanded?: { gaps?: string[]; summary?: string };
    linkedin?: { companyPage?: { found: boolean; url?: string }; founderProfile?: { found: boolean; url?: string } };
    fetchedAt?: string;
  };
  blueprintId?: string;
}
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; leadId?: string; hideCTA?: boolean; hideWorkRoutes?: boolean; name?: string; seasonality?: any; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPop(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 2 ? `${m.toFixed(1).replace(".", ",")} milhões` : `${m.toFixed(1).replace(".", ",")} milhão`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`;
  return n.toLocaleString("pt-BR");
}

function fmtBRL(n: number): string {
  if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `R$${Math.round(n / 1_000)}k`;
  return `R$${n.toLocaleString('pt-BR')}`;
}

function inferIntent(term: string, isB2B?: boolean): { label: string; color: string } {
  const t = term.toLowerCase();
  if (/contrat|preço|preco|quanto custa|orçamento|orcamento|comprar|agendar|marcar|valor/.test(t)) {
    return { label: "Transacional", color: V.teal };
  }
  if (/perto|próximo|proximo|bairro|centro|zona|região|regiao|em\s+\w+$/.test(t)) {
    return { label: isB2B ? "Setorial" : "Local", color: "#3B82F6" };
  }
  return { label: "Informacional", color: V.ash };
}

function generateCirclePath(lat: number, lng: number, radiusKm: number, points: number = 36): string {
  const coords: string[] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusKm / 111.32) * Math.cos(angle);
    const dLng = (radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    coords.push(`${(lat + dLat).toFixed(6)},${(lng + dLng).toFixed(6)}`);
  }
  return coords.join('|');
}

function Expandable({ title, icon, children, defaultOpen = false, badge }: {
  title: string; icon?: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 18px", borderRadius: 10, border: `1px solid ${V.fog}`,
        background: V.white, cursor: "pointer", textAlign: "left", gap: 10,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
          <span style={{ fontSize: 14, fontWeight: 600, color: V.night }}>{title}</span>
          {badge}
        </span>
        <span style={{ fontSize: 16, color: V.ash, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "16px 18px", background: V.white, borderRadius: "0 0 10px 10px", border: `1px solid ${V.fog}`, borderTopColor: "transparent", marginTop: -1 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Chip({ children, color = V.ash }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase" as const, color, background: `${color}18`, padding: "3px 8px", borderRadius: 100, fontWeight: 500 }}>{children}</span>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InstantValueScreen({ product, region, results: initialResults, onCheckout, loading, leadId, hideCTA, hideWorkRoutes, name, seasonality }: Props) {
  const [show, setShow] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [results, setResults] = useState(initialResults);
  const [enriching, setEnriching] = useState(
    (initialResults as any).enrichmentStatus === 'pending'
  );
  const [enrichSecondsLeft, setEnrichSecondsLeft] = useState(120);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  // Countdown timer for enrichment ETA
  useEffect(() => {
    if (!enriching) return;
    const tick = setInterval(() => {
      setEnrichSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [enriching]);

  // Poll for enrichment updates when data is still being collected
  useEffect(() => {
    if (!enriching || !leadId) return;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/diagnose?leadId=${leadId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.enrichmentStatus === 'complete') {
            setResults(data.results);
            setEnriching(false);
            clearInterval(poll);
          } else if (data.results) {
            // Update with whatever new data arrived
            setResults(data.results);
          }
        }
      } catch { /* ignore */ }
      if (attempts >= 12) { // 2 min max
        setEnriching(false);
        clearInterval(poll);
      }
    }, 10_000);
    return () => clearInterval(poll);
  }, [enriching, leadId]);

  const termCount = results.termGeneration?.count || results.terms.length;
  const hasVolume = results.totalVolume > 0;
  const serpData = results.serpSummary;
  const igData = results.instagram;
  const breakdown = results.influenceBreakdown;
  const levers = breakdown?.levers || [];
  const hasLevers = levers.length > 0;
  const competitors = results.competitorInstagram || [];
  const shortRegion = region.split(",")[0].trim();
  const aud = results.audiencia;
  const hasAudiencia = aud && aud.audienciaTarget > 0;
  const hasInfluence = results.influencePercent > 0;
  const proj = results.projecaoFinanceira;
  const hasProj = proj && (proj.gapCaptura > 0 || (proj.gapMensal && proj.gapMensal > 0)) && proj.mercadoTotal > 0;
  const ci = results.competitionIndex;
  const hasCi = ci && (ci.totalSearchVolume > 0 || ci.totalCompetitors > 0);
  // isB2B é estritamente "vende pra empresa" — NÃO confundir com escala nacional.
  // Antes esse cálculo incluía demandType=national_service, que fazia leads
  // b2c+nacional (ex: agência de intercâmbio) exibirem "empresas" em vez de
  // "pessoas" no bloco de mercado potencial.
  const isB2B = results.clientType === 'b2b';
  const isB2G = results.clientType === 'b2g';
  // Escala nacional é independente do clientType — pode ser b2c+nacional, b2b+nacional, etc.
  const isNacional = /brasil|nacional/i.test(results.audiencia?.municipioNome || '')
    || results.demandType === 'national_service'
    || results.demandType === 'ecommerce_national'
    || (results.projecaoFinanceira?.demandType === 'national_service')
    || (results.projecaoFinanceira?.demandType === 'ecommerce_national');
  const isNacionalAny = isNacional;
  const isB2BNacional = isB2B && isNacional;
  const displayName = name && name.trim() ? name.trim() : product;
  const audienciaLabel = isB2G ? 'órgãos públicos potenciais' : isB2B ? 'empresas no seu mercado' : 'pessoas no seu mercado';
  const searchVolumeIsEstimate = (results as any).searchVolumeIsEstimate || false;
  const audienciaIsEstimate = (results as any).audienciaIsEstimate || false;
  const audienciaUnit = isB2G ? 'órgãos' : isB2B ? 'empresas' : 'pessoas';

  const audSublabel = aud
    ? aud.densidade === "nacional"
      ? "Nacional"
      : `Raio ${aud.raioKm}km`
    : "";

  // Fontes encontradas
  const fontesEncontradas = [
    results.maps?.found && { label: 'Google Maps', ok: true,
      detail: results.maps.rating ? `★ ${results.maps.rating} · ${results.maps.reviewCount} avaliações` : 'encontrado' },
    results.instagram?.handle && { label: 'Instagram',
      ok: (results.instagram.followers || 0) > 0,
      detail: results.instagram.handle ? `@${results.instagram.handle}` : 'encontrado' },
    (results.serpSummary?.termsRanked || 0) > 0 && { label: 'Google Search', ok: true,
      detail: `${results.serpSummary!.termsRanked} termos rankeados` },
    results.aiVisibility?.likelyMentioned && { label: 'IA', ok: true,
      detail: 'mencionado em buscas de IA' },
  ].filter(Boolean);
  const nenhumEncontrado = fontesEncontradas.length === 0 && results.influencePercent === 0;

  // Oportunidade calculations — garantir que familiasAtual <= audienciaTotal
  const audienciaTotal = results.audiencia?.audienciaTarget || 0;
  const familiasAtual = proj?.familiasAtual != null
    ? Math.min(proj.familiasAtual, audienciaTotal)
    : Math.round(audienciaTotal * (results.influencePercent / 100));
  const familiasPotencial = proj?.familiasPotencial != null
    ? Math.min(proj.familiasPotencial, audienciaTotal)
    : Math.round(audienciaTotal * (Math.min(results.influencePercent + 10, 100) / 100));
  let oportunidade = nenhumEncontrado ? 0 : Math.max(0, familiasPotencial - familiasAtual);
  // Fallback: se gap = 0, usar familiasGap do pipeline ou 10% da audiência
  if (oportunidade <= 0 && !nenhumEncontrado && audienciaTotal > 0) {
    oportunidade = proj?.familiasGap || Math.max(1, Math.round(audienciaTotal * 0.10));
  }
  const raioKm = results.audiencia?.raioKm || 3;

  // Pilar status indicators — tons suaves, sem emojis
  const statusMuted = { warn: { bg: "rgba(180,83,9,0.04)", color: "#92610A" }, ok: { bg: "rgba(15,118,110,0.04)", color: "#0C5C56" }, mid: { bg: "rgba(120,113,108,0.05)", color: V.slate } };
  const pilar1Status = !results.maps?.found
    ? { text: "Não encontrado no Google Maps", ...statusMuted.warn }
    : !results.maps?.inLocalPack
    ? { text: "No Maps mas fora do top 3", ...statusMuted.mid }
    : { text: "Visível no Google Maps", ...statusMuted.ok };
  const pilar2Status = (results.maps?.reviewCount || 0) < 10
    ? { text: "Poucas avaliações", ...statusMuted.warn }
    : (results.maps?.rating || 0) >= 4.0
    ? { text: "Boa reputação base", ...statusMuted.ok }
    : { text: "Avaliações precisam melhorar", ...statusMuted.mid };
  const pilar3Status = !igData?.dataAvailable || (igData?.recentPostsCount ?? 0) === 0
    ? { text: "Presença digital parada", ...statusMuted.warn }
    : { text: "Presença ativa", ...statusMuted.ok };

  const pilar1Acoes = isB2B
    ? ["Otimizar LinkedIn Company Page com palavras-chave do setor e localização", "Criar página de serviços com SEO para termos B2B específicos do segmento", "Aparecer em buscas de IA: publicar conteúdo técnico que responde perguntas do decisor", "Listar empresa em diretórios setoriais que indexam bem no Google"]
    : ["Criar ou otimizar perfil no Google Meu Negócio com categoria, horário e fotos reais", "Adicionar cidade + serviço nas meta tags do site (ex: 'clínica de estética em Pinheiros')", "Configurar WhatsApp Business com palavras-chave do segmento na bio", "Aparecer em buscas de IA: descrição detalhada no Maps + responder avaliações"];
  const pilar2Acoes = isB2B
    ? ["Publicar 2-3 cases reais com resultados mensuráveis no site e LinkedIn", "Solicitar depoimento em vídeo de 3 clientes satisfeitos esta semana", "Criar página 'Sobre' com time, metodologia e diferenciais concretos", "Newsletter mensal com insight do setor — demonstra autoridade antes da venda"]
    : ["Pedir avaliação para os últimos 20 clientes via mensagem no WhatsApp esta semana", "Adicionar 10+ fotos reais do espaço, equipe e resultado de serviços no Maps", "Reescrever bio do Instagram com proposta de valor clara e CTA direto", "Responder 100% das avaliações do Google — aumenta ranking e confiança"];
  const pilar3Acoes = isB2B
    ? ["Publicar artigo técnico em portal do setor (1x/mês)", "Identificar newsletters de nicho onde decisores estão e pedir menção", "Participar de podcast ou evento do segmento como convidado", "Fazer parceria com players complementares que aparecem em buscas de IA"]
    : ["Criar 2 posts/semana respondendo perguntas reais que clientes fazem", "Pedir menção a parceiros locais (outros negócios complementares no raio)", "Identificar portais do setor que indexam bem no ChatGPT e pedir presença", "Colaborar com criadores de conteúdo locais do mesmo segmento"];

  // Pilares com scores e levers — tenta múltiplas fontes de dados
  const bd = (results as any).influenceBreakdown4D || (results as any).influenceBreakdown || {};
  const d1 = (bd as any)?.d1_descoberta ?? (bd as any)?.d1_discovery ?? (bd as any)?.google ?? 0;
  const d2 = (bd as any)?.d2_credibilidade ?? (bd as any)?.d2_credibility ?? 0;
  const d3 = (bd as any)?.d3_presenca ?? (bd as any)?.d3_reach ?? (bd as any)?.instagram ?? 0;
  const d4 = (bd as any)?.d4_reputacao ?? 0;
  // Se todos os scores são 0 mas influencePercent > 0, distribui o score uniformemente
  const scoreTotal = d1 + d2 + d3 + d4;
  const d1f = scoreTotal > 0 ? d1 : (results.influencePercent > 0 ? Math.round(results.influencePercent * 0.8) : 0);
  const d2f = scoreTotal > 0 ? d2 : (results.influencePercent > 0 ? Math.round(results.influencePercent * 1.2) : 0);
  const d3f = scoreTotal > 0 ? d3 : (results.influencePercent > 0 ? Math.round(results.influencePercent * 0.7) : 0);
  const d4f = scoreTotal > 0 ? d4 : 0;
  const allLevers = (bd as any)?.levers || (results as any).influenceBreakdown?.levers || [];

  const pilarCards = [
    { icon: ICONS.visibilidade, label: "Visibilidade", score: Math.round(d1f), color: PILAR_COLORS.visibilidade, dim: "descoberta",
      detail: results.maps?.found ? `Maps: ★ ${results.maps.rating} · ${results.maps.reviewCount} avaliações` : "Não encontrado no Google Maps",
      status: pilar1Status, fallback: "Otimizar perfil no Google Meu Negócio com fotos e descrição completa" },
    { icon: ICONS.credibilidade, label: "Credibilidade", score: Math.round((d2f + d4f) / 2), color: PILAR_COLORS.credibilidade, dim: "credibilidade",
      detail: results.maps?.reviewCount ? `${results.maps.reviewCount} avaliações · ★ ${results.maps.rating}` : "Sem avaliações detectadas",
      status: pilar2Status, fallback: "Solicitar avaliações dos últimos 20 clientes via WhatsApp" },
    { icon: ICONS.presencaDigital, label: "Presença Digital", score: Math.round(d3f), color: PILAR_COLORS.presencaDigital, dim: "presenca",
      detail: igData?.handle ? `@${igData.handle} · ${igData.followers?.toLocaleString('pt-BR')} seguidores` : "Presença digital não detectada",
      status: pilar3Status, fallback: "Publicar 2 posts/semana respondendo dúvidas frequentes do seu público" },
  ];

  // Volumes inteiros (P8 fix) + check se todos iguais (P9 fix)
  const totalVolumeRaw = Math.round(results.totalVolume || 0);
  // Volume ponderado: usa buscasNoRaio (geo-adjusted) se disponível, senão pondera manualmente
  const totalVolumeInt = (() => {
    if (proj?.buscasNoRaio && proj.buscasNoRaio > 0 && proj.buscasNoRaio < totalVolumeRaw) {
      return proj.buscasNoRaio;
    }
    // Ponderação manual: volume × (audiência / população)
    if (aud?.audienciaTarget && aud?.populacaoRaio && totalVolumeRaw > 0) {
      const ratio = Math.min(aud.audienciaTarget / Math.max(aud.populacaoRaio, 1), 1);
      const ponderado = Math.round(totalVolumeRaw * ratio);
      if (ponderado > 0 && ponderado < totalVolumeRaw) return ponderado;
    }
    return totalVolumeRaw;
  })();
  const allTermsSameVolume = results.terms.length > 1 && results.terms.every(t => t.volume === results.terms[0].volume && t.volume > 0);

  // Audiência display corrigida para B2B nacional (P10 fix)
  const audDisplayPop = aud && isB2B && aud.populacaoRaio > 50_000_000
    ? Math.round(aud.populacaoRaio / 8) // B2B: converter população para empresas
    : aud?.populacaoRaio || 0;

  // Competitor comparison data (P16)
  const competitorAvgRating = ci?.competitors && ci.competitors.length > 0
    ? (ci.competitors.reduce((s, c) => s + (c.rating || 0), 0) / ci.competitors.filter(c => c.rating).length) || 0
    : 0;
  const competitorAvgReviews = ci?.competitors && ci.competitors.length > 0
    ? Math.round(ci.competitors.reduce((s, c) => s + (c.reviewCount || 0), 0) / ci.competitors.filter(c => c.reviewCount).length) || 0
    : 0;

  // ─── Quick wins state (fetched from growth machine API) ─────────────────
  const [quickWins, setQuickWins] = useState<any[]>([]);
  const [qwLoading, setQwLoading] = useState(true);
  const [qwExpanded, setQwExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!leadId) { setQwLoading(false); return; }
    let cancelled = false;

    const fetchQW = async (attempt: number) => {
      if (cancelled) return;
      try {
        // Tenta GET primeiro (GM já gerada?)
        const res = await fetch(`/api/growth-machine?leadId=${leadId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ready' && data.data?.quickWins?.length > 0) {
            if (!cancelled) { setQuickWins(data.data.quickWins); setQwLoading(false); }
            return;
          }
        }
        // Se não existe, tenta gerar via POST
        if (attempt <= 1) {
          await fetch('/api/growth-machine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId }),
          });
        }
        // Retry até 3x com 8s entre tentativas
        if (attempt < 3 && !cancelled) {
          setTimeout(() => fetchQW(attempt + 1), 8000);
        } else if (!cancelled) {
          setQwLoading(false);
        }
      } catch {
        if (!cancelled) setQwLoading(false);
      }
    };

    // Primeira tentativa após 3s (pipeline precisa terminar antes)
    const timer = setTimeout(() => fetchQW(0), 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [leadId]);

  // Score visual data
  const scoreAtual = results.influencePercent || 0;
  const scorePotencial = proj?.influenciaMeta ? Math.min(proj.influenciaMeta, 85) : Math.min(scoreAtual + 35, 85);

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "48px 20px", opacity: show ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* ═══════════════ HEADER — KPI PRINCIPAL ═══════════════ */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: V.display, fontSize: 18, fontWeight: 800, color: V.night, letterSpacing: "-0.02em" }}>
            Virô<span style={{ color: V.teal }}>.</span>
          </div>
          <div style={{ fontSize: 10, color: V.ash, fontFamily: V.mono, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginTop: 2 }}>
            RADAR DE CRESCIMENTO
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: V.night, margin: "0 0 4px" }}>{displayName}</h1>
          <p style={{ fontSize: 13, color: V.zinc, margin: 0 }}>{shortRegion}</p>
        </div>

        {/* Enrichment status */}
        {enriching && (
          <div style={{ background: V.amberWash, borderRadius: 10, padding: "10px 14px", marginBottom: 16, border: `1px solid rgba(180,83,9,0.15)`, fontSize: 12, color: V.amber, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, border: `2px solid ${V.fog}`, borderTopColor: V.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            <span>Coletando dados adicionais — a página atualiza sozinha.</span>
          </div>
        )}

        {/* Score Ring — KPI Principal */}
        {(() => {
          const ringSize = 160;
          const ringStroke = 6;
          const ringRadius = (ringSize - ringStroke) / 2;
          const ringCirc = 2 * Math.PI * ringRadius;
          const ringOffset = ringCirc - (scoreAtual / 100) * ringCirc;

          return (
            <div style={{ background: V.white, borderRadius: 16, border: `1px solid ${V.fog}`, padding: "28px 20px", marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontFamily: V.display, fontSize: 15, fontWeight: 700, color: V.night, marginBottom: 4 }}>
                Qual fatia do seu mercado você disputa?
              </div>
              <p style={{ fontSize: 11, color: V.zinc, margin: "0 0 16px", lineHeight: 1.5 }}>
                Medimos sua presença no Google, Instagram e IA pra calcular quanto do mercado local te encontra hoje.
              </p>

              {/* Ring */}
              <div style={{ position: "relative", width: ringSize, height: ringSize, margin: "0 auto 20px" }}>
                <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke={V.fog} strokeWidth={ringStroke} />
                  <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke={scoreAtual < 30 ? V.coral : scoreAtual < 50 ? V.amber : V.teal} strokeWidth={ringStroke} strokeLinecap="round" strokeDasharray={ringCirc} strokeDashoffset={ringOffset} style={{ transition: "stroke-dashoffset 1s ease" }} />
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                  <div style={{ fontFamily: V.display, fontSize: 40, fontWeight: 800, color: V.night, lineHeight: 1 }}>
                    <AnimatedCounter target={scoreAtual} suffix="" />
                  </div>
                  <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash }}>de 100</div>
                </div>
              </div>

              {/* Indicadores: onde está, onde poderia, média mercado */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
                <div style={{ padding: "10px 6px", background: V.cloud, borderRadius: 8 }}>
                  <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 800, color: scoreAtual < 30 ? V.coral : scoreAtual < 50 ? V.amber : V.teal }}>{scoreAtual}</div>
                  <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>Você hoje</div>
                </div>
                <div style={{ padding: "10px 6px", background: V.cloud, borderRadius: 8 }}>
                  <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 800, color: V.amber }}>{scorePotencial}</div>
                  <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>Potencial</div>
                </div>
                <div style={{ padding: "10px 6px", background: V.cloud, borderRadius: 8 }}>
                  <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 800, color: V.zinc }}>
                    {competitorAvgRating > 0 ? Math.round(competitorAvgRating * 10) : '35'}
                  </div>
                  <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>Média mercado</div>
                </div>
              </div>

              {/* Explicação contextual */}
              <p style={{ fontSize: 12, color: V.night, margin: "14px 0 0", lineHeight: 1.6, fontWeight: 500 }}>
                {scoreAtual < 20
                  ? `Você disputa ${scoreAtual}% da demanda do seu mercado atingível. Concorrentes na região disputam em ~${competitorAvgRating > 0 ? Math.round(competitorAvgRating * 10) : 35}%. Chegar a ${scorePotencial}% é viável em 90 dias.`
                  : scoreAtual < 40
                  ? `Você disputa ${scoreAtual}% da demanda do seu mercado atingível. Concorrentes na região disputam em ~${competitorAvgRating > 0 ? Math.round(competitorAvgRating * 10) : 35}%. Chegar a ${scorePotencial}% é viável em 90 dias.`
                  : scoreAtual < 60
                  ? `Boa posição — você disputa ${scoreAtual}% da demanda. Acima da média de ${competitorAvgRating > 0 ? Math.round(competitorAvgRating * 10) : 35}%. Pra chegar a ${scorePotencial}%, foque nas ações abaixo.`
                  : `Forte presença — ${scoreAtual}% do mercado te encontra. Você está acima da média. Foque em manter e expandir.`}
              </p>

              {/* Metodologia */}
              <div style={{ marginTop: 12, padding: "10px 12px", background: V.cloud, borderRadius: 8, borderLeft: `3px solid ${V.teal}` }}>
                <p style={{ fontSize: 10, color: V.zinc, margin: 0, lineHeight: 1.6 }}>
                  <strong style={{ color: V.night }}>Como calculamos:</strong> Cruzamos sua presença no Google Maps (posição, avaliações, fotos), resultados de busca orgânica (SERP), Instagram (alcance, engajamento, frequência){results.aiVisibility ? ', visibilidade em IA (ChatGPT, Gemini)' : ''}{aud ? `, com dados populacionais do IBGE${aud.ibgeAno ? ` (${aud.ibgeAno})` : ''}` : ''}{aud?.raioKm ? ` no raio de ${aud.raioKm}km` : ''}.
                  {aud?.audienciaTarget ? ` Mercado atingível: ~${fmtPop(aud.audienciaTarget)} ${audienciaUnit} no perfil-alvo.` : ''}
                </p>
              </div>

              {/* Source chips */}
              {fontesEncontradas.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, justifyContent: "center", marginTop: 14 }}>
                  {fontesEncontradas.map((fonte: any, i: number) => (
                    <span key={i} style={{ fontSize: 9, color: V.teal, background: V.tealWash, borderRadius: 4, padding: "2px 6px" }}>
                      ✓ {fonte.label}
                    </span>
                  ))}
                </div>
              )}
              {nenhumEncontrado && (
                <p style={{ fontSize: 11, color: V.coral, margin: "12px 0 0" }}>
                  Nenhuma presença digital detectada — partindo do zero.
                </p>
              )}
            </div>
          );
        })()}

        {/* ═══════════════ QUICK WINS ═══════════════ */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
            ⚡ AÇÕES RÁPIDAS — COMECE AGORA
          </div>

          {qwLoading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: V.ash, fontSize: 12 }}>
              <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${V.fog}`, borderTopColor: V.teal, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 8, verticalAlign: "middle" }} />
              Montando ações personalizadas...
            </div>
          ) : quickWins.length > 0 ? (
            <>
              {quickWins.slice(0, 3).map((qw: any) => (
                <div key={qw.id} style={{ background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`, padding: "14px 16px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{qw.title}</span>
                    <span style={{ fontFamily: V.mono, fontSize: 9, padding: "2px 6px", borderRadius: 100, background: V.fog, color: V.ash }}>{qw.timeEstimate}</span>
                  </div>
                  <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 6px", lineHeight: 1.5 }}>{qw.description}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: V.teal, background: "rgba(45,155,131,0.08)", padding: "2px 8px", borderRadius: 4 }}>{qw.impact}</span>

                  {qw.steps && (
                    <button onClick={() => setQwExpanded(prev => ({ ...prev, [qw.id]: !prev[qw.id] }))} style={{ fontSize: 11, color: V.amber, background: "none", border: "none", cursor: "pointer", fontWeight: 600, marginLeft: 8, padding: 0 }}>
                      {qwExpanded[qw.id] ? "Ocultar ▴" : "Ver como fazer ▾"}
                    </button>
                  )}

                  {qwExpanded[qw.id] && qw.steps && (
                    <div style={{ marginTop: 8 }}>
                      {qw.steps.map((step: string, si: number) => (
                        <div key={si} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, background: V.fog, borderRadius: 4, padding: "1px 6px", flexShrink: 0, marginTop: 2 }}>{si + 1}</span>
                          <span style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Locked quick wins */}
              {quickWins.length > 3 && (
                <>
                  {quickWins.slice(3, 5).map((qw: any) => (
                    <div key={qw.id} style={{ background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`, padding: "14px 16px", marginBottom: 8, position: "relative", overflow: "hidden" }}>
                      <div style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{qw.title}</span>
                        <p style={{ fontSize: 12, color: V.zinc, margin: "4px 0 0" }}>{qw.description}</p>
                      </div>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.4)" }}>
                        <span style={{ fontSize: 16, opacity: 0.6 }}>🔒</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ textAlign: "center", margin: "8px 0 4px" }}>
                    <p style={{ fontSize: 12, color: V.night, fontWeight: 600, margin: "0 0 4px" }}>
                      🔒 Assine o Radar para desbloquear {quickWins.length - 3} ações personalizadas
                    </p>
                    <p style={{ fontSize: 11, color: V.ash, margin: 0 }}>
                      Com passo a passo detalhado, textos prontos e monitoramento semanal.
                    </p>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>

        {/* ═══════════════ ELEMENTOS COMPETITIVOS ═══════════════ */}
        <div style={{ fontFamily: V.mono, fontSize: 10, color: V.night, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
          📊 SEU MERCADO EM DETALHE
        </div>

        {/* Resumo do mercado */}
        {(() => {
          const competitorCount = ci?.activeCompetitors || 0;
          const parts: string[] = [];
          if (audienciaTotal > 0) parts.push(`Mercado potencial: ${fmtPop(audienciaTotal)} ${audienciaUnit}.`);
          if (hasVolume) parts.push(`${fmtPop(totalVolumeInt)} buscas ativas/mês.`);
          if (competitorCount > 0) parts.push(`${competitorCount} concorrente${competitorCount !== 1 ? 's' : ''} mapeado${competitorCount !== 1 ? 's' : ''}.`);






          if (oportunidade > 0) parts.push(`Há oportunidade de capturar mais demanda.`);
          return parts.length > 0 ? (
            <div style={{ background: V.tealWash, borderRadius: 10, padding: "12px 14px", marginBottom: 12, border: `1px solid rgba(15,118,110,0.12)` }}>
              <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.6 }}>{parts.join(' ')}</p>
            </div>
          ) : null;
        })()}

        {/* Accordion 1 — Tamanho do mercado */}















        <Expandable title={`Mercado potencial — ${hasAudiencia ? fmtPop(aud!.audienciaTarget) + ' ' + audienciaUnit : hasVolume ? '~' + fmtPop(Math.round(totalVolumeInt * 3)) + ' ' + audienciaUnit + ' (estimado)' : 'dados insuficientes'}`} icon="">
          {results.maps?.found && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${V.fog}` }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: V.teal, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "white", fontWeight: 700, fontSize: 18 }}>{(displayName || "N")[0].toUpperCase()}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{displayName}</div>
                <div style={{ fontSize: 11, color: V.ash }}>★ {results.maps.rating} · {results.maps.reviewCount} avaliações</div>
              </div>
            </div>
          )}
          {aud && aud.populacaoRaio > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                <span style={{ fontSize: 12, color: V.zinc }}>{
                  isB2B && isNacional ? 'Empresas no mercado-alvo nacional'
                  : isB2B ? 'Base de empresas no raio'
                  : isNacional ? 'Pessoas no mercado-alvo nacional'
                  : `Pessoas no raio de ${aud.raioKm || raioKm}km`
                }</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{fmtPop(audDisplayPop)} {audienciaUnit}{audienciaIsEstimate ? ' (estimativa setorial)' : ''}</span>
              </div>
              {aud.targetProfile && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <span style={{ fontSize: 12, color: V.zinc }}>{isB2B ? 'Empresa-alvo' : 'Perfil target'}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: V.night, textAlign: "right", maxWidth: "60%" }}>{aud.targetProfile}</span>
                </div>
              )}
              {aud.audienciaTarget > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Audiência estimada</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: V.teal }}>~{fmtPop(aud.audienciaTarget)} {audienciaUnit}{audienciaIsEstimate ? ' (estimativa)' : ''}</span>
                </div>
              )}
              {(results.demandType === 'local_workers' || results.demandType === 'tourist_flow') && (
                <div style={{ marginTop: 8, padding: "6px 10px", background: V.amberWash, borderRadius: 6, borderLeft: `3px solid ${V.amber}`, fontSize: 11, color: V.zinc, lineHeight: 1.5 }}>
                  ℹ️ Para {results.demandType === 'local_workers' ? 'negócios que atendem trabalhadores' : 'negócios com demanda turística'}, a demanda real vem de {results.demandType === 'local_workers' ? 'quem trabalha na região' : 'visitantes'}.
                </div>
              )}
              {/* Mapa de raio — só para negócios locais com lat/lng */}
              {results.lat && results.lng && !isNacional && (
                <div style={{ marginTop: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${V.fog}` }}>
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${results.lat},${results.lng}&zoom=${(aud.raioKm || raioKm) <= 2 ? 15 : (aud.raioKm || raioKm) <= 5 ? 14 : 13}&size=560x200&scale=2&maptype=roadmap&markers=color:0xB45309|${results.lat},${results.lng}&path=color:0x0F766E80|weight:2|fillcolor:0x0F766E18|${generateCirclePath(results.lat, results.lng, aud.raioKm || raioKm)}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''}`}
                    alt={`Raio de ${aud.raioKm || raioKm}km`}
                    style={{ width: "100%", height: "auto", display: "block" }}
                    loading="lazy"
                  />
                </div>
              )}
              <p style={{ fontSize: 10, color: V.ash, margin: "10px 0 0", fontFamily: V.mono }}>Fonte: IBGE{aud.ibgeAno ? ` ${aud.ibgeAno}` : ''} · Estimativa Virô</p>
            </div>
          ) : <p style={{ fontSize: 12, color: V.ash, margin: 0 }}>Dados indisponíveis.</p>}
        </Expandable>

        {/* Accordion 2 — Demanda ativa */}










        <Expandable title={`Demanda ativa — ${hasVolume ? fmtPop(totalVolumeInt) + ' buscas/mês' + (searchVolumeIsEstimate ? ' (estimativa)' : '') : 'sem dados de busca para este segmento'}`} icon="">
          <div style={{ background: V.amberWash, borderRadius: 8, padding: "8px 12px", marginBottom: 12, borderLeft: `3px solid ${V.amber}` }}>
            <p style={{ fontSize: 11, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
              {results.demandType === 'ecommerce_national' || results.demandType === 'national_service'
                ? `Volumes nacionais. Estimativa de alcance orgânico possível com posicionamento adequado.`
                : `Volumes regionais. O número de ${fmtPop(totalVolumeInt)} buscas/mês é estimado com base na penetração da sua audiência no raio de ${raioKm}km do seu negócio.`}
            </p>
          </div>
          {allTermsSameVolume && (
            <div style={{ fontSize: 10, color: V.ash, marginBottom: 8, fontFamily: V.mono }}>
              Volume agregado do segmento — breakdown individual indisponível
            </div>
          )}
          {results.terms.slice(0, 10).map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 9 ? `1px solid ${V.fog}` : "none", fontSize: 12 }}>
              <span style={{ color: V.night, flex: 1 }}>{t.term}</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.ash, width: 50, textAlign: "right" }}>{allTermsSameVolume ? '—' : t.volume > 0 ? fmtPop(Math.round(t.volume)) : "—"}</span>
            </div>
          ))}
          {/* Sazonalidade — volume de busca por mês */}
          {seasonality?.months?.length > 0 && seasonality.months.some((m: any) => m.volume > 0) && (() => {
            const maxVol = Math.max(...seasonality.months.map((x: any) => x.volume));
            return (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${V.fog}` }}>
                <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 14 }}>
                  VOLUME DE BUSCA POR MÊS
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80 }}>
                  {seasonality.months.map((m: any) => {
                    const height = maxVol > 0 ? Math.max((m.volume / maxVol) * 80, 4) : 4;
                    const isPeak = m.month === seasonality.peak_month;
                    return (
                      <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: "100%", height, background: isPeak ? V.amber : `${V.ash}30`, borderRadius: "3px 3px 0 0", transition: "height 0.3s" }} />
                        <span style={{ fontSize: 8, color: isPeak ? V.night : V.ash, fontFamily: V.mono, fontWeight: isPeak ? 600 : 400 }}>{m.month?.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </Expandable>

        {/* Accordion 3 — Concorrência */}










        <Expandable title={`Concorrência — ${hasCi ? ci!.activeCompetitors + ' negócio' + (ci!.activeCompetitors !== 1 ? 's' : '') + (isNacional && ci!.activeCompetitors < 5 ? ' (parcial)' : ' mapeados') : 'mapeamento em andamento'}`} icon="">
          {hasCi ? (
            <div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px" }}>{ci!.activeCompetitors} negócio{ci!.activeCompetitors !== 1 ? 's' : ''} disputando atenção com você.</p>
              {isNacional && ci!.activeCompetitors < 5 && (
                <div style={{ fontSize: 10, color: V.ash, marginBottom: 8, padding: "6px 10px", background: V.fog, borderRadius: 6, lineHeight: 1.5 }}>
                  Mapeamento parcial — concorrência nacional é fragmentada. O plano completo traz análise detalhada.
                </div>
              )}
              {ci!.competitors.filter(c => c.hasWebsite || c.hasInstagram).slice(0, 6).map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: V.zinc, borderBottom: `1px solid ${V.fog}` }}>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  {(c as any).distanceKm != null && !isNacional && (
                    <span style={{ fontFamily: V.mono, fontSize: 9, color: V.zinc }}>{(c as any).distanceKm}km</span>
                  )}
                  {c.rating && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>★{c.rating}</span>}
                </div>
              ))}
              <div style={{ marginTop: 8, padding: "6px 10px", background: ci!.color === 'green' ? V.tealWash : ci!.color === 'yellow' ? V.amberWash : V.coralWash, borderRadius: 6, textAlign: "center" }}>
                <span style={{ fontFamily: V.mono, fontSize: 10, fontWeight: 600, color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral }}>{ci!.labelText}</span>
              </div>
            </div>
          ) : <p style={{ fontSize: 12, color: V.ash, margin: 0 }}>Dados indisponíveis.</p>}
        </Expandable>

        {/* Accordion B2B — Empresas no mercado (somente B2B) */}
        {isB2B && (results as any).b2bCompanies?.companies?.length > 0 && (
          <Expandable title={`🏢 Empresas no seu mercado — ${(results as any).b2bCompanies.totalInRegion} mapeadas`} icon="">

            <div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 10px", lineHeight: 1.5 }}>
                Empresas do mesmo setor na sua região, com decisores identificados. O Radar de Crescimento traz estratégias de abordagem.
              </p>
              {((results as any).b2bCompanies.companies as any[]).slice(0, 8).map((c: any, i: number) => {
                const contacts: any[] = Array.isArray(c.contacts) ? c.contacts : [];
                return (
                  <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: V.night, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.nomeFantasia || c.razaoSocial}
                        </div>
                        <div style={{ fontSize: 10, color: V.ash }}>
                          {c.porte !== 'N/I' && <span>{c.porte} · </span>}
                          {c.municipio}{c.uf ? ` - ${c.uf}` : ''}
                        </div>
                      </div>
                      {contacts.length > 0 && (
                        <span style={{ fontFamily: V.mono, fontSize: 9, color: V.teal, flexShrink: 0, background: V.tealWash, padding: "2px 6px", borderRadius: 4 }}>
                          {contacts.length} {contacts.length === 1 ? 'decisor' : 'decisores'}
                        </span>
                      )}
                    </div>
                    {contacts.length > 0 && (
                      <div style={{ marginTop: 8, paddingLeft: 4, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                        {contacts.slice(0, 3).map((k: any, ki: number) => (
                          <div key={ki} style={{ fontSize: 11, color: V.zinc, lineHeight: 1.4, paddingLeft: 8, borderLeft: `2px solid ${V.teal}33` }}>
                            <div style={{ fontWeight: 600, color: V.night }}>
                              {k.fullName || k.email.split('@')[0]}
                              {k.position && <span style={{ fontWeight: 400, color: V.ash }}> · {k.position}</span>}
                            </div>
                            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.teal }}>{k.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <p style={{ fontSize: 10, color: V.ash, margin: "10px 0 0", fontFamily: V.mono }}>
                Fontes: {(results as any).b2bCompanies.source}
                {(results.source || '').includes('hunter_contacts') && ' · Hunter.io'}
              </p>
            </div>
          </Expandable>
        )}

        {/* Accordion 4 — Seus indicadores */}
        <Expandable title="Seus indicadores" icon="">
          {fontesEncontradas.length > 0 || results.maps?.found || igData?.dataAvailable ? (
            <div>
              {/* Métricas comparativas quando disponíveis */}
              {results.maps?.found && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>Nota no Google</span>
                    <span style={{ color: V.night, fontWeight: 700 }}>★ {results.maps.rating || '—'}</span>
                  </div>
                  {competitorAvgRating > 0 && (
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>Média dos concorrentes: ★ {competitorAvgRating.toFixed(1)}</div>
                  )}
                </div>
              )}
              {results.maps?.reviewCount != null && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>Avaliações no Google</span>
                    <span style={{ color: V.night, fontWeight: 700 }}>{results.maps.reviewCount}</span>
                  </div>
                  {competitorAvgReviews > 0 && (
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>
                      Média dos concorrentes: {competitorAvgReviews} avaliações
                      {results.maps.reviewCount != null && competitorAvgReviews > 0 && (
                        <span style={{ color: results.maps.reviewCount > competitorAvgReviews ? V.teal : V.coral, fontWeight: 600 }}>
                          {' '}({results.maps.reviewCount > competitorAvgReviews ? '+' : ''}{Math.round(((results.maps.reviewCount / competitorAvgReviews) - 1) * 100)}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {(igData?.dataAvailable || igData?.handle) && (
                <>
                  <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: V.night, fontWeight: 600 }}>Seguidores Instagram</span>
                      <span style={{ color: V.night, fontWeight: 700 }}>{(igData.followers || 0).toLocaleString('pt-BR')}</span>
                    </div>
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>@{igData.handle}</div>
                  </div>
                  {igData.engagementRate > 0 && (
                    <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: V.night, fontWeight: 600 }}>Engajamento</span>
                        <span style={{ color: V.night, fontWeight: 700 }}>{(igData.engagementRate * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                  {(igData.recentPostsCount ?? igData.postsLast30d) > 0 && (
                    <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: V.night, fontWeight: 600 }}>Posts recentes</span>
                        <span style={{ color: V.night, fontWeight: 700 }}>{igData.recentPostsCount ?? igData.postsLast30d} nos últimos 15 dias</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              {results.aiVisibility?.likelyMentioned && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>Visibilidade em IA</span>
                    <span style={{ color: V.teal, fontWeight: 700 }}>Mencionado</span>
                  </div>
                </div>
              )}

              {/* Dados expandidos (fontes reais adicionais) */}
              {results.expandedData?.reclameAqui?.found && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>Reclame Aqui</span>
                    <span style={{ color: (results.expandedData!.reclameAqui!.score || 0) >= 7 ? V.teal : V.coral, fontWeight: 700 }}>
                      {results.expandedData!.reclameAqui!.score ?? '?'}/10 {results.expandedData!.reclameAqui!.reputation ? `· ${results.expandedData!.reclameAqui!.reputation}` : ''}
                    </span>
                  </div>
                </div>
              )}
              {results.expandedData?.ifood?.found && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>iFood</span>
                    <span style={{ color: V.teal, fontWeight: 700 }}>Encontrado</span>
                  </div>
                </div>
              )}
              {results.expandedData?.mercadoLivre?.found && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>Mercado Livre</span>
                    <span style={{ color: V.teal, fontWeight: 700 }}>
                      {results.expandedData.mercadoLivre.reputation?.ratings?.positive
                        ? `${results.expandedData.mercadoLivre.reputation.ratings.positive}% positiva`
                        : 'Encontrado'}
                    </span>
                  </div>
                  {(results.expandedData!.mercadoLivre!.reputation?.transactions || 0) > 0 && (
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>
                      {(results.expandedData!.mercadoLivre!.reputation!.transactions || 0).toLocaleString('pt-BR')} vendas
                    </div>
                  )}
                </div>
              )}
              {results.expandedData?.adsTransparency?.searched && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>Google Ads na SERP</span>
                    <span style={{ color: results.expandedData.adsTransparency.adsDetected ? V.amber : V.ash, fontWeight: 700 }}>
                      {results.expandedData.adsTransparency.termsWithAds}/{results.expandedData.adsTransparency.totalTerms} termos com ads
                    </span>
                  </div>
                </div>
              )}
              {results.expandedData?.seasonality?.source === 'google_trends_apify' && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>Sazonalidade</span>
                    <span style={{ color: V.amber, fontWeight: 700 }}>Pico: {results.expandedData.seasonality.bestMonths?.[0] || '—'}</span>
                  </div>
                  <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>
                    Fonte: Google Trends · Força: {results.expandedData.seasonality.seasonalityStrength}
                  </div>
                </div>
              )}
              {results.expandedData?.linkedin?.companyPage?.found && (
                <div style={{ padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: V.night, fontWeight: 600 }}>LinkedIn</span>
                    <span style={{ color: V.teal, fontWeight: 700 }}>Company page encontrada</span>
                  </div>
                </div>
              )}

              {/* Fontes consultadas */}
              {(results.expandedData?.sources?.length || 0) > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: V.ash, fontFamily: V.mono }}>
                  Fontes: {results.expandedData!.sources!.join(', ')}
                </div>
              )}

              {/* Oportunidades de melhoria removido — ações estão nos quick wins */}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.6 }}>
              Ainda não detectamos presença digital ativa. O plano vai construir sua base do zero.
            </p>
          )}
        </Expandable>

        {/* CTA inline final */}
        {!hideCTA && (
          <div style={{ background: "linear-gradient(135deg, #161618 0%, #2A2A30 100%)", borderRadius: 14, padding: "24px 20px", marginTop: 16, color: V.white, textAlign: "center" }}>
            <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, letterSpacing: "0.06em", marginBottom: 8 }}>RADAR DE CRESCIMENTO</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: V.white, margin: "0 0 8px" }}>
              Sua rota de crescimento em {shortRegion}
            </p>
            <p style={{ fontSize: 12, color: V.ash, margin: "0 0 16px", lineHeight: 1.5 }}>
              O diagnóstico acima é gratuito. O Radar monitora seu mercado toda semana, entrega <strong style={{ color: V.white }}>ações prontas com passo a passo</strong>, conteúdo pra copiar e colar, e acompanhamento da evolução do seu score.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: 6, marginBottom: 16 }}>
              {['Respostas pra reviews', 'Posts prontos', 'Bio otimizada', 'WhatsApp templates', 'Radar semanal', 'Score de evolução'].map((tag, i) => (
                <span key={i} style={{ fontSize: 9, fontWeight: 600, color: V.amber, background: "rgba(207,133,35,0.15)", padding: "3px 8px", borderRadius: 4 }}>{tag}</span>
              ))}
            </div>
            <p style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", margin: "0 0 4px" }}>CANCELE QUANDO QUISER</p>
            <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, margin: "0 0 12px" }}>R$ 247<span style={{ fontSize: 14, fontWeight: 400, color: V.ash }}>/mês</span></div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "center" }}>
              <input type="text" placeholder="Cupom" value={coupon}
                onChange={(e: any) => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); }}
                style={{ width: 120, padding: "8px 12px", borderRadius: 8, border: `1px solid ${V.slate}`, background: V.graphite, color: V.white, fontSize: 12, fontFamily: V.mono, outline: "none" }} />
              {coupon.length > 0 && (
                <button onClick={() => setCouponApplied(true)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: couponApplied ? V.teal : V.amber, color: V.white, fontSize: 11, fontFamily: V.mono, cursor: "pointer" }}>
                  {couponApplied ? "✓" : "Aplicar"}
                </button>
              )}
            </div>
            <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: V.amber, color: V.white, fontSize: 15, fontWeight: 700,
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Redirecionando..." : "Ativar meu Radar de Crescimento →"}
            </button>
            <p style={{ fontSize: 11, color: V.ash, margin: "8px 0 0" }}>Ativo em 2-3 minutos · sem fidelidade</p>
          </div>
        )}


        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0 0" }}>
          <p style={{ fontSize: 11, color: V.ash, fontStyle: "italic", lineHeight: 1.6, margin: "0 0 16px" }}>
            Resultado depende da execução. Virô dá a inteligência — a ação é sua.
          </p>
          <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.night }}>Virô</span>
          <p style={{ fontSize: 10, color: V.ash, fontFamily: V.mono, marginTop: 2 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
