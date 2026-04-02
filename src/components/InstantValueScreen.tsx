"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";
import FeedbackWidget from "./FeedbackWidget";
import { NelsonLogo } from "./NelsonLogo";
import { V } from "@/lib/design-tokens";

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
}
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; leadId?: string; hideCTA?: boolean; hideWorkRoutes?: boolean; name?: string; }

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

export default function InstantValueScreen({ product, region, results: initialResults, onCheckout, loading, leadId, hideCTA, hideWorkRoutes, name }: Props) {
  const [show, setShow] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [results, setResults] = useState(initialResults);
  const [enriching, setEnriching] = useState(
    (initialResults as any).enrichmentStatus === 'pending'
  );
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

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
  const isB2B = results.clientType === 'b2b' || results.demandType === 'national_service'
    || (results.projecaoFinanceira?.demandType === 'national_service');
  const isB2G = results.clientType === 'b2g';
  const isNacional = /brasil|nacional/i.test(results.audiencia?.municipioNome || '');
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

  // Pilar status indicators
  const pilar1Status = !results.maps?.found
    ? { text: "⚠️ Não encontrado no Google Maps — primeira ação", bg: V.coralWash, color: V.coral }
    : !results.maps?.inLocalPack
    ? { text: "📍 No Maps mas fora do top 3", bg: V.amberWash, color: V.amber }
    : { text: "✅ Visível no Google Maps", bg: V.tealWash, color: V.teal };
  const pilar2Status = (results.maps?.reviewCount || 0) < 10
    ? { text: "⚠️ Poucas avaliações — prioridade alta", bg: V.coralWash, color: V.coral }
    : (results.maps?.rating || 0) >= 4.0
    ? { text: "✅ Boa reputação base", bg: V.tealWash, color: V.teal }
    : { text: "📍 Avaliações precisam melhorar", bg: V.amberWash, color: V.amber };
  const pilar3Status = !igData?.dataAvailable || (igData?.recentPostsCount ?? 0) === 0
    ? { text: "⚠️ Presença digital parada", bg: V.coralWash, color: V.coral }
    : { text: "✅ Presença ativa", bg: V.tealWash, color: V.teal };

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
    { icon: "🔍", label: "Visibilidade", score: Math.round(d1f), color: V.teal, dim: "descoberta",
      detail: results.maps?.found ? `Maps: ★ ${results.maps.rating} · ${results.maps.reviewCount} avaliações` : "Não encontrado no Google Maps",
      status: pilar1Status, fallback: "Otimizar perfil no Google Meu Negócio com fotos e descrição completa" },
    { icon: "⭐", label: "Credibilidade", score: Math.round((d2f + d4f) / 2), color: V.amber, dim: "credibilidade",
      detail: results.maps?.reviewCount ? `${results.maps.reviewCount} avaliações · ★ ${results.maps.rating}` : "Sem avaliações detectadas",
      status: pilar2Status, fallback: "Solicitar avaliações dos últimos 20 clientes via WhatsApp" },
    { icon: "📣", label: "Presença Digital", score: Math.round(d3f), color: "#8B5CF6", dim: "presenca",
      detail: igData?.handle ? `@${igData.handle} · ${igData.followers?.toLocaleString('pt-BR')} seguidores` : "Presença digital não detectada",
      status: pilar3Status, fallback: "Publicar 2 posts/semana respondendo dúvidas frequentes do seu público" },
  ];

  // Volumes inteiros (P8 fix) + check se todos iguais (P9 fix)
  const totalVolumeInt = Math.round(results.totalVolume || 0);
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

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "48px 20px", opacity: show ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <NelsonLogo size={48} />
          </div>
          <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>{displayName} · {shortRegion}</p>
        </div>

        {/* Chips de fontes */}
        {fontesEncontradas.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, justifyContent: "center", marginBottom: 16 }}>
            {fontesEncontradas.map((fonte: any, i: number) => (
              <span key={i} style={{ fontSize: 10, color: V.night, background: V.white, borderRadius: 6, padding: "3px 8px", border: `1px solid ${V.fog}` }}>
                ✓ {fonte.label}
              </span>
            ))}
          </div>
        )}
        {nenhumEncontrado && (
          <div style={{ background: "#FFF3E0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, border: "1px solid #FFB74D", fontSize: 12, color: "#BF360C", lineHeight: 1.5 }}>
            Não encontramos seu negócio online. O plano parte do zero.
          </div>
        )}
        {enriching && (
          <div style={{ background: V.amberWash, borderRadius: 10, padding: "10px 14px", marginBottom: 16, border: `1px solid rgba(180,83,9,0.15)`, fontSize: 12, color: V.amber, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, border: `2px solid ${V.fog}`, borderTopColor: V.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            Coletando dados de Instagram, posicionamento no Google e visibilidade em IA. Atualizamos automaticamente.
          </div>
        )}

        {/* ═══════════════ BLOCO 1 — OPORTUNIDADE ═══════════════ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: V.night, borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 16 }}>
              Oportunidade identificada
            </div>
            {nenhumEncontrado ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 900, color: V.ash, lineHeight: 1, fontFamily: V.display, marginBottom: 8 }}>
                  Começando do zero
                </div>
                <div style={{ fontSize: 14, color: V.mist, lineHeight: 1.5, maxWidth: 280, margin: "0 auto 14px" }}>
                  Seu negócio ainda não tem presença digital detectável.
                  <strong style={{ color: V.white }}> O plano mostra por onde começar.</strong>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 64, fontWeight: 900, color: V.teal, lineHeight: 1, fontFamily: V.display, letterSpacing: "-0.03em", marginBottom: 8 }}>
                  +{oportunidade > 0 ? oportunidade.toLocaleString('pt-BR') : '—'}
                </div>
                <div style={{ fontSize: 15, color: V.mist, lineHeight: 1.5, maxWidth: 300, margin: "0 auto 16px" }}>
                  {isB2B ? 'empresas' : 'pessoas'} a mais por mês conhecendo o seu negócio
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══════════════ BLOCO 2 — RÉGUA VOCÊ ESTÁ AQUI ═══════════════ */}
        {!nenhumEncontrado && (
          <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "20px 18px", marginBottom: 16 }}>
            <div style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.night, marginBottom: 14, textAlign: "center" }}>
              Qual fatia do seu mercado você disputa hoje?
            </div>
            {(() => {
              const atual = results.influencePercent || 0;
              // Usar influenciaMeta do pipeline (baseado em alavancas reais) em vez de +35 fixo
              const potencial = proj?.influenciaMeta
                ? Math.min(proj.influenciaMeta, 85)
                : Math.min(atual + 35, 85);
              return (
                <div style={{ position: "relative", padding: "0 8px" }}>
                  {/* Régua */}
                  <div style={{ position: "relative", height: 8, background: V.fog, borderRadius: 4, overflow: "visible" }}>
                    {/* Faixa preenchida até potencial */}
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${V.teal} ${(atual / potencial) * 100}%, ${V.amberSoft} 100%)`, width: `${potencial}%`, transition: "width 0.8s ease" }} />
                    {/* Marcador atual */}
                    <div style={{ position: "absolute", left: `${atual}%`, top: -6, transform: "translateX(-50%)", width: 20, height: 20, borderRadius: "50%", background: V.teal, border: `3px solid ${V.white}`, boxShadow: "0 1px 4px rgba(0,0,0,0.15)", zIndex: 2 }} />
                    {/* Marcador potencial */}
                    <div style={{ position: "absolute", left: `${potencial}%`, top: -4, transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: V.white, border: `2px dashed ${V.amber}`, zIndex: 1 }} />
                  </div>
                  {/* Labels — extremos opostos, nunca sobrepõem */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16, gap: 24 }}>
                    <div>
                      <span style={{ fontFamily: V.display, fontSize: 20, fontWeight: 800, color: V.teal }}>{atual}</span>
                      <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, marginLeft: 6 }}>Você hoje</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, marginRight: 6 }}>Potencial</span>
                      <span style={{ fontFamily: V.display, fontSize: 20, fontWeight: 800, color: V.amber }}>{potencial}</span>
                    </div>
                  </div>
                  {/* Escala 0 e 100 */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontFamily: V.mono, fontSize: 9, color: V.mist }}>0</span>
                    <span style={{ fontFamily: V.mono, fontSize: 9, color: V.mist }}>100</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══════════════ BLOCO 3 — COMO CHEGAR LÁ ═══════════════ */}
        <div style={{ fontSize: 13, fontWeight: 600, color: V.amber, marginBottom: 8, paddingLeft: 4, marginTop: 8 }}>
          Como chegar lá
        </div>

        <div style={{ fontSize: 11, color: V.ash, marginBottom: 12, paddingLeft: 4, lineHeight: 1.5 }}>
          Estas são as alavancas do seu mercado. O plano completo traz ações específicas para o seu negócio, na ordem certa.
        </div>

        {pilarCards.map((p, i) => {
          const lever = allLevers.find((l: any) => l.dimension === p.dim || (p.dim === 'credibilidade' && l.dimension === 'reputacao'));
          const pilarPotencial = Math.min(p.score + 35, 85);
          return (
            <div key={i} style={{ background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: V.night }}>{p.icon} {p.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{p.score}</span>
              </div>
              {/* Mini-régua do pilar */}
              <div style={{ position: "relative", height: 4, background: V.fog, borderRadius: 2, marginBottom: 8, overflow: "visible" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${p.color} ${(p.score / pilarPotencial) * 100}%, ${V.amberSoft} 100%)`, width: `${pilarPotencial}%`, transition: "width 0.6s ease" }} />
                <div style={{ position: "absolute", left: `${p.score}%`, top: -3, transform: "translateX(-50%)", width: 10, height: 10, borderRadius: "50%", background: p.color, border: `2px solid ${V.white}`, boxShadow: "0 0 2px rgba(0,0,0,0.15)", zIndex: 2 }} />
                <div style={{ position: "absolute", left: `${pilarPotencial}%`, top: -2, transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: V.white, border: `1.5px dashed ${V.amber}`, zIndex: 1 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: V.mono, fontSize: 8, color: V.ash }}>Hoje: {p.score}</span>
                <span style={{ fontFamily: V.mono, fontSize: 8, color: V.amber }}>Meta: {pilarPotencial}</span>
              </div>
              <p style={{ fontSize: 12, color: V.night, margin: "0 0 6px", lineHeight: 1.5, fontWeight: 500 }}>{lever?.action || p.fallback}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ padding: "4px 8px", background: p.status.bg, borderRadius: 4, fontSize: 10, color: p.status.color, fontWeight: 500 }}>{p.status.text}</div>
                <span style={{ fontSize: 9, color: V.ash, fontFamily: V.mono }}>1 de 5 ações no plano</span>
              </div>
            </div>
          );
        })}

        {/* CTA intermediário após pilares */}
        {!hideCTA && (
          <div style={{ background: V.night, borderRadius: 10, padding: "16px", marginBottom: 16, marginTop: 8, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: V.mist, margin: "0 0 10px", lineHeight: 1.5 }}>
              O diagnóstico gratuito mostra uma ação por pilar. O plano completo traz 15 ações priorizadas, na ordem certa, e com conteúdo pronto para você copiar e colar nos canais.
            </p>
            <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
              width: "100%", padding: "12px", borderRadius: 8, border: "none",
              background: V.amber, color: V.white, fontSize: 14, fontWeight: 700,
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Redirecionando..." : "Gerar meu plano de ação →"}
            </button>
          </div>
        )}

        {/* ═══════════════ BLOCO 4 — POR QUE ACREDITAMOS ═══════════════ */}
        <div style={{ fontSize: 13, fontWeight: 600, color: V.amber, marginBottom: 8, paddingLeft: 4, marginTop: 16 }}>
          Por que acreditamos nessa oportunidade?
        </div>

        {/* Resumo antes dos acordeões */}
        {(() => {
          const competitorCount = ci?.activeCompetitors || 0;
          const parts: string[] = [];
          if (audienciaTotal > 0) parts.push(`Seu mercado potencial é de ${fmtPop(audienciaTotal)} ${audienciaUnit}.`);
          else if (hasVolume && isB2B) parts.push(`Há demanda ativa de ${fmtPop(totalVolumeInt)} buscas/mês no seu segmento.`);
          if (hasVolume && audienciaTotal > 0) parts.push(`Há ${fmtPop(totalVolumeInt)} buscas ativas por mês com intenção de compra.`);
          if (competitorCount > 0) parts.push(`Você compete com ${competitorCount} negócio${competitorCount !== 1 ? 's' : ''} por essa atenção.`);










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
                <span style={{ color: "white", fontWeight: 700, fontSize: 18 }}>{(product || "N")[0].toUpperCase()}</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{product}</div>
                <div style={{ fontSize: 11, color: V.ash }}>★ {results.maps.rating} · {results.maps.reviewCount} avaliações</div>
              </div>
            </div>
          )}
          {aud && aud.populacaoRaio > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                <span style={{ fontSize: 12, color: V.zinc }}>{isB2B && isNacional ? 'Empresas no mercado-alvo' : isB2B ? 'Base de empresas' : `Pessoas no raio de ${aud.raioKm || raioKm}km`}</span>
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
                Empresas do mesmo setor na sua região. O plano de ação traz estratégias de abordagem.
              </p>
              {((results as any).b2bCompanies.companies as any[]).slice(0, 8).map((c: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${V.fog}`, fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: V.night, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.nomeFantasia || c.razaoSocial}
                    </div>
                    <div style={{ fontSize: 10, color: V.ash }}>
                      {c.porte !== 'N/I' && <span>{c.porte} · </span>}
                      {c.municipio}{c.uf ? ` - ${c.uf}` : ''}
                    </div>
                  </div>
                  {c.email && (
                    <span style={{ fontFamily: V.mono, fontSize: 9, color: V.teal, flexShrink: 0 }}>✉</span>
                  )}
                </div>
              ))}
              <p style={{ fontSize: 10, color: V.ash, margin: "10px 0 0", fontFamily: V.mono }}>
                Fonte: {(results as any).b2bCompanies.source}
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
              {igData?.dataAvailable && (
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

              {/* Oportunidades */}
              {(() => {
                const oportunidades = [...pilarCards].sort((a, b) => a.score - b.score).slice(0, 2);
                return oportunidades.length > 0 && oportunidades[0].score < 50 ? (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${V.fog}` }}>
                    <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 }}>Oportunidades de melhoria</div>
                    {oportunidades.map((p, i) => (
                      <div key={`opp-${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < oportunidades.length - 1 ? `1px solid ${V.fog}` : "none", fontSize: 12 }}>
                        <span style={{ color: V.night }}>{p.label}</span>
                        <span style={{ fontWeight: 700, color: p.score < 30 ? V.coral : V.amber }}>{p.score}/100</span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.6 }}>
              Ainda não detectamos presença digital ativa. O plano vai construir sua base do zero.
            </p>
          )}
        </Expandable>

        {/* CTA inline */}
        {!hideCTA && (
          <div style={{ background: V.night, borderRadius: 12, padding: "20px 16px", marginTop: 12, color: V.white, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: V.mist, margin: "0 0 12px", lineHeight: 1.5 }}>
              As recomendações acima funcionam para qualquer negócio. O plano abaixo foi gerado para <strong style={{ color: V.white }}>{product}</strong> em <strong style={{ color: V.white }}>{shortRegion}</strong> — com os gaps reais do seu mercado, na ordem certa.
            </p>
            <p style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", margin: "0 0 4px" }}>PAGAMENTO ÚNICO</p>
            <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, margin: "0 0 12px" }}>R$ 497</div>
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
              {loading ? "Redirecionando..." : "Gerar meu plano de ação →"}
            </button>
            <p style={{ fontSize: 11, color: V.ash, margin: "8px 0 0" }}>Pronto em 2-3 minutos · pagamento único</p>
          </div>
        )}


        {/* Feedback */}
        {leadId && (
          <div style={{ marginTop: 8, marginBottom: 12 }}>
            <FeedbackWidget leadId={leadId} triggerPoint="post_instant_value" />
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
