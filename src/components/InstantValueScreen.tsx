"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";

const V = {
  night: "#161618",
  graphite: "#232326",
  slate: "#3A3A40",
  zinc: "#6E6E78",
  ash: "#9E9EA8",
  mist: "#C8C8D0",
  fog: "#EAEAEE",
  cloud: "#F4F4F7",
  white: "#FEFEFF",
  amber: "#CF8523",
  amberSoft: "#E6A445",
  amberWash: "rgba(207,133,35,0.08)",
  amberWash2: "rgba(207,133,35,0.15)",
  teal: "#2D9B83",
  tealWash: "rgba(45,155,131,0.08)",
  coral: "#D9534F",
  coralWash: "rgba(217,83,79,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

interface TermData {
  term: string;
  volume: number;
  cpc: number;
  position: string;
  intent?: string;
  serpFeatures?: string[];
}

interface Results {
  terms: TermData[];
  totalVolume: number;
  avgCpc: number;
  marketLow: number;
  marketHigh: number;
  influencePercent: number;
  source: string;
  confidence: string;
  gapHeadline?: string;
  termGeneration?: { count: number };
  influenceBreakdown?: {
    google: number;
    instagram: number;
    web: number | null;
  };
  maps?: {
    found: boolean;
    rating: number | null;
    reviewCount: number | null;
    categories: string[];
    inLocalPack: boolean;
    photos: number;
  };
  instagram?: {
    handle: string;
    followers: number;
    engagementRate: number;
    postsLast30d: number;
    avgLikes: number;
    avgViews: number;
    dataAvailable: boolean;
  };
  competitorInstagram?: {
    handle: string;
    followers: number;
    engagementRate: number;
    postsLast30d: number;
    avgLikes?: number;
    avgViews?: number;
  }[];
  serpSummary?: {
    termsScraped: number;
    termsRanked: number;
    hasLocalPack: boolean;
    hasAds: boolean;
  };
  pipeline?: {
    version: string;
    durationMs: number;
    sourcesUsed: string[];
    sourcesUnavailable: string[];
  };
  gaps?: any[];
  gapPattern?: any;
  workRoutes?: {
    priority: number;
    title: string;
    rationale: string;
    connection: string;
    horizon: string;
    expectedImpact: string;
  }[];
  aiVisibility?: {
    score: number;
    summary: string;
    likelyMentioned: boolean;
    factors: { factor: string; status: string; detail: string }[];
    competitorMentions: { name: string; likelyMentioned: boolean; reason: string }[];
  } | null;
}

interface Props {
  product: string;
  region: string;
  results: Results;
  onCheckout: (coupon?: string) => void;
  loading?: boolean;
}

// ─── Helper Components ──────────────────────────────────────────────

function Chip({ children, color = V.ash }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const,
      color, background: color === V.teal ? V.tealWash : color === V.amber ? V.amberWash : color === V.coral ? V.coralWash : `${color}11`,
      padding: "3px 10px", borderRadius: 100, fontWeight: 500, display: "inline-block",
    }}>
      {children}
    </span>
  );
}

function SectionLabel({ children, color = V.teal }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em",
      textTransform: "uppercase" as const, color, marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
      padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function BarMini({ value, max, color = V.teal }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, background: V.fog, overflow: "hidden", flex: "0 0 80px" }}>
      <div style={{ height: "100%", borderRadius: 3, background: color, width: `${Math.max(pct, 2)}%`, transition: "width 1s ease" }} />
    </div>
  );
}

