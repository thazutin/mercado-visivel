"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";
// FeedbackWidget removido — será adicionado em outro momento da jornada
import { NelsonLogo } from "./NelsonLogo";
import { V, ICONS, PILAR_COLORS } from "@/lib/design-tokens";
import { trackEventClient } from "@/lib/events";

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
  honestReading?: string;
}
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; leadId?: string; hideCTA?: boolean; hideWorkRoutes?: boolean; name?: string; seasonality?: any; }

interface ReviewDraft {
  id: string;
  author_name: string;
  rating: number;
  review_text: string;
  review_date: string;
  draft_response: string;
  status: string;
}

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

  // Analytics: instant_value_viewed (tela de valor imediato após diagnóstico)
  useEffect(() => {
    trackEventClient({
      eventType: "instant_value_viewed",
      leadId,
      metadata: {
        product,
        region,
        influencePercent: (initialResults as any)?.influencePercent,
        enrichmentStatus: (initialResults as any)?.enrichmentStatus,
      },
    });
  }, [leadId, product, region, initialResults]);

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
  // IMPORTANTE: pra negócios NACIONAIS não pondera — mostra volume total
  const totalVolumeInt = (() => {
    if (isNacional) return totalVolumeRaw; // Nacional usa volume bruto
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

  // ─── Growth machine state (quick wins + pilares) ─────────────────
  const [quickWins, setQuickWins] = useState<any[]>([]);
  const [strategicPillars, setStrategicPillars] = useState<any[]>([]);
  const [qwLoading, setQwLoading] = useState(true);
  const [qwExpanded, setQwExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!leadId) { setQwLoading(false); return; }
    let cancelled = false;
    let postTriggered = false;

    const fetchQW = async (attempt: number) => {
      if (cancelled) return;
      try {
        // Tenta GET primeiro (GM já gerada?)
        const res = await fetch(`/api/growth-machine?leadId=${leadId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ready' && data.data?.quickWins?.length > 0) {
            if (!cancelled) {
              setQuickWins(data.data.quickWins);
              if (data.data.strategicPillars) setStrategicPillars(data.data.strategicPillars);
              setQwLoading(false);
            }
            return;
          }
        }
        // Primeira tentativa: dispara POST fire-and-forget (não aguarda)
        if (!postTriggered) {
          postTriggered = true;
          fetch('/api/growth-machine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId }),
          }).catch(() => { /* ignore — polling vai pegar */ });
        }
        // Polls por até ~3min (20 tentativas × 10s)
        if (attempt < 20 && !cancelled) {
          setTimeout(() => fetchQW(attempt + 1), 10000);
        } else if (!cancelled) {
          setQwLoading(false);
        }
      } catch {
        if (attempt < 20 && !cancelled) {
          setTimeout(() => fetchQW(attempt + 1), 10000);
        } else if (!cancelled) {
          setQwLoading(false);
        }
      }
    };

    // Primeira tentativa após 3s (pipeline precisa terminar antes)
    const timer = setTimeout(() => fetchQW(0), 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [leadId]);

  // ─── Review drafts state ─────────────────────────────────────────
  // Pulled from /api/reviews — alimentado pelo runPostDiagnosisEnrichment
  const [reviewDrafts, setReviewDrafts] = useState<ReviewDraft[]>([]);
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    const fetchReviews = async (attempt: number) => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/reviews?leadId=${leadId}`);
        if (res.ok) {
          const data = await res.json();
          const drafts = (data.reviews || []).filter((r: any) => r.draft_response);
          if (drafts.length > 0 && !cancelled) {
            setReviewDrafts(drafts);
            return;
          }
        }
      } catch { /* ignore */ }
      // Polling: enrichment async pode demorar 30-90s pra gerar drafts
      if (attempt < 12 && !cancelled) {
        setTimeout(() => fetchReviews(attempt + 1), 8000);
      }
    };
    const t = setTimeout(() => fetchReviews(0), 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [leadId]);

  // Score visual data
  const scoreAtual = results.influencePercent || 0;
  const scorePotencial = proj?.influenciaMeta ? Math.min(proj.influenciaMeta, 85) : Math.min(scoreAtual + 35, 85);

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "48px 20px", opacity: show ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* ═══════════════ HEADER ═══════════════ */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: V.display, fontSize: 18, fontWeight: 800, color: V.night, letterSpacing: "-0.02em" }}>
            Virô<span style={{ color: V.teal }}>.</span>
          </div>
          <div style={{ fontSize: 10, color: V.ash, fontFamily: V.mono, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginTop: 2 }}>
            DIAGNÓSTICO ESTRATÉGICO
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: V.night, margin: "0 0 4px", letterSpacing: "-0.02em" }}>{displayName}</h1>
          <p style={{ fontSize: 13, color: V.zinc, margin: 0 }}>{shortRegion}</p>
        </div>

        {/* Enrichment status */}
        {enriching && (
          <div style={{ background: V.amberWash, borderRadius: 10, padding: "10px 14px", marginBottom: 16, border: `1px solid rgba(180,83,9,0.15)`, fontSize: 12, color: V.amber, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, border: `2px solid ${V.fog}`, borderTopColor: V.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            <span>Coletando dados adicionais — a página atualiza sozinha.</span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* BLOCO 1 — ONDE VOCÊ ESTÁ HOJE                                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
            01 · onde você está hoje
          </div>
          <h2 style={{ fontFamily: V.display, fontSize: 22, fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 4px", lineHeight: 1.2 }}>
            Olha o que encontrei sobre o seu negócio.
          </h2>
          <p style={{ fontSize: 13, color: V.zinc, margin: "0 0 18px", lineHeight: 1.5 }}>
            Dados reais de Google, Instagram, IBGE, concorrentes e mercado. Sem chute.
          </p>

          {/* 1.1 — Mapa do raio competitivo */}
          {results.lat && results.lng && !isNacional && aud && (
            <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px", marginBottom: 12 }}>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 8 }}>
                📍 SEU RAIO COMPETITIVO · {aud.raioKm || raioKm}KM
              </div>
              <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${V.fog}`, marginBottom: 10 }}>
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${results.lat},${results.lng}&zoom=${(aud.raioKm || raioKm) <= 2 ? 15 : (aud.raioKm || raioKm) <= 5 ? 14 : 13}&size=560x220&scale=2&maptype=roadmap&markers=color:0xB45309%7Csize:mid%7C${results.lat},${results.lng}&path=color:0x0F766E80|weight:2|fillcolor:0x0F766E18|${generateCirclePath(results.lat, results.lng, aud.raioKm || raioKm)}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ''}`}
                  alt={`Raio de ${aud.raioKm || raioKm}km`}
                  style={{ width: "100%", height: "auto", display: "block" }}
                  loading="lazy"
                />
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                {fmtPop(audienciaTotal || audDisplayPop)} {audienciaUnit} no seu raio
                {aud.audienciaTarget > 0 && audienciaTotal !== audDisplayPop ? ` · ${fmtPop(audienciaTotal)} no seu mercado-alvo` : ''}
                {ci?.activeCompetitors ? ` · ${ci.activeCompetitors} concorrentes mapeados` : ''}.
              </p>
            </div>
          )}

          {/* 1.2 — Seu cartão de visita digital */}
          <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px", marginBottom: 12 }}>
            <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 12 }}>
              🪪 SEU CARTÃO DE VISITA DIGITAL
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Google Maps */}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 28, height: 28, borderRadius: 6, background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📍</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.night, marginBottom: 2 }}>Google Maps</div>
                  {results.maps?.found ? (
                    <div style={{ fontSize: 11, color: V.zinc, lineHeight: 1.5 }}>
                      ★ {results.maps.rating ?? '?'} · {results.maps.reviewCount ?? 0} avaliações · {results.maps.photos ?? 0} fotos
                      {(results.maps.photos ?? 0) < 5 && <span style={{ color: V.amber, marginLeft: 4 }}>⚠ poucas fotos</span>}
                      {(results.maps.reviewCount ?? 0) < 10 && <span style={{ color: V.amber, marginLeft: 4 }}>⚠ poucas reviews</span>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: V.coral, lineHeight: 1.5 }}>❌ não encontrado — concorrentes do raio já estão lá</div>
                  )}
                </div>
              </div>

              {/* Instagram */}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 28, height: 28, borderRadius: 6, background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📷</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.night, marginBottom: 2 }}>Instagram</div>
                  {igData?.dataAvailable ? (
                    <div style={{ fontSize: 11, color: V.zinc, lineHeight: 1.5 }}>
                      @{igData.handle} · {(igData.followers || 0).toLocaleString('pt-BR')} seg · {igData.recentPostsCount ?? igData.postsLast30d ?? 0} posts/30d · {(igData.engagementRate * 100).toFixed(1)}% eng
                      {(igData.recentPostsCount ?? igData.postsLast30d ?? 0) < 4 && <div style={{ color: V.amber, marginTop: 2 }}>⚠ frequência abaixo da média do setor (4-8/mês)</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: V.coral, lineHeight: 1.5 }}>❌ perfil não detectado ou sem atividade</div>
                  )}
                </div>
              </div>

              {/* Site */}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 28, height: 28, borderRadius: 6, background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🌐</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.night, marginBottom: 2 }}>Site / Search</div>
                  {(serpData?.termsRanked || 0) > 0 ? (
                    <div style={{ fontSize: 11, color: V.zinc, lineHeight: 1.5 }}>
                      Ranqueia para {serpData!.termsRanked} de {serpData!.termsScraped} termos buscados
                      {serpData!.hasLocalPack && <span style={{ color: V.teal, marginLeft: 4 }}>· aparece no pack local</span>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: V.coral, lineHeight: 1.5 }}>❌ não aparece em buscas pelos termos do seu mercado</div>
                  )}
                </div>
              </div>

              {/* Reclame Aqui (se houver) */}
              {results.expandedData?.reclameAqui?.found && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 6, background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🛡️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: V.night, marginBottom: 2 }}>Reclame Aqui</div>
                    <div style={{ fontSize: 11, color: (results.expandedData!.reclameAqui!.score || 0) >= 7 ? V.teal : V.coral, lineHeight: 1.5 }}>
                      {results.expandedData!.reclameAqui!.score ?? '?'}/10 · {results.expandedData!.reclameAqui!.reputation || 'sem reputação detectada'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 1.3 — Concorrentes em destaque */}
          {competitors.length > 0 && (
            <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px", marginBottom: 12 }}>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 12 }}>
                🔭 SEUS CONCORRENTES NO RADAR
              </div>
              {competitors.slice(0, 3).map((c: any, i: number) => (
                <div key={i} style={{ paddingBottom: i < Math.min(competitors.length, 3) - 1 ? 12 : 0, marginBottom: i < Math.min(competitors.length, 3) - 1 ? 12 : 0, borderBottom: i < Math.min(competitors.length, 3) - 1 ? `1px solid ${V.fog}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V.night }}>@{c.handle}</div>
                    <div style={{ fontFamily: V.mono, fontSize: 10, color: V.zinc }}>
                      {(c.followers || 0).toLocaleString('pt-BR')} seg
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: V.zinc, marginBottom: c.bio ? 6 : 0, lineHeight: 1.5 }}>
                    {c.postsLast30d || 0} posts/30d
                    {(c.engagementRate || 0) > 0 && ` · ${(c.engagementRate * 100).toFixed(1)}% engajamento`}
                    {c.reachRelative > 0 && ` · alcance ${(c.reachRelative * 100).toFixed(0)}% dos seg`}
                  </div>
                  {c.bio && (
                    <p style={{ fontSize: 11, color: V.ash, margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>
                      "{c.bio.slice(0, 110)}{c.bio.length > 110 ? '…' : ''}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 1.4 — Mercado em movimento */}
          {((results as any).macro_context || results.expandedData?.seasonality || results.pncp || seasonality) && (
            <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px", marginBottom: 12 }}>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 12 }}>
                🌡️ SEU MERCADO EM MOVIMENTO
              </div>
              {(results as any).macro_context?.summary && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: V.night, marginBottom: 4 }}>Macro</div>
                  <p style={{ fontSize: 11, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                    {(results as any).macro_context.summary.slice(0, 240)}{(results as any).macro_context.summary.length > 240 ? '…' : ''}
                  </p>
                </div>
              )}
              {(results.expandedData?.seasonality?.bestMonths?.length || (seasonality?.peak_month && seasonality.peak_month !== 'dados insuficientes')) && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: V.night, marginBottom: 4 }}>Sazonalidade</div>
                  <p style={{ fontSize: 11, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                    Pico de busca: {results.expandedData?.seasonality?.bestMonths?.[0] || seasonality?.peak_month}
                    {results.expandedData?.seasonality?.worstMonths?.[0] && ` · vale: ${results.expandedData.seasonality.worstMonths[0]}`}
                  </p>
                </div>
              )}
              {results.pncp?.totalEncontradas ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: V.night, marginBottom: 4 }}>Compra pública</div>
                  <p style={{ fontSize: 11, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                    {results.pncp.totalEncontradas} licitações relevantes em {results.pncp.orgaosUnicos} órgãos · R$ {(results.pncp.valorTotalEstimado / 1000).toFixed(0)}k em jogo.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* 1.5 — Leitura honesta */}
          {results.honestReading && (
            <div style={{ background: V.night, borderRadius: 12, padding: "18px 18px", marginBottom: 0 }}>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, letterSpacing: "0.08em", marginBottom: 10 }}>
                🪞 LEITURA HONESTA
              </div>
              <p style={{ fontSize: 13, color: V.white, margin: 0, lineHeight: 1.65 }}>
                {results.honestReading}
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* BLOCO 2 — TAMANHO DA OPORTUNIDADE                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
            02 · tamanho da oportunidade
          </div>
          <h2 style={{ fontFamily: V.display, fontSize: 22, fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 4px", lineHeight: 1.2 }}>
            Se você estimular o mercado, até onde dá pra ir?
          </h2>
          <p style={{ fontSize: 13, color: V.zinc, margin: "0 0 16px", lineHeight: 1.5 }}>
            Mapeamos sua audiência, demanda ativa e teto realista pros próximos 90 dias.
          </p>

          {(() => {
            const ringSize = 160;
            const ringStroke = 6;
            const ringRadius = (ringSize - ringStroke) / 2;
            const ringCirc = 2 * Math.PI * ringRadius;
            const ringOffset = ringCirc - (scoreAtual / 100) * ringCirc;
            return (
              <div style={{ background: V.white, borderRadius: 16, border: `1px solid ${V.fog}`, padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontFamily: V.display, fontSize: 14, fontWeight: 600, color: V.zinc, marginBottom: 16 }}>
                  Qual fatia do seu mercado você disputa hoje?
                </div>

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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
                  <div style={{ padding: "10px 6px", background: V.cloud, borderRadius: 8 }}>
                    <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 800, color: scoreAtual < 30 ? V.coral : scoreAtual < 50 ? V.amber : V.teal }}>{scoreAtual}</div>
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>Você hoje</div>
                  </div>
                  <div style={{ padding: "10px 6px", background: V.cloud, borderRadius: 8 }}>
                    <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 800, color: V.amber }}>{scorePotencial}</div>
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>Realizável em 90d</div>
                  </div>
                  <div style={{ padding: "10px 6px", background: V.cloud, borderRadius: 8 }}>
                    <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 800, color: V.zinc }}>
                      {competitorAvgRating > 0 ? Math.round(competitorAvgRating * 10) : '35'}
                    </div>
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>Média setor</div>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: V.night, margin: "14px 0 0", lineHeight: 1.6 }}>
                  {`Hoje você disputa ${scoreAtual}% da atenção do seu mercado. Com presença ativa, chegar a ${scorePotencial}% é viável em 90 dias.`}
                </p>

                {oportunidade > 0 && (
                  <p style={{ fontSize: 13, color: V.teal, margin: "10px 0 0", fontWeight: 700, lineHeight: 1.5 }}>
                    Isso significa +{oportunidade.toLocaleString('pt-BR')} {isB2B ? 'empresas' : 'pessoas'} considerando você por mês.
                  </p>
                )}
                {hasProj && proj && (
                  <p style={{ fontSize: 11, color: V.zinc, margin: "8px 0 0", lineHeight: 1.5 }}>
                    Em receita: ~R${(proj.receitaAtual / 1000).toFixed(0)}k/mês hoje → ~R${(proj.receitaPotencial / 1000).toFixed(0)}k/mês potencial.
                  </p>
                )}

                {nenhumEncontrado && (
                  <p style={{ fontSize: 11, color: V.coral, margin: "12px 0 0" }}>
                    Nenhuma presença digital detectada — partindo do zero.
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* BLOCO 3 — 3 TESES DE CRESCIMENTO (DESBLOQUEADO)              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {strategicPillars.length > 0 ? (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
              03 · teses de crescimento
            </div>
            <h2 style={{ fontFamily: V.display, fontSize: 22, fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 4px", lineHeight: 1.2 }}>
              3 apostas que mudam de patamar.
            </h2>
            <p style={{ fontSize: 13, color: V.zinc, margin: "0 0 16px", lineHeight: 1.5 }}>
              Não são tarefas básicas — são alavancas estratégicas baseadas no seu desafio e nos dados do mercado.
            </p>

            {strategicPillars.slice(0, 3).map((pillar: any, pi: number) => (
              <div key={pillar.id || pi} style={{
                background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`,
                overflow: "hidden", marginBottom: 12,
              }}>
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: V.amber, background: V.amberWash, padding: "3px 10px", borderRadius: 100, fontFamily: V.mono, letterSpacing: "0.04em" }}>
                      TESE {pi + 1}
                    </span>
                    {pillar.timeline && (
                      <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, background: V.fog, padding: "2px 8px", borderRadius: 100 }}>
                        {pillar.timeline}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 700, color: V.night, marginBottom: 6, letterSpacing: "-0.01em" }}>{pillar.title}</div>

                  <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 12px", lineHeight: 1.6 }}>
                    <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginRight: 6 }}>POR QUÊ:</span>
                    {pillar.description}
                  </p>

                  {/* Meta + KPI */}
                  {(pillar.targetMetric || pillar.kpi?.target) && (
                    <div style={{ background: V.tealWash, borderRadius: 8, padding: "8px 10px", marginBottom: 10, borderLeft: `3px solid ${V.teal}` }}>
                      <div style={{ fontFamily: V.mono, fontSize: 9, color: V.teal, letterSpacing: "0.06em", marginBottom: 2 }}>META</div>
                      <div style={{ fontSize: 12, color: V.night, fontWeight: 600, lineHeight: 1.5 }}>
                        {pillar.targetMetric || pillar.kpi?.target}
                      </div>
                    </div>
                  )}

                  {/* Recursos + Riscos */}
                  {(pillar.resources || pillar.risks) && (
                    <div style={{ display: "grid", gridTemplateColumns: pillar.resources && pillar.risks ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 12 }}>
                      {pillar.resources && (
                        <div style={{ background: V.cloud, borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 2 }}>RECURSOS</div>
                          <div style={{ fontSize: 11, color: V.night, lineHeight: 1.4 }}>{pillar.resources}</div>
                        </div>
                      )}
                      {pillar.risks && (
                        <div style={{ background: V.cloud, borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 2 }}>RISCOS</div>
                          <div style={{ fontSize: 11, color: V.night, lineHeight: 1.4 }}>{pillar.risks}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Etapas executáveis */}
                  {pillar.items && pillar.items.length > 0 && (
                    <div>
                      <div style={{ fontFamily: V.mono, fontSize: 9, color: V.night, letterSpacing: "0.06em", marginBottom: 8, fontWeight: 600 }}>
                        COMO EXECUTAR
                      </div>
                      {pillar.items.slice(0, 4).map((item: any, ii: number) => {
                        const itemKey = `${pillar.id}-${item.id || ii}`;
                        const isOpen = qwExpanded[itemKey];
                        return (
                          <div key={ii} style={{ marginBottom: 8, borderLeft: `2px solid ${V.fog}`, paddingLeft: 10 }}>
                            <button
                              onClick={() => setQwExpanded(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", display: "flex", gap: 8, alignItems: "flex-start" }}
                            >
                              <span style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, background: V.amberWash, borderRadius: 3, padding: "1px 6px", flexShrink: 0, marginTop: 1 }}>{ii + 1}</span>
                              <span style={{ fontSize: 12, color: V.night, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{item.title}</span>
                              <span style={{ fontSize: 11, color: V.ash, flexShrink: 0 }}>{isOpen ? '▴' : '▾'}</span>
                            </button>
                            {isOpen && item.content && (
                              <div style={{ marginTop: 8, background: V.cloud, borderRadius: 6, padding: "10px 12px", borderLeft: `3px solid ${V.amber}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <span style={{ fontFamily: V.mono, fontSize: 8, color: V.amber, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                                    {item.type === 'copy' ? 'TEXTO PRONTO' : item.type === 'script' ? 'SCRIPT' : item.type === 'template' ? 'TEMPLATE' : item.type === 'checklist' ? 'CHECKLIST' : 'CONTEÚDO'}
                                  </span>
                                  {item.copyable && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.content); }}
                                      style={{ fontSize: 10, color: V.teal, background: V.tealWash, border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}
                                    >
                                      Copiar
                                    </button>
                                  )}
                                </div>
                                <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.content}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Ferramentas */}
                  {pillar.tools && pillar.tools.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${V.fog}` }}>
                      <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 6 }}>FERRAMENTAS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {pillar.tools.slice(0, 6).map((tool: string, ti: number) => (
                          <span key={ti} style={{ fontSize: 10, color: V.zinc, background: V.cloud, padding: "3px 8px", borderRadius: 4, fontFamily: V.mono }}>
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ background: V.cloud, borderRadius: 10, padding: "12px 14px", marginTop: 4, fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>
              <strong style={{ color: V.night }}>Seu plano completo, gratuito.</strong> Ative o Radar pra que essas teses
              evoluam toda semana com sinais do seu mercado e ação principal conectada.
            </div>
          </div>
        ) : qwLoading ? (
          <div style={{ marginBottom: 28, background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "32px 20px", textAlign: "center", color: V.ash, fontSize: 13 }}>
            <span style={{ display: "inline-block", width: 16, height: 16, border: `2px solid ${V.fog}`, borderTopColor: V.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 10, verticalAlign: "middle" }} />
            Montando suas 3 teses de crescimento (1-3 min)…
          </div>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* BLOCO 4 — MANTENHA O BÁSICO EM DIA                           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
            04 · mantenha o básico em dia
          </div>
          <h2 style={{ fontFamily: V.display, fontSize: 22, fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 4px", lineHeight: 1.2 }}>
            O que não pode falhar — toda semana.
          </h2>
          <p style={{ fontSize: 13, color: V.zinc, margin: "0 0 16px", lineHeight: 1.5 }}>
            Itens executáveis hoje. Cada um tem o passo a passo e o texto pronto.
          </p>

          {qwLoading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: V.ash, fontSize: 12 }}>
              <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${V.fog}`, borderTopColor: V.teal, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 8, verticalAlign: "middle" }} />
              Montando seu checklist personalizado...
            </div>
          ) : quickWins.length > 0 ? (
            <>
              {quickWins.map((qw: any) => {
                const isReviews = qw.id === 'qw-reviews' || qw.type === 'responder_reviews';
                const isOpen = qwExpanded[qw.id];
                return (
                  <div key={qw.id} style={{ background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`, padding: "14px 16px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: V.night, lineHeight: 1.4 }}>
                        <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${V.fog}`, marginRight: 8, verticalAlign: "middle" }}></span>
                        {qw.title}
                      </span>
                      <span style={{ fontFamily: V.mono, fontSize: 9, padding: "2px 6px", borderRadius: 100, background: V.fog, color: V.ash, flexShrink: 0 }}>{qw.timeEstimate}</span>
                    </div>
                    <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px", paddingLeft: 22, lineHeight: 1.5 }}>{qw.description}</p>

                    <div style={{ paddingLeft: 22, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {qw.impact && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: V.teal, background: "rgba(45,155,131,0.08)", padding: "2px 8px", borderRadius: 4 }}>
                          {(qw.impact || '').replace(/\s*(Visibilidade|Credibilidade|Presença Digital|Fidelização|Receita|Alcance|Expansão|Validação|Oportunidade|Estratégia|Diferenciação|Prospecção|Inteligência|Engajamento|Presença|Autoridade|Conversão|Presença B2B|Inteligência Competitiva|Prospecção Setorial|Descoberta Digital|Visibilidade Paga|Score Geral|Receita B2G)\s*/i, '')}
                        </span>
                      )}
                      {(qw.steps || qw.copyReady || (isReviews && reviewDrafts.length > 0)) && (
                        <button onClick={() => setQwExpanded(prev => ({ ...prev, [qw.id]: !prev[qw.id] }))} style={{ fontSize: 11, color: V.amber, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>
                          {isOpen ? "Ocultar ▴" : isReviews && reviewDrafts.length > 0 ? `Ver ${reviewDrafts.length} respostas prontas ▾` : "Ver como fazer ▾"}
                        </button>
                      )}
                    </div>

                    {isOpen && (
                      <div style={{ marginTop: 12, paddingLeft: 22 }}>
                        {/* Steps */}
                        {qw.steps && qw.steps.length > 0 && (
                          <div style={{ marginBottom: isReviews && reviewDrafts.length > 0 ? 14 : 0 }}>
                            {qw.steps.map((step: string, si: number) => (
                              <div key={si} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                                <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, background: V.fog, borderRadius: 4, padding: "1px 6px", flexShrink: 0, marginTop: 2 }}>{si + 1}</span>
                                <span style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>{step}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Copy ready genérico */}
                        {qw.copyReady && (
                          <div style={{ background: V.cloud, borderRadius: 6, padding: "10px 12px", borderLeft: `3px solid ${V.amber}`, marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, letterSpacing: "0.06em" }}>TEXTO PRONTO</span>
                              <button onClick={() => navigator.clipboard.writeText(qw.copyReady)} style={{ fontSize: 10, color: V.teal, background: V.tealWash, border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}>
                                Copiar
                              </button>
                            </div>
                            <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{qw.copyReady}</p>
                          </div>
                        )}

                        {/* Reviews inline com drafts */}
                        {isReviews && reviewDrafts.length > 0 && (
                          <div>
                            <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", marginBottom: 8 }}>
                              SUAS AVALIAÇÕES SEM RESPOSTA
                            </div>
                            {reviewDrafts.map((r) => (
                              <div key={r.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${V.fog}` }}>
                                <div style={{ fontSize: 11, color: V.ash, marginBottom: 4 }}>
                                  {'⭐'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))} · {r.author_name || 'Cliente'}
                                  {r.review_date && ` · ${new Date(r.review_date).toLocaleDateString('pt-BR')}`}
                                </div>
                                {r.review_text && (
                                  <p style={{ fontSize: 12, color: V.zinc, fontStyle: "italic", margin: "0 0 8px", lineHeight: 1.5 }}>
                                    "{r.review_text.slice(0, 220)}{r.review_text.length > 220 ? '…' : ''}"
                                  </p>
                                )}
                                <div style={{ background: V.cloud, borderRadius: 6, padding: "10px 12px", borderLeft: `3px solid ${V.amber}` }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, letterSpacing: "0.06em" }}>RESPOSTA PRONTA</span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(r.draft_response);
                                        fetch('/api/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, status: 'copied' }) }).catch(() => {});
                                      }}
                                      style={{ fontSize: 10, color: V.teal, background: V.tealWash, border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}
                                    >
                                      Copiar
                                    </button>
                                  </div>
                                  <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.draft_response}</p>
                                </div>
                              </div>
                            ))}
                            <p style={{ fontSize: 10, color: V.ash, margin: "8px 0 0", fontStyle: "italic" }}>
                              Onde responder: business.google.com → Reviews
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : null}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SEU MERCADO EM DETALHE — accordions com dados profundos      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6, marginTop: 8 }}>
          + · seu mercado em detalhe
        </div>
        <p style={{ fontSize: 13, color: V.zinc, margin: "0 0 14px", lineHeight: 1.5 }}>
          Os dados que ancoram tudo acima. Abra o que te interessa.
        </p>

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
              {isNacional || results.demandType === 'ecommerce_national' || results.demandType === 'national_service'
                ? `Volumes nacionais do seu setor. Estimativa de alcance orgânico possível com posicionamento adequado.`
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

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* BLOCO 5 — CTA Radar (contextualizado)                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {!hideCTA && (
          <div id="cta-radar" style={{ marginTop: 28 }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
              05 · receba isso atualizado toda semana
            </div>
            <h2 style={{ fontFamily: V.display, fontSize: 22, fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 4px", lineHeight: 1.2 }}>
              Tudo acima é seu, pra sempre. O Radar adiciona o tempo.
            </h2>
            <p style={{ fontSize: 13, color: V.zinc, margin: "0 0 16px", lineHeight: 1.5 }}>
              Marketing não é evento, é cadência. O Radar acompanha você semana a semana — pelo WhatsApp,
              como uma consultora estratégica que conhece seu negócio.
            </p>

            <div style={{ background: V.night, borderRadius: 14, padding: "22px 22px", color: V.white }}>
              <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📡</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V.white, marginBottom: 2 }}>Sinais da semana</div>
                    <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>
                      Toda sexta: o que seus concorrentes fizeram, o que mudou no seu próprio negócio,
                      o que pesa no macro do seu setor.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🎯</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V.white, marginBottom: 2 }}>Ação principal da semana</div>
                    <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>
                      Uma aposta conectada às suas 3 teses, evolutiva — ganha complexidade conforme
                      você executa e me conta o que funcionou.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💬</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V.white, marginBottom: 2 }}>Consultora no seu WhatsApp</div>
                    <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>
                      Sexta abre a semana, terça check-in, quinta fecha. Você responde quando puder —
                      eu carrego todo o seu contexto e respondo como quem conhece o negócio.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🧠</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V.white, marginBottom: 2 }}>Memória que cresce com você</div>
                    <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>
                      Cada ação executada vira aprendizado registrado. Em 3 meses, sua Virô sabe o que
                      funciona pro seu negócio específico — não o genérico.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${V.graphite}`, paddingTop: 16 }}>
                <p style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", margin: "0 0 4px", textAlign: "center" }}>CANCELE QUANDO QUISER · SEM FIDELIDADE</p>
                <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 700, margin: "0 0 14px", textAlign: "center", letterSpacing: "-0.02em" }}>
                  R$ 247<span style={{ fontSize: 14, fontWeight: 400, color: V.ash }}>/mês</span>
                </div>
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
                <p style={{ fontSize: 11, color: V.ash, margin: "8px 0 0", textAlign: "center" }}>Ativo em 2-3 minutos</p>
              </div>
            </div>
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
