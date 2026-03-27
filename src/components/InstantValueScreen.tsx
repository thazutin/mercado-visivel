"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";
import FeedbackWidget from "./FeedbackWidget";

const V = {
  night: "#161618", graphite: "#232326", slate: "#3A3A40",
  zinc: "#6E6E78", ash: "#9E9EA8", mist: "#C8C8D0",
  fog: "#EAEAEE", cloud: "#F4F4F7", white: "#FEFEFF",
  amber: "#CF8523", amberSoft: "#E6A445",
  amberWash: "rgba(207,133,35,0.08)",
  teal: "#2D9B83", tealWash: "rgba(45,155,131,0.08)",
  coral: "#D9534F", coralWash: "rgba(217,83,79,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

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
  } | null;
}
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; leadId?: string; hideCTA?: boolean; hideWorkRoutes?: boolean; }

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

export default function InstantValueScreen({ product, region, results, onCheckout, loading, leadId, hideCTA, hideWorkRoutes }: Props) {
  const [show, setShow] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

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
  const isB2B = results.clientType === 'b2b';
  const isB2G = results.clientType === 'b2g';
  const audienciaLabel = isB2G ? 'órgãos públicos potenciais' : isB2B ? 'empresas no seu mercado' : 'pessoas no seu mercado';
  const audienciaUnit = isB2G ? 'órgãos' : isB2B ? 'empresas' : 'pessoas';

  // Audiência sublabel
  const audSublabel = aud
    ? aud.densidade === "nacional"
      ? "Nacional"
      : `Raio ${aud.raioKm}km`
    : "";

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "48px 20px", opacity: show ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: V.night, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: V.white }}>V</span>
          </div>
          <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>{product} · {shortRegion}</p>
        </div>

        {/* ═══ HERO FINANCEIRO — 3 CAMADAS ═══ */}
        {hasProj && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: V.night, borderRadius: 14, padding: "20px",
              border: `1px solid ${V.slate}` }}>
              <p style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em",
                textTransform: "uppercase" as const, color: V.ash, margin: "0 0 16px" }}>
                O que está em jogo
              </p>

              {/* CAMADA 1 — Captura imediata */}
              <div style={{ marginBottom: 16, paddingBottom: 16,
                borderBottom: `1px solid ${V.slate}` }}>
                <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash,
                  letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                  Captura imediata · buscas ativas no seu raio
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                  marginBottom: 8 }}>
                  <div style={{ background: V.graphite, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: V.mist }}>
                      {fmtBRL(proj!.receitaAtual)}/mês
                    </div>
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>
                      você compete hoje ({proj!.influenciaAtual}%)
                    </div>
                  </div>
                  <div style={{ background: V.graphite, borderRadius: 8, padding: "10px 12px",
                    border: `1px solid ${V.amber}40` }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: V.amberSoft }}>
                      {fmtBRL(proj!.receitaPotencial)}/mês
                    </div>
                    <div style={{ fontSize: 10, color: V.ash, marginTop: 2 }}>
                      com o plano ({proj!.influenciaMeta}%)
                    </div>
                  </div>
                </div>
                {(proj!.clientesGap ?? 0) > 0 && (
                  <div style={{ fontSize: 12, color: V.mist, textAlign: "center" }}>
                    +{proj!.clientesGap} cliente{proj!.clientesGap !== 1 ? 's' : ''}/mês
                    via buscas ativas · {fmtBRL(proj!.gapCaptura)} incremental
                  </div>
                )}
              </div>

              {/* CAMADA 2 — Mercado alcançável */}
              <div style={{ marginBottom: 16, paddingBottom: 16,
                borderBottom: `1px solid ${V.slate}` }}>
                <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash,
                  letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                  Mercado alcançável · {audienciaLabel} no raio de {results.audiencia?.raioKm || 3}km
                </div>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 22, fontWeight: 700, color: V.teal }}>
                      +{(proj!.familiasGap ?? 0).toLocaleString('pt-BR')}
                    </span>
                    <span style={{ fontSize: 12, color: V.ash, marginLeft: 6 }}>
                      {audienciaLabel} adicionais com o plano
                    </span>
                  </div>
                  <div style={{ textAlign: "right" as const, fontSize: 10, color: V.ash }}>
                    <div>{(proj!.familiasAtual ?? 0).toLocaleString('pt-BR')} hoje</div>
                    <div style={{ color: V.teal }}>{(proj!.familiasPotencial ?? 0).toLocaleString('pt-BR')} com plano</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: V.zinc, marginTop: 6 }}>
                  Mercado total no raio: {proj!.audienciaTarget.toLocaleString('pt-BR')} {audienciaLabel} ·
                  potencial {fmtBRL(proj!.mercadoTotal)}/mês
                </div>
              </div>

              {/* CAMADA 3 — Risco competitivo */}
              {proj!.posicaoLider && proj!.nomeLider && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: V.mono, fontSize: 9, color: V.coral,
                    letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                    Risco competitivo
                  </div>
                  <div style={{ fontSize: 12, color: V.mist, lineHeight: 1.6 }}>
                    <strong style={{ color: V.coral }}>{proj!.nomeLider}</strong> disputa{' '}
                    {fmtBRL(proj!.receitaLider!)}/mês vs seus {fmtBRL(proj!.receitaAtual)}/mês.
                    {' '}Se continuar crescendo enquanto você não age, o gap aumenta.
                  </div>
                </div>
              )}

              {/* Contexto de cálculo */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${V.slate}`,
                fontSize: 10, color: V.ash, lineHeight: 1.6 }}>
                Ticket estimado: {fmtBRL(proj!.ticketMedio)} · Conversão: {(proj!.taxaConversao * 100).toFixed(0)}%
                {proj!.ticketRationale && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontSize: 10, color: V.ash, cursor: "pointer",
                      listStyle: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      <span>▸ Como calculamos</span>
                    </summary>
                    <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0",
                      fontStyle: "italic", lineHeight: 1.5 }}>
                      {proj!.ticketRationale}
                    </p>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ POSIÇÃO COMPETITIVA (hero + expandable) ═══ */}
        <div style={{ marginBottom: 12 }}>
          {/* Influence card */}
          {hasInfluence ? (
            <div style={{ background: V.night, borderRadius: "14px 14px 0 0", padding: "28px 18px", textAlign: "center", border: `1px solid ${V.slate}`, borderBottom: "none" }}>
              <div style={{
                fontFamily: V.display, fontSize: "clamp(36px, 8vw, 52px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
                color: results.influencePercent < 20 ? V.amberSoft : V.teal,
              }}>
                {results.influencePercent}%
              </div>
              <p style={{ fontSize: 13, color: V.mist, margin: "8px 0 0", lineHeight: 1.4 }}>é sua posição competitiva no mercado local</p>
            </div>
          ) : (
            <div style={{ background: V.night, borderRadius: "14px 14px 0 0", padding: "28px 18px", textAlign: "center", border: `1px solid ${V.slate}`, borderBottom: "none" }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(36px, 8vw, 52px)", fontWeight: 700, color: V.coral, letterSpacing: "-0.03em", lineHeight: 1 }}>0%</div>
              <p style={{ fontSize: 13, color: V.mist, margin: "8px 0 0", lineHeight: 1.4 }}>é sua posição competitiva no mercado local</p>
              <p style={{ fontSize: 11, color: V.coral, margin: "4px 0 0" }}>Invisível no mercado</p>
            </div>
          )}

          {/* Context */}
          <div style={{ background: results.influencePercent === 0 ? V.coralWash : V.amberWash, padding: "14px 18px", border: `1px solid ${V.fog}`, borderTop: "none", borderRadius: "0 0 14px 14px" }}>
            <p style={{ fontSize: 14, color: V.night, margin: 0, lineHeight: 1.6 }}>
              {results.influencePercent === 0
                ? `Quando alguém em ${shortRegion} decide contratar ${product}, seu negócio não está na disputa. Os concorrentes capturam esses clientes sem que você saiba.`
                : hasLevers
                ? `Você disputa ${results.influencePercent}% das decisões de compra em ${shortRegion}. ${levers.length} ações identificadas para aumentar essa posição — veja em "Posição Competitiva".`
                : results.influencePercent < 40
                ? `Você disputa ${results.influencePercent}% das decisões de compra em ${shortRegion}. Os itens estruturantes mostram o que fazer primeiro.`
                : `Você disputa ${results.influencePercent}% das decisões de compra em ${shortRegion} — posição forte. Os itens estruturantes mostram como manter e ampliar.`}
            </p>
          </div>
        </div>

        {/* ═══ SECTION 1: "Seu mercado em números" ═══ */}
        <p style={{ fontSize: 11, fontFamily: V.mono, color: V.ash, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "0 0 12px" }}>
          Seu mercado em números
        </p>

        {/* ── 1. Pessoas no mercado + Tamanho da audiência ── */}
        <div style={{ marginBottom: 4 }}>
          {hasAudiencia ? (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none" }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, color: V.teal, letterSpacing: "-0.03em", lineHeight: 1 }}>
                ~{fmtPop(aud!.audienciaTarget)}
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>{isB2G ? 'órgãos públicos que poderiam contratar você' : isB2B ? 'empresas que poderiam contratar você' : 'pessoas que poderiam contratar você'}{aud!.raioKm && aud!.densidade !== "nacional" ? ` no raio de ${aud!.raioKm}km` : ''}</p>
              <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontFamily: V.mono }}>Mercado endereçável · {aud!.municipioNome}{aud!.raioKm && aud!.densidade !== "nacional" ? ` · Raio ${aud!.raioKm}km` : ''}</p>
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none", opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Mercado endereçável indisponível para este município</p>
            </div>
          )}
          <Expandable title="Tamanho da audiência" icon="👥">
          {aud && aud.populacaoRaio > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                <span style={{ fontSize: 12, color: V.zinc }}>População no raio</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>
                  {fmtPop(aud.populacaoRaio)} {audienciaUnit}
                  {aud.densidade !== "nacional" && aud.raioKm && (
                    <span style={{ fontSize: 11, fontWeight: 400, color: V.ash }}> em {aud.raioKm}km</span>
                  )}
                  {aud.ibgeAno && (
                    <span style={{ fontSize: 10, fontWeight: 400, color: V.ash }}> (IBGE {aud.ibgeAno})</span>
                  )}
                </span>
              </div>
              {aud.targetProfile && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <span style={{ fontSize: 12, color: V.zinc }}>{isB2B ? 'Empresa-alvo' : 'Perfil target'}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: V.night, textAlign: "right", maxWidth: "60%" }}>{aud.targetProfile}</span>
                </div>
              )}
              {aud.audienciaTarget > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Audiência estimada</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: V.teal }}>
                    ~{fmtPop(aud.audienciaTarget)} {audienciaUnit}
                    <span style={{ fontSize: 11, fontWeight: 400, color: V.ash, marginLeft: 4 }}>
                      ({Math.round(aud.estimatedPercentage * 100)}%)
                    </span>
                  </span>
                </div>
              )}
              {aud.rationale && (
                <p style={{ fontSize: 11, color: V.ash, margin: "8px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>{aud.rationale}</p>
              )}
              {results.lat && results.lng && aud.raioKm && aud.densidade !== "nacional" && (
                <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: `1px solid ${V.fog}` }}>
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${results.lat},${results.lng}&zoom=${aud.raioKm <= 5 ? 13 : 10}&size=560x200&scale=2&maptype=roadmap&style=feature:all|saturation:-50&markers=size:small|color:0x2D9B83|${results.lat},${results.lng}&path=color:0x2D9B8380|weight:2|fillcolor:0x2D9B8318|${generateCirclePath(results.lat!, results.lng!, aud.raioKm!)}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY}`}
                    alt={`Mapa do raio de ${aud.raioKm}km`}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                  <div style={{ padding: "8px 12px", background: V.cloud, fontSize: 11, color: V.zinc, textAlign: "center" }}>
                    Raio de análise: {aud.raioKm}km a partir de {aud.municipioNome}
                  </div>
                </div>
              )}
              <p style={{ fontSize: 10, color: V.ash, margin: "10px 0 0", fontFamily: V.mono }}>Fonte: IBGE{aud.ibgeAno ? ` ${aud.ibgeAno}` : ''} · Estimativa Virô</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Dados IBGE indisponíveis para este município.</p>
          )}
        </Expandable>
        </div>

        {/* ── 2. Demanda ativa + Volume de buscas ── */}
        <div style={{ marginBottom: 4 }}>
          {hasVolume ? (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none" }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, color: V.night, letterSpacing: "-0.03em", lineHeight: 1 }}>
                <AnimatedCounter target={results.totalVolume} duration={1500} />
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>buscas/mês que poderiam levar até você</p>
              {results.volumeGeo && results.volumeGeo.level !== 'city' && (
                <p style={{ fontSize: 10, color: V.amber, margin: "4px 0 0", fontFamily: V.mono }}>
                  Dados de {results.volumeGeo.level === 'regional' ? results.volumeGeo.label : results.volumeGeo.level === 'state' ? `estado ${results.volumeGeo.label}` : 'Brasil'}
                </p>
              )}
              {results.pipeline?.sourcesUsed?.includes("claude_volume_estimate") && (
                <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontFamily: V.mono }}>volume estimado</p>
              )}
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none", opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Demanda ativa indisponível para este mercado</p>
            </div>
          )}
          <Expandable
            title="Volume de buscas"
            icon="🔍"
          >
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Estas são as buscas que importam para o seu negócio na sua região.
          </p>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${V.fog}`, fontSize: 10, color: V.ash, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
            <span style={{ flex: 1 }}>Termo</span>
            <span style={{ width: 60, textAlign: "right" }}>Vol/mês</span>
            <span style={{ width: 60, textAlign: "right" }}>Posição</span>
            <span style={{ width: 80, textAlign: "right" }}>Intenção</span>
          </div>
          {/* Rows */}
          {(() => {
            const maxVol = Math.max(...results.terms.slice(0, 15).map(t => t.volume), 0);
            return results.terms.slice(0, 15).map((t, i) => {
              const intent = inferIntent(t.term, isB2B);
              const isTop = t.volume > 0 && t.volume === maxVol;
              const pos = t.position && t.position !== "—" ? Number(t.position) : null;
              const posLabel = pos ? (pos <= 3 ? "Top 3" : pos <= 10 ? "Top 10" : `#${pos}`) : "—";
              const posColor = pos ? (pos <= 3 ? V.teal : pos <= 10 ? V.amber : V.ash) : V.ash;
              return (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: i < 14 ? `1px solid ${V.fog}` : "none",
                  background: isTop ? V.amberWash : "transparent",
                  marginLeft: isTop ? -4 : 0, marginRight: isTop ? -4 : 0,
                  paddingLeft: isTop ? 4 : 0, paddingRight: isTop ? 4 : 0,
                  borderRadius: isTop ? 4 : 0,
                }}>
                  <span style={{ fontSize: 13, color: V.night, lineHeight: 1.4, flex: 1 }}>{t.term}</span>
                  <span style={{ fontFamily: V.mono, fontSize: 11, color: t.volume > 0 ? V.night : V.ash, width: 60, textAlign: "right", flexShrink: 0 }}>
                    {t.volume > 0 ? t.volume.toLocaleString("pt-BR") : "—"}
                  </span>
                  <span style={{ fontFamily: V.mono, fontSize: 11, color: posColor, fontWeight: pos && pos <= 10 ? 600 : 400, width: 60, textAlign: "right", flexShrink: 0 }}>
                    {posLabel}
                  </span>
                  <span style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                    <span style={{
                      fontFamily: V.mono, fontSize: 9, letterSpacing: "0.04em",
                      color: intent.color, background: `${intent.color}18`,
                      padding: "2px 6px", borderRadius: 100,
                    }}>
                      {intent.label}
                    </span>
                  </span>
                </div>
              );
            });
          })()}
          {results.terms.length > 15 && (
            <p style={{ fontSize: 11, color: V.ash, marginTop: 8, textAlign: "center" }}>+{results.terms.length - 15} termos no diagnóstico completo</p>
          )}
          <p style={{ fontSize: 10, color: V.ash, margin: "12px 0 0", fontFamily: V.mono }}>
            Fonte: Google Ads + SERP{results.volumeGeo ? ` · ${results.volumeGeo.level === 'city' ? results.volumeGeo.label : results.volumeGeo.level === 'regional' ? results.volumeGeo.label : results.volumeGeo.level === 'state' ? results.volumeGeo.label : 'Brasil'}` : ''}
          </p>
        </Expandable>
        </div>

        {/* ── 3. Concorrência + sub-bloco ── */}
        <div style={{ marginBottom: 4 }}>
          {hasCi ? (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none" }}>
              {ci!.activeCompetitors === 0 && ci!.totalCompetitors === 0 ? (
                <>
                  <div style={{ fontFamily: V.display, fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 700, color: V.teal, lineHeight: 1.2 }}>Sem concorrência</div>
                  <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>nenhum concorrente digital no seu raio</p>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral }}>
                    {ci!.activeCompetitors}
                  </div>
                  <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>negócio{ci!.activeCompetitors !== 1 ? 's' : ''} disputando atenção com você</p>
                  <span style={{
                    display: "inline-block", marginTop: 8, fontFamily: V.mono, fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 600,
                    background: ci!.color === 'green' ? "rgba(45,155,131,0.12)" : ci!.color === 'yellow' ? V.amberWash : V.coralWash,
                    color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral,
                  }}>
                    {ci!.labelText}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none", opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Concorrência indisponível para esta região</p>
            </div>
          )}
          <Expandable title="Concorrência no seu raio" icon="🏪">
            {!hasCi ? (
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Dados de concorrência não disponíveis para esta região.</p>
            ) : ci!.activeCompetitors === 0 && ci!.totalCompetitors === 0 ? (
              <p style={{ fontSize: 12, color: V.teal, margin: 0 }}>Nenhum concorrente digital encontrado no seu raio — oportunidade.</p>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 12px", lineHeight: 1.5 }}>
                  {ci!.activeCompetitors} negócio{ci!.activeCompetitors !== 1 ? 's' : ''} disputa{ci!.activeCompetitors === 1 ? '' : 'm'} atenção com você nesta região.
                </p>
                  {ci!.competitors.filter(c => c.hasWebsite || c.hasInstagram).slice(0, 8).map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: V.zinc, borderBottom: i < Math.min(ci!.competitors.filter(cc => cc.hasWebsite || cc.hasInstagram).length, 8) - 1 ? `1px solid ${V.fog}` : "none" }}>
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span style={{ display: "flex", gap: 4, fontSize: 10 }}>
                        {c.hasWebsite && <span title="Site" style={{ background: V.tealWash, color: V.teal, padding: "1px 5px", borderRadius: 4, fontFamily: V.mono }}>Site</span>}
                        {c.hasInstagram && <span title="Instagram" style={{ background: "#E1306C18", color: "#E1306C", padding: "1px 5px", borderRadius: 4, fontFamily: V.mono }}>IG</span>}
                      </span>
                      {c.rating && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>★{c.rating}</span>}
                      {c.mapsPosition && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>#{c.mapsPosition}</span>}
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: "10px 14px", background: ci!.color === 'green' ? "rgba(45,155,131,0.08)" : ci!.color === 'yellow' ? V.amberWash : V.coralWash, borderRadius: 8, textAlign: "center" }}>
                    <span style={{ fontFamily: V.mono, fontSize: 11, fontWeight: 600, color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral }}>
                      {ci!.labelText} · {ci!.indexValue.toLocaleString("pt-BR")} buscas por concorrente
                    </span>
                  </div>
                </div>
              )}
            </Expandable>
        </div>

        {/* ── Posição Competitiva (detalhes expandable) ── */}
        <div style={{ marginBottom: 4 }}>
          <Expandable title="Posição Competitiva" icon="📊">
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Probabilidade de ser escolhido quando alguém no seu raio decide contratar.
          </p>

          {/* D1 — Descoberta (SERP + Maps + AI) */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Descoberta</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.d1_descoberta ?? breakdown?.d1_discovery ?? 0}%</span>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
              {serpData?.termsRanked === 0
                ? `Não aparece no top 10 para nenhum dos ${serpData?.termsScraped || 0} termos.`
                : serpData ? `Aparece para ${serpData.termsRanked} de ${serpData.termsScraped} termos.` : "SERP não disponível."}
              {results.maps?.found ? ` Maps: ★ ${results.maps.rating || "—"} (${results.maps.reviewCount || 0} avaliações).` : " Maps: não encontrado."}
            </p>
            {results.aiVisibility && (
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.5 }}>
                {(() => {
                  const aiDimFactor = results.aiVisibility!.factors?.find(
                    (f: any) => f.status === 'positive' && f.factor.startsWith('Aparece em buscas de IA')
                  );
                  if (aiDimFactor) return `AI: ${aiDimFactor.factor}. Score ${results.aiVisibility!.score}/100.`;
                  if (results.aiVisibility!.likelyMentioned) return `AI: Seu negócio provavelmente é mencionado em respostas de AI. Score ${results.aiVisibility!.score}/100.`;
                  return `AI: Não aparece em nenhuma busca de IA na região. ${results.aiVisibility!.summary}`;
                })()}
              </p>
            )}
          </div>

          {/* D2 — Credibilidade (avaliações + engajamento + site) */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Credibilidade</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.d2_credibilidade ?? breakdown?.d2_credibility ?? 0}%</span>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
              {results.maps?.found
                ? `Google Maps: ★ ${results.maps.rating || "—"} (${results.maps.reviewCount || 0} avaliações) · ${results.maps.photos || 0} fotos.`
                : "Google Maps: perfil não encontrado."}
              {igData?.dataAvailable ? ` Engajamento Instagram: ${(igData.engagementRate * 100).toFixed(1)}%.` : ""}
            </p>
          </div>

          {/* D3 — Presença (Instagram + conteúdo) */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Presença</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.d3_presenca ?? breakdown?.d3_reach ?? 0}%</span>
            </div>
            {igData?.dataAvailable ? (
              <>
                <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 4px", lineHeight: 1.5 }}>
                  @{igData.handle}: {igData.postsLast30d} posts/30d · {igData.followers.toLocaleString("pt-BR")} seguidores · {(igData.engagementRate * 100).toFixed(1)}% engajamento
                </p>
                {igData.followers > 0 && (igData.avgViews || 0) === 0 && (igData.avgLikes || 0) === 0 && (
                  <p style={{ fontSize: 11, color: V.amber, margin: "4px 0 8px", lineHeight: 1.5,
                    background: V.amberWash, padding: "6px 10px", borderRadius: 6 }}>
                    ⚠️ Dados de alcance e engajamento não disponíveis — perfil pode estar com restrições de privacidade.
                  </p>
                )}
                {(igData.recentPostsCount ?? 0) > 0 ? (
                  <p style={{ fontSize: 11, color: V.teal, margin: "0 0 8px", fontWeight: 500 }}>
                    {igData.recentPostsCount} {igData.recentPostsCount === 1 ? "post" : "posts"} nos últimos 15 dias · {(igData.recentAvgReach || 0).toLocaleString("pt-BR")} alcance médio recente
                  </p>
                ) : (
                  <p style={{
                    fontSize: 11, color: V.amber, margin: "0 0 8px", fontWeight: 600,
                    background: V.amberWash, display: "inline-block", padding: "3px 8px", borderRadius: 4,
                  }}>
                    Perfil inativo — 0 posts nos últimos 15 dias
                  </p>
                )}
                {competitors.length > 0 && (
                  <div style={{ background: V.cloud, borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
                    <p style={{ fontSize: 10, color: V.ash, margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Comparativo</p>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, borderBottom: `1px solid ${V.fog}` }}>
                      <span style={{ color: V.ash, width: "30%" }}>Perfil</span>
                      <span style={{ color: V.ash, width: "20%", textAlign: "right" }}>Seguidores</span>
                      <span style={{ color: V.ash, width: "25%", textAlign: "right" }}>Alcance</span>
                      <span style={{ color: V.ash, width: "25%", textAlign: "right" }}>Engaj.</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, background: V.amberWash, borderRadius: 4, paddingLeft: 4, paddingRight: 4, marginTop: 2 }}>
                      <span style={{ color: V.amber, fontWeight: 600, width: "30%" }}>@{igData.handle}</span>
                      <span style={{ color: V.night, width: "20%", textAlign: "right" }}>{igData.followers.toLocaleString("pt-BR")}</span>
                      <span style={{ color: V.night, width: "25%", textAlign: "right" }}>{(igData.avgViews || igData.avgLikes || 0).toLocaleString("pt-BR")}</span>
                      <span style={{ color: V.night, width: "25%", textAlign: "right" }}>{(igData.engagementRate * 100).toFixed(1)}%</span>
                    </div>
                    {competitors.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", fontSize: 12, borderBottom: i < competitors.length - 1 ? `1px solid ${V.fog}` : "none" }}>
                        <span style={{ color: V.zinc, width: "30%" }}>@{c.handle}</span>
                        <span style={{ color: V.zinc, width: "20%", textAlign: "right" }}>{c.followers.toLocaleString("pt-BR")}</span>
                        <span style={{ color: V.zinc, width: "25%", textAlign: "right" }}>{((c as any).avgViews || (c as any).avgLikes || Math.round(c.followers * 0.1)).toLocaleString("pt-BR")}</span>
                        <span style={{ color: V.zinc, width: "25%", textAlign: "right" }}>{(c.engagementRate * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12, color: V.zinc, margin: 0 }}>Perfil não informado ou dados não coletados.</p>
            )}
          </div>

          {/* D4 — Reputação (avaliações + respostas) */}
          <div style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Reputação</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.d4_reputacao ?? 0}%</span>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
              {results.maps?.found
                ? `${results.maps.reviewCount || 0} avaliações · ★ ${results.maps.rating || "—"} · ${Math.round((results.maps.ownerResponseRate || 0) * 100)}% respondidas`
                : "Google Maps: perfil não encontrado — sem dados de reputação."}
            </p>
          </div>

          {/* ── Alavancas de influência ── */}
          {hasLevers && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${V.fog}` }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: V.night, margin: "0 0 12px" }}>
                O que move seu score
              </p>
              {levers.map((lever: any, i: number) => {
                const dimColor = lever.dimension === 'descoberta' ? V.teal
                  : lever.dimension === 'credibilidade' ? V.amber
                  : lever.dimension === 'presenca' ? '#8B5CF6'
                  : '#E05252';
                const dimLabel = lever.dimension === 'descoberta' ? 'Descoberta'
                  : lever.dimension === 'credibilidade' ? 'Credibilidade'
                  : lever.dimension === 'presenca' ? 'Presença'
                  : 'Reputação';
                const effortColor = lever.effort === 'baixo' ? V.teal
                  : lever.effort === 'médio' ? V.amber
                  : V.coral;
                return (
                  <div key={i} style={{
                    padding: "12px 14px", marginBottom: 8, borderRadius: 10,
                    background: V.cloud, border: `1px solid ${V.fog}`,
                  }}>
                    {/* Header: dimensão + impacto */}
                    <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                        <span style={{
                          fontFamily: V.mono, fontSize: 9, padding: "2px 7px",
                          borderRadius: 100, fontWeight: 600,
                          background: `${dimColor}15`, color: dimColor,
                        }}>
                          {dimLabel}
                        </span>
                        <span style={{
                          fontFamily: V.mono, fontSize: 9, padding: "2px 7px",
                          borderRadius: 100, background: `${effortColor}15`, color: effortColor,
                        }}>
                          {lever.effort === 'baixo' ? 'Fácil' : lever.effort === 'médio' ? 'Médio' : 'Complexo'}
                        </span>
                        <span style={{
                          fontFamily: V.mono, fontSize: 9, color: V.ash,
                          padding: "2px 7px", borderRadius: 100, background: V.fog,
                        }}>
                          {lever.horizon}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: V.mono, fontSize: 11, fontWeight: 700,
                        color: V.teal,
                      }}>
                        +{lever.impact}pts
                      </span>
                    </div>
                    {/* Ação */}
                    <p style={{ fontSize: 13, fontWeight: 600, color: V.night,
                      margin: "0 0 6px", lineHeight: 1.4 }}>
                      {lever.action}
                    </p>
                    {/* Situação atual → meta */}
                    {lever.currentValue && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                        <span style={{ fontSize: 11, color: V.ash, fontFamily: V.mono }}>
                          {lever.currentValue}
                        </span>
                        {lever.targetValue && (
                          <>
                            <span style={{ fontSize: 10, color: V.ash }}>→</span>
                            <span style={{ fontSize: 11, color: V.teal, fontFamily: V.mono }}>
                              {lever.targetValue}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0",
                fontFamily: V.mono, textAlign: "center" as const }}>
                Impacto estimado sobre a posição competitiva
              </p>
            </div>
          )}
        </Expandable>
        </div>

        {/* ── 4. Prévia do seu Plano de Ação ── */}
        {!hideWorkRoutes && results.workRoutes && results.workRoutes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: V.mono, color: V.ash, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "20px 0 12px" }}>
              Prévia do seu Plano de Ação
            </div>
            {results.gapHeadline && (
              <p style={{ fontSize: 13, color: V.night, margin: "0 0 12px", fontWeight: 500, lineHeight: 1.5 }}>{results.gapHeadline}</p>
            )}
            {(() => {
              const sorted = [...results.workRoutes].sort((a: any, b: any) => a.priority - b.priority);
              return sorted.slice(0, 5).map((route: any, i: number) => {
                const isLocked = i > 0;
                return (
                  <div key={i} style={{
                    padding: "12px", marginBottom: 8, borderRadius: 8,
                    background: i === 0 ? V.amberWash : V.cloud,
                    filter: isLocked ? "blur(3px)" : "none",
                    pointerEvents: isLocked ? "none" : "auto",
                    userSelect: isLocked ? "none" : "auto",
                    position: "relative",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: V.mono, fontSize: 10, fontWeight: 600, color: i === 0 ? V.amber : V.zinc, background: i === 0 ? "rgba(207,133,35,0.15)" : V.fog, width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{route.priority}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{route.title}</span>
                      <Chip color={route.horizon === "curto prazo" ? V.teal : route.horizon === "longo prazo" ? V.coral : V.amber}>
                        {route.horizon === "curto prazo" ? "1–4 semanas" : route.horizon === "médio prazo" ? "1–3 meses" : route.horizon === "longo prazo" ? "3–6 meses" : route.horizon}
                      </Chip>
                    </div>
                    <p style={{ fontSize: 12, color: V.zinc, margin: "4px 0 0", lineHeight: 1.5, paddingLeft: 28 }}>{route.rationale}</p>
                  </div>
                );
              });
            })()}
            {/* CTA to unlock */}
            <div style={{
              textAlign: "center", padding: "16px", marginTop: 4,
              background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`,
            }}>
              <span style={{ fontSize: 16, marginRight: 8 }}>🔒</span>
              <span style={{ fontSize: 13, color: V.zinc }}>Ver plano de ação completo — </span>
              <button
                onClick={() => {
                  fetch("/api/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lead_id: leadId, locale: "pt" }),
                  }).then(r => r.json()).then(d => { if (d.url) window.location.href = d.url; });
                }}
                style={{
                  background: "none", border: "none", color: V.amber,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline",
                }}
              >
                Diagnóstico Completo por R$497
              </button>
            </div>
          </div>
        )}

        {/* Bloco 5 — Fontes de dados e metodologia (só no painel pago) */}
        {!hideCTA && <Expandable title="Fontes de dados e metodologia" icon="🔬">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {(() => {
              const allSources: Record<string, string> = {
                claude_term_gen: "IA · Termos",
                apify_serp: "Google SERP",
                dataforseo: "DataForSEO",
                apify_maps: "Google Maps",
                dataforseo_organic: "DataForSEO Organic",
                apify_instagram: "Instagram",
                ai_visibility: "IA · Visibilidade",
                claude_gap_analysis: "IA · Análise",
                ibge: "IBGE",
                ibge_audiencia: "IBGE · Audiência",
                auto_competitor_discovery: "Concorrentes auto",
                claude_fallback_terms: "IA · Fallback",
                claude_volume_estimate: "IA · Volume estimado",
                google_ads: "Google Ads",
                maps_competition: "Maps · Concorrência",
                linkedin_check: "LinkedIn",
                pncp: "PNCP · Licitações",
              };
              const used = results.pipeline?.sourcesUsed || [];
              const chips: { label: string; active: boolean }[] = [];
              for (const [key, label] of Object.entries(allSources)) {
                if (used.includes(key)) chips.unshift({ label, active: true });
              }
              for (const src of used) {
                if (!allSources[src]) chips.push({ label: src, active: true });
              }
              return chips.map((c, i) => (
                <Chip key={i} color={c.active ? V.teal : V.ash}>{c.label}</Chip>
              ));
            })()}
          </div>
          <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 12px", lineHeight: 1.6 }}>
            {isB2G
              ? "A Posição Competitiva usa 4 dimensões — Descoberta (SERP + Maps + AI), Credibilidade (avaliações + site), Presença (conteúdo + redes) e Reputação (volume e qualidade de avaliações) — para medir a probabilidade de ser escolhido. O dimensionamento cruza volume de busca (Google Ads/DataForSEO), IBGE e PNCP para estimar o mercado disponível. Dados coletados em tempo real."
              : isB2B
              ? "A Posição Competitiva usa 4 dimensões — Descoberta (SERP + Maps + AI), Credibilidade (avaliações + site), Presença (Instagram + LinkedIn) e Reputação (avaliações + respostas) — para medir a probabilidade de ser escolhido. O dimensionamento cruza volume de busca (Google Ads/DataForSEO) com dados IBGE para estimar a demanda. Dados coletados em tempo real."
              : "A Posição Competitiva usa 4 dimensões — Descoberta (SERP + Maps + AI), Credibilidade (avaliações + site), Presença (Instagram + conteúdo) e Reputação (avaliações + respostas) — para medir a probabilidade de ser escolhido no mercado local. O dimensionamento cruza volume de busca (Google Ads/DataForSEO) com dados IBGE para estimar a demanda total. Todos os dados são coletados em tempo real."}
          </p>
          {results.pipeline?.durationMs && (
            <p style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, marginTop: 8 }}>{(results.pipeline.durationMs / 1000).toFixed(1)}s · {results.pipeline.version}</p>
          )}
        </Expandable>}

        {/* ═══ PNCP — Contratações Públicas (B2G only) ═══ */}
        {isB2G && results.pncp && results.pncp.totalEncontradas > 0 && (
          <Expandable title="Contratações Públicas (PNCP)" icon="📋">
            <div style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, background: V.cloud, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: V.night }}>{results.pncp.totalEncontradas}</div>
                  <div style={{ fontSize: 10, color: V.ash }}>contratações</div>
                </div>
                <div style={{ flex: 1, background: V.cloud, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: V.teal }}>R${(results.pncp.valorTotalEstimado / 1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 10, color: V.ash }}>valor total</div>
                </div>
                <div style={{ flex: 1, background: V.cloud, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: V.night }}>{results.pncp.orgaosUnicos}</div>
                  <div style={{ fontSize: 10, color: V.ash }}>órgãos</div>
                </div>
              </div>
              {results.pncp.modalidades.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: V.zinc, margin: "0 0 6px" }}>Modalidades mais comuns:</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {results.pncp.modalidades.slice(0, 5).map((m, i) => (
                      <Chip key={i} color={V.teal}>{m.modalidade} ({m.count})</Chip>
                    ))}
                  </div>
                </div>
              )}
              {results.pncp.contratacoes.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: V.zinc, margin: "0 0 6px" }}>Contratações recentes:</p>
                  {results.pncp.contratacoes.slice(0, 5).map((c, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: i < 4 ? `1px solid ${V.fog}` : "none" }}>
                      <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.4 }}>{c.objeto.slice(0, 120)}{c.objeto.length > 120 ? '...' : ''}</p>
                      <p style={{ fontSize: 10, color: V.ash, margin: "2px 0 0" }}>{c.orgaoEntidade} · {c.modalidade} · R${c.valorEstimado > 0 ? (c.valorEstimado / 1000).toFixed(0) + 'k' : '—'}</p>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 10, color: V.ash, margin: "8px 0 0", fontFamily: V.mono }}>
                Fonte: PNCP · {results.pncp.periodoConsultado}
              </p>
            </div>
          </Expandable>
        )}

        {/* ═══ CTA ═══ */}
        {!hideCTA && (<><div style={{ padding: "24px 0 16px" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: V.night, margin: "0 0 8px", lineHeight: 1.4 }}>
            Agora você sabe. O próximo passo é agir.
          </p>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 4px", lineHeight: 1.6 }}>
            <strong style={{ color: V.night }}>Antes:</strong> Não sabia o que fazer primeiro
          </p>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 20px", lineHeight: 1.6 }}>
            <strong style={{ color: V.teal }}>Agora:</strong> Sei onde estou, quem compete comigo e tenho um plano de ação para agir agora
          </p>
        </div>

        <div style={{ background: V.night, borderRadius: 14, padding: "28px 20px", marginBottom: 16, color: V.white }}>
          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 4 }}>
            Pacote completo · pagamento único
          </div>
          <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>R$ 497</div>

          {[
            "Diagnóstico completo por canal (Google, Instagram, Maps, IA)",
            "Itens estruturantes — o básico que precisa estar no lugar",
            "Relatório setorial do seu mercado com dados reais",
            "Posts prontos para publicar conectados ao contexto da semana",
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
              <span style={{ color: V.amber, fontSize: 12 }}>✓</span>
              <span style={{ fontSize: 13, color: V.mist }}>{d}</span>
            </div>
          ))}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${V.graphite}` }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder="Cupom" value={coupon}
                onChange={(e: any) => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${V.slate}`, background: V.graphite, color: V.white, fontSize: 13, fontFamily: V.mono, outline: "none" }} />
              {coupon.length > 0 && (
                <button onClick={() => setCouponApplied(true)} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: couponApplied ? V.teal : V.amber, color: V.white, fontSize: 12, fontFamily: V.mono, cursor: "pointer" }}>
                  {couponApplied ? "✓" : "Aplicar"}
                </button>
              )}
            </div>
            <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: V.white, color: V.night, fontSize: 15, fontWeight: 600,
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Redirecionando..." : "Desbloquear diagnóstico completo"}
            </button>
            <p style={{ fontSize: 11, color: V.ash, textAlign: "center", marginTop: 8 }}>Pagamento único · sem assinatura</p>
          </div>
        </div>

        {/* Prévia */}
        <Expandable title="Prévia do que você recebe">
          <div style={{ padding: "12px", borderRadius: 8, background: V.cloud, marginBottom: 8, borderLeft: `3px solid ${V.amber}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 4 }}>Diagnóstico completo</div>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>
              Onde você está de verdade — Google, Instagram, Maps e AI — comparado com quem disputa os mesmos clientes na sua região.
            </div>
          </div>
          <div style={{ padding: "12px", borderRadius: 8, background: V.cloud, marginBottom: 8, borderLeft: `3px solid ${V.teal}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 4 }}>Plano de ação prioritário</div>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>
              O que fazer, em que ordem e por quê — ordenado por impacto para você começar hoje.
            </div>
          </div>
          <div style={{ padding: "12px", borderRadius: 8, background: V.cloud, borderLeft: `3px solid #8B5CF6` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 4 }}>Conteúdos prontos</div>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>
              Posts prontos para Instagram, Google Meu Negócio e WhatsApp — copie, adapte e publique.
            </div>
          </div>
        </Expandable></>)}

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