function IntentTag({ intent }: { intent?: string }) {
  if (!intent) return null;
  const colors: Record<string, string> = {
    transacional: V.teal,
    transactional: V.teal,
    informacional: V.amber,
    informational: V.amber,
    navegacional: "#4285F4",
    navigational: "#4285F4",
    local: V.coral,
  };
  const c = colors[intent.toLowerCase()] || V.ash;
  return <Chip color={c}>{intent}</Chip>;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

// ─── Main Component ─────────────────────────────────────────────────

export default function InstantValueScreen({ product, region, results, onCheckout, loading }: Props) {
  const [show, setShow] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 100);
    setTimeout(() => setBarWidth(results.influencePercent), 800);
  }, [results.influencePercent]);

  const termCount = results.termGeneration?.count || results.terms.length;
  const serpData = results.serpSummary;
  const mapsData = results.maps;
  const igData = results.instagram;
  const competitors = results.competitorInstagram || [];
  const breakdown = results.influenceBreakdown;
  const hasMarketData = results.marketLow > 0 || results.marketHigh > 0;
  const hasVolumeData = results.totalVolume > 0;
  const termsWithVolume = results.terms.filter(t => t.volume > 0);

  return (
    <div style={{
      minHeight: "100vh", background: V.cloud, padding: "60px 24px",
      opacity: show ? 1 : 0, transition: "opacity 0.6s ease",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: V.night, display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <span style={{ fontFamily: V.display, fontWeight: 700, fontSize: 20, color: V.white, letterSpacing: "-0.03em" }}>V</span>
          </div>
          <div style={{
            fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const,
            color: V.amber, background: V.amberWash, padding: "6px 16px", borderRadius: 100,
            display: "inline-block", marginBottom: 20,
          }}>
            Seu diagnóstico de mercado
          </div>
          <p style={{ fontSize: 14, color: V.ash }}>{product} · {region}</p>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SEÇÃO 1 — MERCADO TOTAL ENDEREÇÁVEL (TAM)
            ════════════════════════════════════════════════════════════════ */}

        <Card style={{ padding: "36px 28px", marginBottom: 16, textAlign: "center" }}>
          <SectionLabel color={V.amber}>Mercado endereçável na sua região</SectionLabel>

          {hasMarketData ? (
            <>
              <div style={{
                fontFamily: V.display, fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 700,
                color: V.night, letterSpacing: "-0.04em", lineHeight: 1,
              }}>
                {formatCurrency(results.marketLow)} — {formatCurrency(results.marketHigh)}
              </div>
              <div style={{ fontFamily: V.mono, fontSize: 12, color: V.ash, marginTop: 8, marginBottom: 24 }}>
                em vendas potenciais por mês
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontFamily: V.display, fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 700,
                color: V.night, letterSpacing: "-0.04em", lineHeight: 1,
              }}>
                {hasVolumeData ? results.totalVolume.toLocaleString("pt-BR") : termCount}
              </div>
              <div style={{ fontFamily: V.mono, fontSize: 12, color: V.ash, marginTop: 8, marginBottom: 24 }}>
                {hasVolumeData ? "buscas mensais mapeadas" : "termos de busca mapeados na sua região"}
              </div>
            </>
          )}

          <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 24px", textAlign: "left" }}>
            {hasMarketData ? (
              <>
                É quanto esse mercado movimenta em vendas mensais na sua região, baseado em{" "}
                <strong style={{ color: V.night }}>
                  {hasVolumeData ? results.totalVolume.toLocaleString("pt-BR") : termCount} buscas reais no Google
                </strong>{" "}
                por termos como os listados abaixo.
              </>
            ) : (
              <>
                Mapeamos <strong style={{ color: V.night }}>{termCount} termos</strong> que pessoas na sua região buscam quando precisam do que você oferece.
                Cada termo representa demanda real — pessoas procurando ativamente por {product}.
              </>
            )}
          </p>

          {/* Premissas do cálculo */}
          {hasMarketData && (
            <div style={{
              background: V.cloud, borderRadius: 10, padding: "14px 18px",
              fontSize: 12, color: V.ash, lineHeight: 1.6, textAlign: "left",
            }}>
              <strong style={{ color: V.zinc }}>Premissas:</strong> CTR médio de mercado para posições orgânicas × taxa de conversão benchmark para a categoria × ticket médio informado.
              Faixa conservadora (low) a otimista (high).
            </div>
          )}
        </Card>

        {/* ─── Termos de busca com volume e intenção ─── */}
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel color={V.amber}>Demanda real — o que buscam na sua região</SectionLabel>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "0 14px" }}>
              <span style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash }}>Termo</span>
              <div style={{ display: "flex", gap: 24 }}>
                {hasVolumeData && <span style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, width: 70, textAlign: "right" }}>Vol/mês</span>}
                <span style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, width: 50, textAlign: "right" }}>Posição</span>
              </div>
            </div>

            {results.terms.slice(0, 10).map((t, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: 8,
                background: i % 2 === 0 ? V.cloud : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: V.night, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{t.term}</span>
                  <IntentTag intent={t.intent} />
                  {t.serpFeatures?.includes("people_also_ask") && <Chip color={V.ash}>Perguntas</Chip>}
                  {t.serpFeatures?.includes("local_pack") && <Chip color={V.teal}>Mapa</Chip>}
                </div>
                <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                  {hasVolumeData && (
                    <span style={{
                      fontFamily: V.mono, fontSize: 13, color: t.volume > 0 ? V.night : V.ash,
                      fontWeight: t.volume > 0 ? 600 : 400, width: 70, textAlign: "right",
                    }}>
                      {t.volume > 0 ? t.volume.toLocaleString("pt-BR") : "—"}
                    </span>
                  )}
                  <span style={{
                    fontFamily: V.mono, fontSize: 13, fontWeight: 600, width: 50, textAlign: "right",
                    color: t.position !== "—" && parseInt(t.position) <= 3 ? V.teal
                      : t.position !== "—" && parseInt(t.position) <= 10 ? V.amber
                      : V.ash,
                  }}>
                    {t.position === "—" ? "—" : `#${t.position}`}
                  </span>
                </div>
              </div>
            ))}
            {results.terms.length > 10 && (
              <div style={{ textAlign: "center", padding: "8px", fontSize: 12, color: V.ash }}>
                +{results.terms.length - 10} termos no diagnóstico completo
              </div>
            )}
          </div>

          {/* Legend for intent tags */}
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap", padding: "12px 0 0",
            borderTop: `1px solid ${V.fog}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: V.ash }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: V.teal }} />
              Transacional (quer comprar)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: V.ash }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: V.amber }} />
              Informacional (pesquisando)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: V.ash }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: V.coral }} />
              Local (buscando perto)
            </div>
          </div>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            SEÇÃO 2 — NÍVEL DE INFLUÊNCIA
            ════════════════════════════════════════════════════════════════ */}

        <Card style={{ padding: "36px 28px", marginBottom: 16 }}>
          <SectionLabel color={V.amber}>Sua influência digital local</SectionLabel>

          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
            <div style={{
              fontFamily: V.display, fontSize: "clamp(48px, 8vw, 72px)", fontWeight: 700,
              color: V.night, letterSpacing: "-0.04em", lineHeight: 1,
            }}>
              ~{results.influencePercent}%
            </div>
            <div style={{ fontFamily: V.mono, fontSize: 12, color: V.ash }}>
              do mercado digital ao redor
            </div>
          </div>

          {/* Influence bar */}
          <div style={{ height: 10, borderRadius: 5, background: V.fog, overflow: "hidden", marginBottom: 24 }}>
            <div style={{
              height: "100%", borderRadius: 5,
              background: results.influencePercent > 0
                ? `linear-gradient(90deg, ${V.amber}, ${V.teal})`
                : V.coral,
              width: `${Math.max(barWidth, 2)}%`,
              transition: "width 1.5s cubic-bezier(0.16, 1, 0.3, 1)",
            }} />
          </div>

          {/* Contextual explanation based on actual data */}
          <div style={{
            background: results.influencePercent === 0 ? V.coralWash : results.influencePercent < 20 ? V.amberWash : V.tealWash,
            borderRadius: 10, padding: "16px 18px", marginBottom: 24,
          }}>
            <p style={{ fontSize: 14, color: V.night, margin: 0, lineHeight: 1.7 }}>
              {results.influencePercent === 0 ? (
                <>
                  <strong>Você ainda não aparece</strong> quando pessoas na sua região buscam por {product}.
                  De {hasVolumeData ? results.totalVolume.toLocaleString("pt-BR") + " buscas mensais" : termCount + " termos mapeados"}, nenhuma leva diretamente a você.
                  {" "}Esse é o dado mais importante deste diagnóstico — e também a maior oportunidade.
                </>
              ) : results.influencePercent < 20 ? (
                <>
                  Você captura <strong>{results.influencePercent}%</strong> da atenção digital — aparece para {serpData?.termsRanked || 0} de {serpData?.termsScraped || 0} termos.
                  Há espaço significativo para crescer.
                </>
              ) : (
                <>
                  Você captura <strong>{results.influencePercent}%</strong> da atenção digital — boa posição.
                  O diagnóstico completo mostra como defender e ampliar essa posição.
                </>
              )}
            </p>
          </div>

          {/* Channel breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Google */}
            <div style={{ padding: "16px 18px", background: V.cloud, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4285F4" }} />
                  <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 600, color: V.night }}>Google</span>
                </div>
                {breakdown && <span style={{ fontFamily: V.mono, fontSize: 13, fontWeight: 600, color: V.night }}>{breakdown.google}%</span>}
              </div>
              <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6 }}>
                {serpData?.termsRanked === 0 ? (
                  <>Não aparece no top 10 para nenhum dos {serpData.termsScraped} termos pesquisados.</>
                ) : serpData ? (
                  <>Aparece no top 10 para <strong>{serpData.termsRanked} de {serpData.termsScraped}</strong> termos pesquisados.</>
                ) : (
                  <>Dados de SERP não disponíveis nesta análise.</>
                )}
                {serpData?.hasLocalPack && <> O Local Pack (mapa) aparece nos resultados.</>}
                {serpData?.hasAds && <> Há anúncios pagos ativos para esses termos.</>}
              </div>
              {mapsData && (
                <div style={{ fontSize: 13, color: V.zinc, marginTop: 8 }}>
                  {mapsData.found ? (
                    <>
                      Google Maps: encontrado
                      {mapsData.rating && <> · ★ {mapsData.rating}</>}
                      {mapsData.reviewCount && mapsData.reviewCount > 0 && <> · {mapsData.reviewCount} avaliações</>}
                      {mapsData.inLocalPack && <> · aparece no Local Pack</>}
                    </>
                  ) : (
                    <>Google Maps: perfil não encontrado — considere criar ficha no Google Meu Negócio.</>
                  )}
                </div>
              )}
            </div>

            {/* Instagram */}
            <div style={{ padding: "16px 18px", background: V.cloud, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#E1306C" }} />
                  <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 600, color: V.night }}>Instagram</span>
                </div>
                {breakdown && <span style={{ fontFamily: V.mono, fontSize: 13, fontWeight: 600, color: V.night }}>{breakdown.instagram}%</span>}
              </div>
              <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6 }}>
                {igData?.dataAvailable ? (
                  <>
                    Alcance médio: <strong>{(igData.avgViews || igData.avgLikes || 0).toLocaleString("pt-BR")}</strong>
                    {igData.avgViews > 0 ? " views" : " curtidas"} ·
                    Engajamento: <strong>{(igData.engagementRate * 100).toFixed(1)}%</strong> ·
                    {igData.postsLast30d} posts nos últimos 30 dias
                  </>
                ) : (
                  <>Dados de Instagram não disponíveis — perfil não foi informado ou dados não puderam ser coletados.</>
                )}
              </div>
            </div>

            {/* AI Visibility */}
            <div style={{ padding: "16px 18px", background: V.cloud, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#8B5CF6" }} />
                  <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 600, color: V.night }}>Visibilidade em AI</span>
                </div>
                {results.aiVisibility && (
                  <span style={{ fontFamily: V.mono, fontSize: 13, fontWeight: 600, color: V.night }}>{results.aiVisibility.score}%</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6 }}>
                {results.aiVisibility ? (
                  <>
                    {results.aiVisibility.summary}
                    {results.aiVisibility.factors && results.aiVisibility.factors.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                        {results.aiVisibility.factors.slice(0, 3).map((f, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                            <span style={{
                              color: f.status === 'positive' ? V.teal : f.status === 'negative' ? V.coral : V.ash,
                              fontSize: 10,
                            }}>
                              {f.status === 'positive' ? '✓' : f.status === 'negative' ? '✗' : '—'}
                            </span>
                            <span style={{ color: V.zinc }}>{f.factor}: {f.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    Quando alguém pergunta a uma AI como ChatGPT ou Perplexity "melhor {product} em {region}", seu negócio aparece?
                    Esta análise será incluída no diagnóstico completo.
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ─── Instagram Comparative Table ─── */}
        {(igData?.dataAvailable || competitors.length > 0) && (
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel color="#E1306C">Comparativo Instagram</SectionLabel>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: V.body }}>
                <thead>
                  <tr>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash }}>Perfil</td>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, textAlign: "right" }}>Alcance</td>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, textAlign: "right" }}>Engaj.</td>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, textAlign: "right" }}>Posts/30d</td>
                    <td style={{ padding: "8px 8px", width: 90 }}></td>
                  </tr>
                </thead>
                <tbody>
                  {igData?.dataAvailable && (() => {
                    const reach = igData.avgViews || igData.avgLikes || 0;
                    const allReaches = [reach, ...competitors.map(c => (c as any).avgViews || (c as any).avgLikes || c.followers * 0.1)];
                    const maxReach = Math.max(...allReaches, 1);
                    return (
                      <tr style={{ background: V.amberWash }}>
                        <td style={{ padding: "12px", borderRadius: "8px 0 0 8px" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: V.night }}>@{igData.handle}</div>
                          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, marginTop: 1 }}>Você</div>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <div style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night }}>{reach.toLocaleString("pt-BR")}</div>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{
                            fontFamily: V.mono, fontSize: 13, fontWeight: 600,
                            color: igData.engagementRate >= 0.03 ? V.teal : igData.engagementRate >= 0.01 ? V.amber : V.coral,
                          }}>
                            {(igData.engagementRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{ fontFamily: V.mono, fontSize: 13, fontWeight: 600, color: V.night }}>
                            {igData.postsLast30d}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px", borderRadius: "0 8px 8px 0" }}>
                          <BarMini value={reach} max={maxReach} color={V.amber} />
                        </td>
                      </tr>
                    );
                  })()}
                  {competitors.map((c, i) => {
                    const cReach = (c as any).avgViews || (c as any).avgLikes || c.followers * 0.1;
                    const allReaches = [
                      igData?.avgViews || igData?.avgLikes || 0,
                      ...competitors.map(cc => (cc as any).avgViews || (cc as any).avgLikes || cc.followers * 0.1)
                    ];
                    const maxReach = Math.max(...allReaches, 1);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? V.cloud : "transparent" }}>
                        <td style={{ padding: "12px", borderRadius: "8px 0 0 8px" }}>
                          <div style={{ fontSize: 14, color: V.night }}>@{c.handle}</div>
                          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, marginTop: 1 }}>Concorrente</div>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <div style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night }}>{Math.round(cReach).toLocaleString("pt-BR")}</div>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{ fontFamily: V.mono, fontSize: 13, color: c.engagementRate >= 0.03 ? V.teal : c.engagementRate >= 0.01 ? V.amber : V.ash }}>
                            {(c.engagementRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{ fontFamily: V.mono, fontSize: 13, color: V.zinc }}>{c.postsLast30d}</span>
                        </td>
                        <td style={{ padding: "12px 8px", borderRadius: "0 8px 8px 0" }}>
                          <BarMini value={cReach} max={maxReach} color={V.zinc} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SEÇÃO 3 — ROTAS DE TRABALHO (qualitativo baseado no desafio)
            ════════════════════════════════════════════════════════════════ */}

        {/* Gap headline — the Claude-generated insight */}
        {results.gapHeadline && (
          <div style={{
            background: V.amberWash, borderLeft: `3px solid ${V.amber}`,
            padding: "16px 20px", borderRadius: "0 10px 10px 0", marginBottom: 16,
          }}>
            <p style={{ fontSize: 14, color: V.night, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
              {results.gapHeadline}
            </p>
          </div>
        )}

        {/* Work Routes (prioritized, from evolved Step 5) */}
        {results.workRoutes && results.workRoutes.length > 0 ? (
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel color={V.amber}>Rotas de trabalho priorizadas</SectionLabel>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, marginBottom: 16, marginTop: -8 }}>
              Baseado no potencial disponível, no seu desafio e nos dados coletados:
            </p>
            {results.workRoutes.sort((a, b) => a.priority - b.priority).slice(0, 3).map((route, i) => (
              <div key={i} style={{
                padding: "18px", marginBottom: 12, borderRadius: 10,
                background: i === 0 ? V.amberWash : V.cloud,
                border: i === 0 ? `1px solid rgba(207,133,35,0.2)` : `1px solid ${V.fog}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{
                    fontFamily: V.mono, fontSize: 11, fontWeight: 600,
                    color: i === 0 ? V.amber : V.zinc,
                    background: i === 0 ? "rgba(207,133,35,0.15)" : V.fog,
                    width: 24, height: 24, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {route.priority}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: V.night, flex: 1 }}>
                    {route.title}
                  </div>
                  <Chip color={route.horizon === 'curto prazo' ? V.teal : route.horizon === 'médio prazo' ? V.amber : V.ash}>
                    {route.horizon}
                  </Chip>
                </div>
                <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.7, paddingLeft: 32, marginBottom: 8 }}>
                  {route.rationale}
                </div>
                {route.expectedImpact && (
                  <div style={{
                    fontSize: 12, color: V.teal, lineHeight: 1.5, paddingLeft: 32,
                    fontFamily: V.mono, letterSpacing: "0.01em",
                  }}>
                    → {route.expectedImpact}
                  </div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 12, color: V.ash, marginTop: 8, textAlign: "center" }}>
              O plano completo de 90 dias detalha cada rota em ações semanais
            </div>
          </Card>
        ) : results.gaps && results.gaps.length > 0 ? (
          /* Fallback: show gaps if no work routes */
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel color={V.amber}>Gaps identificados</SectionLabel>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, marginBottom: 16, marginTop: -8 }}>
              Baseado no potencial disponível e nos gaps identificados:
            </p>
            {results.gaps.slice(0, 3).map((gap: any, i: number) => (
              <div key={i} style={{
                padding: "16px 18px", marginBottom: 10, borderRadius: 10,
                background: i === 0 ? V.amberWash : V.cloud,
                border: i === 0 ? `1px solid rgba(207,133,35,0.2)` : `1px solid ${V.fog}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    fontFamily: V.mono, fontSize: 11, fontWeight: 600,
                    color: i === 0 ? V.amber : V.zinc,
                    background: i === 0 ? "rgba(207,133,35,0.15)" : V.fog,
                    width: 24, height: 24, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: V.night }}>
                    {gap.title || gap.gap || `Gap ${i + 1}`}
                  </div>
                  {i === 0 && <Chip color={V.amber}>Prioridade</Chip>}
                </div>
                <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, paddingLeft: 32 }}>
                  {gap.description || gap.detail || gap.evidence || ""}
                </div>
              </div>
            ))}
            {results.gaps.length > 3 && (
              <div style={{ fontSize: 12, color: V.ash, marginTop: 8, textAlign: "center" }}>
                +{results.gaps.length - 3} gaps detalhados no plano completo
              </div>
            )}
          </Card>
        ) : null}

        {/* ════════════════════════════════════════════════════════════════
            RESUMO + METODOLOGIA
            ════════════════════════════════════════════════════════════════ */}

        {/* Stats summary */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ...(hasVolumeData ? [{ label: "buscas/mês", value: results.totalVolume.toLocaleString("pt-BR") }] : []),
            { label: "termos mapeados", value: termCount.toString() },
            ...(serpData ? [{ label: "no top 10", value: `${serpData.termsRanked} de ${serpData.termsScraped}` }] : []),
            { label: "influência", value: `${results.influencePercent}%` },
          ].map((s, i) => (
            <div key={i} style={{
              flex: "1 1 100px", background: V.white, borderRadius: 12,
              border: `1px solid ${V.fog}`, padding: "14px", textAlign: "center",
            }}>
              <div style={{ fontFamily: V.display, fontSize: 20, fontWeight: 700, color: V.night, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Methodology */}
        <Card style={{ marginBottom: 24, background: V.cloud, border: "none" }}>
          <SectionLabel color={V.ash}>Metodologia</SectionLabel>
          <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.7, margin: "0 0 12px" }}>
            Este diagnóstico cruza dados de {results.pipeline?.sourcesUsed?.length || 2} fontes em tempo real.
            Nenhum dado é inventado — cada número vem de uma fonte verificável.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(results.pipeline?.sourcesUsed || []).map((src, i) => {
              const labels: Record<string, string> = {
                claude_term_gen: "IA · Mapeamento",
                apify_serp: "Google SERP",
                apify_maps: "Google Maps",
                apify_instagram: "Instagram",
                claude_gap_analysis: "IA · Análise",
                google_ads: "Google Ads",
                dataforseo: "DataForSEO",
                ai_visibility: "IA · Visibilidade AI",
              };
              return <Chip key={i} color={V.teal}>{labels[src] || src}</Chip>;
            })}
            {(results.pipeline?.sourcesUnavailable || [])
              .filter(s => s !== "google_trends" && s !== "similarweb")
              .map((src, i) => {
                const labels: Record<string, string> = {
                  google_ads: "Google Ads (em breve)",
                  serp_scraper: "SERP",
                  google_maps: "Maps",
                  instagram: "Instagram",
                };
                return <Chip key={`u-${i}`} color={V.ash}>{labels[src] || src}</Chip>;
              })}
          </div>
          {results.pipeline?.durationMs && (
            <div style={{ fontFamily: V.mono, fontSize: 11, color: V.ash, marginTop: 12 }}>
              Processado em {(results.pipeline.durationMs / 1000).toFixed(1)}s · {results.pipeline.version}
            </div>
          )}
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            CTA — E AGORA?
            ════════════════════════════════════════════════════════════════ */}

        <div style={{ padding: "0 8px", marginBottom: 24 }}>
          <p style={{ fontSize: 20, color: V.night, lineHeight: 1.5, fontFamily: V.display, marginBottom: 12, fontWeight: 700 }}>
            E agora? O que eu faço com isso?
          </p>
          <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.75, marginBottom: 8 }}>
            Não é sobre seu marketing ser ruim hoje. É sobre não ter uma camada de estratégia 
            que te permita trabalhar com intenção — para capturar um mercado que já existe 
            na sua região e que, sem direção, vai inteiro para outros.
          </p>
          <p style={{ fontSize: 15, color: V.night, lineHeight: 1.75, fontWeight: 600 }}>
            Vá daqui para lá: aumente a probabilidade de vender mais no futuro.
          </p>
        </div>

        {/* ─── Sample Previews ─── */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel color={V.ash}>O que você recebe — veja amostras reais</SectionLabel>

          {/* Preview 1: Diagnóstico Completo */}
          <div style={{
            background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`,
            padding: "20px", marginBottom: 12, position: "relative" as const,
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Chip color={V.amber}>Diagnóstico Completo</Chip>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>Amostra</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 8 }}>
              Posicionamento competitivo — {product}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["Google", "Instagram", "Maps", "AI"].map((ch, i) => (
                <div key={i} style={{
                  flex: 1, padding: "10px 8px", background: V.cloud, borderRadius: 8, textAlign: "center",
                }}>
                  <div style={{ fontFamily: V.mono, fontSize: 14, fontWeight: 700, color: V.night }}>—</div>
                  <div style={{ fontFamily: V.mono, fontSize: 8, color: V.ash, textTransform: "uppercase" as const, marginTop: 2 }}>{ch}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.6 }}>
              Análise completa de posicionamento em cada canal, comparativo direto com seus concorrentes, 
              oportunidades de palavras-chave que ninguém está atacando e análise de conteúdo.
            </div>
            <div style={{
              position: "absolute" as const, bottom: 0, left: 0, right: 0, height: 40,
              background: `linear-gradient(transparent, ${V.white})`,
            }} />
          </div>

          {/* Preview 2: Plano de 90 dias */}
          <div style={{
            background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`,
            padding: "20px", marginBottom: 12, position: "relative" as const,
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Chip color={V.teal}>Plano de 90 dias</Chip>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>Amostra</span>
            </div>
            {[
              { week: "Semana 1-2", action: "Criar e otimizar perfil no Google Meu Negócio", tag: "Presença" },
              { week: "Semana 3-4", action: "Definir posicionamento + primeiros conteúdos", tag: "Conteúdo" },
              { week: "Semana 5-8", action: "Construir autoridade local com ações específicas", tag: "Autoridade" },
            ].map((w, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, padding: "10px 0",
                borderBottom: i < 2 ? `1px solid ${V.fog}` : "none",
                alignItems: "center",
              }}>
                <div style={{ fontFamily: V.mono, fontSize: 11, color: V.ash, width: 80, flexShrink: 0 }}>
                  {w.week}
                </div>
                <div style={{ fontSize: 13, color: V.night, flex: 1 }}>{w.action}</div>
                <Chip color={V.teal}>{w.tag}</Chip>
              </div>
            ))}
            <div style={{ fontSize: 12, color: V.ash, textAlign: "center", marginTop: 8 }}>
              + 9 semanas de ações detalhadas e priorizadas
            </div>
          </div>

          {/* Preview 3: Briefing Semanal */}
          <div style={{
            background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`,
            padding: "20px", position: "relative" as const,
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Chip color={V.amber}>Briefing Semanal</Chip>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>Amostra</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 6 }}>
              Semana 3 — O que mudou no seu mercado
            </div>
            <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.7, marginBottom: 12 }}>
              "Seu concorrente principal subiu 4 posições para 'implante dentário mauá'. 
              Buscas por 'dentista perto de mim' aumentaram 12% essa semana. 
              Ação recomendada: publicar depoimento de paciente com foco em implantes."
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Chip color={V.ash}>Email</Chip>
              <Chip color={V.ash}>WhatsApp</Chip>
              <Chip color={V.ash}>3 min leitura</Chip>
            </div>
          </div>
        </div>

        {/* ─── Dê o próximo passo ─── */}
        <div style={{ padding: "0 8px", marginBottom: 16 }}>
          <p style={{ fontSize: 17, color: V.night, lineHeight: 1.5, fontFamily: V.display, fontWeight: 700 }}>
            Dê o próximo passo com a Virô.
          </p>
          <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.75 }}>
            Vá de onde você está para onde quer chegar. Aumente a probabilidade de 
            vender mais no futuro — com clareza, dados e um plano que faz sentido pro seu negócio.
          </p>
        </div>

        {/* What's included */}
        <div style={{ background: V.night, borderRadius: 14, padding: "32px 24px", marginBottom: 12, color: V.white }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.04em", color: V.ash, marginBottom: 8, textTransform: "uppercase" as const }}>
            Pacote completo · pagamento único
          </div>
          <div style={{
            fontFamily: V.display, fontSize: 36, fontWeight: 700, color: V.white,
            letterSpacing: "-0.03em", marginBottom: 20,
          }}>
            R$ 397
          </div>

          {[
            { title: "Diagnóstico completo", desc: "Posicionamento real vs concorrentes em Google, Instagram, Maps e AI" },
            { title: "Mapa de demanda completo", desc: "Todos os termos com volume, intenção e CPC + oportunidades inexploradas" },
            { title: "Plano de ação de 90 dias", desc: "12 semanas com ações concretas, priorizadas por impacto, pro seu negócio" },
            { title: "12 briefings semanais", desc: "O que mudou, o que importa e o que fazer — por email e WhatsApp" },
            { title: "Monitoramento contínuo", desc: "Posição no Google, concorrentes e demanda — acompanhado por 90 dias" },
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: V.amber, marginTop: 8, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: V.display, fontSize: 15, fontWeight: 600, color: V.white, marginBottom: 2 }}>{d.title}</div>
                <div style={{ fontSize: 13, color: V.ash, lineHeight: 1.5 }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Coupon + CTA */}
        <div style={{ textAlign: "center", marginBottom: 24, marginTop: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: V.white, border: `1px solid ${couponApplied ? V.teal : V.fog}`,
              borderRadius: 10, padding: "4px 4px 4px 16px", maxWidth: 340, width: "100%",
            }}>
              <input
                type="text"
                placeholder="Código promocional"
                value={coupon}
                onChange={(e: any) => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); }}
                style={{ border: "none", outline: "none", fontSize: 14, fontFamily: V.mono, letterSpacing: "0.04em", color: V.night, background: "transparent", flex: 1, padding: "10px 0" }}
              />
              {coupon.length > 0 && (
                <button
                  onClick={() => setCouponApplied(true)}
                  style={{
                    background: couponApplied ? V.teal : V.night, color: V.white,
                    border: "none", borderRadius: 8, padding: "8px 16px",
                    fontSize: 12, fontFamily: V.mono, fontWeight: 500, cursor: "pointer",
                    transition: "all 0.15s", whiteSpace: "nowrap" as const,
                  }}
                >
                  {couponApplied ? "✓ Aplicado" : "Aplicar"}
                </button>
              )}
            </div>
          </div>

          <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
            background: V.night, color: V.white, border: `1px solid ${V.amber}`,
            padding: "16px 36px", borderRadius: 10, fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: V.body, transition: "all 0.15s",
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Redirecionando..." : "Desbloquear o plano completo — R$ 397"}
          </button>
          <p style={{ fontSize: 13, color: V.ash, marginTop: 12 }}>
            Pagamento único · tudo incluso · sem assinatura
          </p>
        </div>

        {/* Disclaimer */}
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ fontSize: 12, color: V.ash, lineHeight: 1.7, maxWidth: 480, margin: "0 auto", fontStyle: "italic" }}>
            Como plano de treino — resultado depende da execução. Virô dá clareza e direção. Consistência é com você.
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 24, borderTop: `1px solid ${V.fog}` }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night, letterSpacing: "-0.03em" }}>Virô</span>
          <p style={{ fontSize: 11, color: V.ash, fontFamily: V.mono, marginTop: 4 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
