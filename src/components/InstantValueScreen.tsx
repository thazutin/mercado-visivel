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
  // Block 2 data
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

// ─── Main Component ─────────────────────────────────────────────────

export default function InstantValueScreen({ product, region, results, onCheckout, loading }: Props) {
  const [show, setShow] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => setShow(true), 100);
    setTimeout(() => setBarWidth(results.influencePercent), 800);
  }, [results.influencePercent]);

  const termCount = results.termGeneration?.count || results.terms.length;
  const hasRealData = results.pipeline?.sourcesUsed && results.pipeline.sourcesUsed.length > 2;
  const serpData = results.serpSummary;
  const mapsData = results.maps;
  const igData = results.instagram;
  const competitors = results.competitorInstagram || [];
  const breakdown = results.influenceBreakdown;

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
            Seu mercado ao redor
          </div>
          <p style={{ fontSize: 14, color: V.ash }}>{product} · {region}</p>
        </div>

        {/* ═══ INFLUENCE SCORE (hero) ═══ */}
        <Card style={{ padding: "36px 28px", marginBottom: 16, textAlign: "center" }}>
          <SectionLabel color={V.amber}>Sua influência digital local</SectionLabel>
          <div style={{
            fontFamily: V.display, fontSize: "clamp(48px, 8vw, 72px)", fontWeight: 700,
            color: V.night, letterSpacing: "-0.04em", lineHeight: 1,
          }}>
            ~{results.influencePercent}%
          </div>
          <div style={{ fontFamily: V.mono, fontSize: 12, color: V.ash, marginTop: 8, marginBottom: 20 }}>
            do mercado digital ao redor
          </div>

          {/* Influence bar */}
          <div style={{ height: 10, borderRadius: 5, background: V.fog, overflow: "hidden", marginBottom: 20 }}>
            <div style={{
              height: "100%", borderRadius: 5,
              background: `linear-gradient(90deg, ${V.amber}, ${V.teal})`,
              width: `${Math.max(barWidth, 1)}%`,
              transition: "width 1.5s cubic-bezier(0.16, 1, 0.3, 1)",
            }} />
          </div>

          {/* Breakdown chips */}
          {breakdown && (
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4285F4" }} />
                <span style={{ fontFamily: V.mono, fontSize: 11, color: V.zinc }}>Google {breakdown.google}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E1306C" }} />
                <span style={{ fontFamily: V.mono, fontSize: 11, color: V.zinc }}>Instagram {breakdown.instagram}%</span>
              </div>
              {breakdown.web !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: V.teal }} />
                  <span style={{ fontFamily: V.mono, fontSize: 11, color: V.zinc }}>Web {breakdown.web}%</span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ═══ GOOGLE PRESENCE ═══ */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SectionLabel color="#4285F4">Presença no Google</SectionLabel>
            {serpData && (
              <div style={{ display: "flex", gap: 6 }}>
                {serpData.hasLocalPack && <Chip color={V.teal}>Local Pack</Chip>}
                {serpData.hasAds && <Chip color={V.coral}>Ads ativos</Chip>}
              </div>
            )}
          </div>

          {/* SERP summary */}
          {serpData && (
            <div style={{
              background: serpData.termsRanked > 0 ? V.tealWash : V.coralWash,
              borderRadius: 10, padding: "14px 18px", marginBottom: 16,
            }}>
              <p style={{ fontSize: 14, color: V.night, margin: 0, lineHeight: 1.6 }}>
                {serpData.termsRanked === 0 ? (
                  <>Seu negócio <strong>não aparece no top 10</strong> para nenhum dos {serpData.termsScraped} termos principais pesquisados.</>
                ) : (
                  <>Você aparece no top 10 para <strong>{serpData.termsRanked} de {serpData.termsScraped}</strong> termos pesquisados.</>
                )}
              </p>
            </div>
          )}

          {/* Maps data */}
          {mapsData && mapsData.found && (
            <div style={{
              display: "flex", gap: 16, padding: "14px 0",
              borderTop: `1px solid ${V.fog}`, alignItems: "center",
            }}>
              <div style={{ fontSize: 13, color: V.zinc }}>Google Maps</div>
              <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
                {mapsData.rating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#FBBC04", fontSize: 14 }}>★</span>
                    <span style={{ fontFamily: V.mono, fontSize: 13, color: V.night, fontWeight: 600 }}>{mapsData.rating}</span>
                  </div>
                )}
                {mapsData.reviewCount !== null && mapsData.reviewCount > 0 && (
                  <span style={{ fontFamily: V.mono, fontSize: 12, color: V.ash }}>
                    {mapsData.reviewCount} avaliações
                  </span>
                )}
                {mapsData.inLocalPack && <Chip color={V.teal}>Local Pack</Chip>}
              </div>
            </div>
          )}
          {mapsData && !mapsData.found && (
            <div style={{
              padding: "14px 0", borderTop: `1px solid ${V.fog}`,
            }}>
              <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>
                Google Maps: perfil não encontrado na busca direta — considere verificar ou criar ficha no Google Meu Negócio.
              </p>
            </div>
          )}

          {/* Terms with positions */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash }}>Termo</span>
              <span style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash }}>Posição</span>
            </div>
            {results.terms.slice(0, 8).map((t, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: 8,
                background: i % 2 === 0 ? V.cloud : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <span style={{ fontSize: 14, color: V.night }}>{t.term}</span>
                  {t.serpFeatures && t.serpFeatures.length > 0 && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {t.serpFeatures.includes("people_also_ask") && (
                        <Chip color={V.ash}>Perguntas</Chip>
                      )}
                      {t.serpFeatures.includes("local_pack") && (
                        <Chip color={V.teal}>Mapa</Chip>
                      )}
                      {t.serpFeatures.includes("ads") && (
                        <Chip color={V.coral}>Anúncio</Chip>
                      )}
                      {t.serpFeatures.includes("featured_snippet") && (
                        <Chip color={V.amber}>Destaque</Chip>
                      )}
                    </div>
                  )}
                </div>
                <span style={{
                  fontFamily: V.mono, fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: "right",
                  color: t.position !== "—" && parseInt(t.position) <= 3 ? V.teal
                    : t.position !== "—" && parseInt(t.position) <= 10 ? V.amber
                    : V.ash,
                }}>
                  {t.position === "—" ? "—" : `#${t.position}`}
                </span>
              </div>
            ))}
            {results.terms.length > 8 && (
              <div style={{ textAlign: "center", padding: "8px", fontSize: 12, color: V.ash }}>
                +{results.terms.length - 8} termos mapeados
              </div>
            )}
          </div>
        </Card>


        {/* ═══ INSTAGRAM ═══ */}
        {(igData?.dataAvailable || competitors.length > 0) && (
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel color="#E1306C">Instagram · alcance e engajamento</SectionLabel>

            {/* Explanation of Instagram influence */}
            {breakdown && breakdown.instagram > 0 && (
              <div style={{
                background: "rgba(225,48,108,0.06)", borderRadius: 10,
                padding: "14px 18px", marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, color: V.night, margin: 0, lineHeight: 1.6 }}>
                  Seu perfil captura <strong>{breakdown.instagram}%</strong> do alcance total entre você e seus concorrentes diretos.
                  {igData && competitors.length > 0 && (() => {
                    const yourReach = igData.avgViews || igData.avgLikes || 0;
                    const maxCompReach = Math.max(...competitors.map(c => (c as any).avgViews || (c as any).avgLikes || c.followers * 0.1));
                    if (yourReach < maxCompReach * 0.3) return " Há espaço significativo para crescer em alcance.";
                    if (yourReach < maxCompReach) return " Você está competindo, mas ainda abaixo dos líderes.";
                    return " Você tem bom alcance relativo.";
                  })()}
                </p>
              </div>
            )}

            {/* Comparative table — reach-focused */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: V.body }}>
                <thead>
                  <tr>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash }}>Perfil</td>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, textAlign: "right" }}>Alcance médio</td>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, textAlign: "right" }}>Engajamento</td>
                    <td style={{ padding: "8px 12px", fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: V.ash, textAlign: "right" }}>Posts/30d</td>
                    <td style={{ padding: "8px 8px", width: 90 }}></td>
                  </tr>
                </thead>
                <tbody>
                  {/* Business row */}
                  {igData?.dataAvailable && (() => {
                    const reach = igData.avgViews || igData.avgLikes || 0;
                    const allReaches = [reach, ...competitors.map(c => (c as any).avgViews || (c as any).avgLikes || c.followers * 0.1)];
                    const maxReach = Math.max(...allReaches, 1);
                    return (
                      <tr style={{ background: V.amberWash }}>
                        <td style={{ padding: "12px", borderRadius: "8px 0 0 8px" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: V.night }}>@{igData.handle}</div>
                          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, marginTop: 1 }}>Seu negócio</div>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <div style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night }}>{reach.toLocaleString("pt-BR")}</div>
                          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>{igData.avgViews > 0 ? "views" : "curtidas"}</div>
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
                          <span style={{
                            fontFamily: V.mono, fontSize: 13, fontWeight: 600,
                            color: igData.postsLast30d >= 8 ? V.teal : igData.postsLast30d >= 4 ? V.amber : V.coral,
                          }}>
                            {igData.postsLast30d}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px", borderRadius: "0 8px 8px 0" }}>
                          <BarMini value={reach} max={maxReach} color={V.amber} />
                        </td>
                      </tr>
                    );
                  })()}

                  {/* Competitor rows */}
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
                          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>{(c as any).avgViews > 0 ? "views" : "est."}</div>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{
                            fontFamily: V.mono, fontSize: 13,
                            color: c.engagementRate >= 0.03 ? V.teal : c.engagementRate >= 0.01 ? V.amber : V.ash,
                          }}>
                            {(c.engagementRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <span style={{ fontFamily: V.mono, fontSize: 13, color: V.zinc }}>
                            {c.postsLast30d}
                          </span>
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

            {/* Context note */}
            <div style={{ marginTop: 14, padding: "10px 14px", background: V.cloud, borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.6 }}>
                Alcance médio = views em reels ou curtidas em posts recentes. 
                Engajamento = interações ÷ alcance. Dados coletados em tempo real.
              </p>
            </div>
          </Card>
        )}

        {/* ═══ MARKET SIZE (when volumes available) ═══ */}
        {(results.marketLow > 0 || results.totalVolume > 0) && (
          <Card style={{ marginBottom: 16, textAlign: "center" }}>
            <SectionLabel>Mercado disponível na sua região</SectionLabel>
            <div style={{
              fontFamily: V.display, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700,
              color: V.night, letterSpacing: "-0.03em", lineHeight: 1,
            }}>
              R$ <AnimatedCounter target={results.marketLow} duration={1500} /> — <AnimatedCounter target={results.marketHigh} duration={1800} />
            </div>
            <div style={{ fontFamily: V.mono, fontSize: 12, color: V.ash, marginTop: 8 }}>por mês</div>
          </Card>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ...(results.totalVolume > 0 ? [{ label: "buscas/mês", value: results.totalVolume.toLocaleString("pt-BR") }] : []),
            ...(results.avgCpc > 0 ? [{ label: "CPC médio", value: `R$ ${results.avgCpc.toFixed(2)}` }] : []),
            { label: "termos mapeados", value: termCount.toString() },
            ...(serpData ? [{ label: "termos no top 10", value: `${serpData.termsRanked} de ${serpData.termsScraped}` }] : []),
          ].map((s, i) => (
            <div key={i} style={{
              flex: "1 1 120px", background: V.white, borderRadius: 12,
              border: `1px solid ${V.fog}`, padding: "16px", textAlign: "center",
            }}>
              <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 700, color: V.night, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ═══ GAP ANALYSIS ═══ */}
        {results.gapHeadline && (
          <div style={{
            background: V.amberWash, borderLeft: `3px solid ${V.amber}`,
            padding: "16px 20px", borderRadius: "0 10px 10px 0", marginBottom: 16,
          }}>
            <p style={{ fontSize: 14, color: V.night, lineHeight: 1.7, margin: 0 }}>
              {results.gapHeadline}
            </p>
          </div>
        )}

        {/* Gap items preview */}
        {results.gaps && results.gaps.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <SectionLabel color={V.amber}>Gaps identificados</SectionLabel>
            {results.gaps.slice(0, 3).map((gap: any, i: number) => (
              <div key={i} style={{
                padding: "12px 0",
                borderBottom: i < Math.min(results.gaps!.length, 3) - 1 ? `1px solid ${V.fog}` : "none",
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 4 }}>
                  {gap.title || gap.gap || `Gap ${i + 1}`}
                </div>
                <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6 }}>
                  {gap.description || gap.detail || ""}
                </div>
              </div>
            ))}
            {results.gaps.length > 3 && (
              <div style={{ fontSize: 12, color: V.ash, marginTop: 8 }}>
                +{results.gaps.length - 3} gaps no diagnóstico completo
              </div>
            )}
          </Card>
        )}

        {/* ═══ METHODOLOGY ═══ */}
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
                google_ads: "Google Ads KP",
              };
              return (
                <Chip key={i} color={V.teal}>{labels[src] || src}</Chip>
              );
            })}
            {(results.pipeline?.sourcesUnavailable || []).filter(s => s !== "google_trends" && s !== "similarweb").map((src, i) => {
              const labels: Record<string, string> = {
                google_ads: "Volume (em breve)",
                serp_scraper: "SERP",
                google_maps: "Maps",
                instagram: "Instagram",
              };
              return (
                <Chip key={`u-${i}`} color={V.ash}>{labels[src] || src}</Chip>
              );
            })}
          </div>
          {results.pipeline?.durationMs && (
            <div style={{ fontFamily: V.mono, fontSize: 11, color: V.ash, marginTop: 12 }}>
              Processado em {(results.pipeline.durationMs / 1000).toFixed(1)}s · {results.pipeline.version}
            </div>
          )}
        </Card>

        {/* ═══ BRIDGE TEXT ═══ */}
        <div style={{ padding: "0 8px", marginBottom: 32 }}>
          <p style={{ fontSize: 16, color: V.night, lineHeight: 1.75, fontFamily: V.body, marginBottom: 12, fontWeight: 600 }}>
            Esse mercado existe. Ele não depende de você — já está lá.
          </p>
          <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.75 }}>
            A pergunta é: como aumentar a probabilidade de que, quando alguém nesse mercado precisar do que você oferece, seu negócio seja lembrado? Não existe garantia — mas existe um plano baseado em evidência.
          </p>
        </div>

        {/* ═══ WHAT VIRÔ UNLOCKS ═══ */}
        <div style={{ background: V.night, borderRadius: 14, padding: "32px 24px", marginBottom: 12, color: V.white }}>
          <SectionLabel color={V.amber}>O que Virô desbloqueia</SectionLabel>

          <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.04em", color: V.ash, marginBottom: 12, textTransform: "uppercase" as const }}>
            Diagnóstico · R$ 497 único
          </div>
          {[
            { title: "Posicionamento completo", desc: "Sua posição real vs concorrentes em cada canal — Google, Instagram, Maps" },
            { title: "Mapa de demanda", desc: "Termos com volume real, intenção classificada e CPC da sua região" },
            { title: "Plano de 12 semanas", desc: "Ações concretas, semana a semana, personalizadas pro seu negócio e mercado" },
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: V.amber, marginTop: 8, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: V.display, fontSize: 15, fontWeight: 600, color: V.white, marginBottom: 2 }}>{d.title}</div>
                <div style={{ fontSize: 13, color: V.ash, lineHeight: 1.5 }}>{d.desc}</div>
              </div>
            </div>
          ))}

          <div style={{ borderTop: `1px solid ${V.graphite}`, marginTop: 20, paddingTop: 20 }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.04em", color: V.ash, marginBottom: 12, textTransform: "uppercase" as const }}>
              Acompanhamento semanal · R$ 197/mês
            </div>
            {[
              { title: "Briefing toda semana", desc: "O que mudou no seu mercado, o que importa e o que fazer — em 3 minutos de leitura" },
              { title: "Monitoramento contínuo", desc: "Posição no Google, movimentos dos concorrentes, variação de demanda" },
              { title: "Ação da semana", desc: "Uma ação concreta pra executar — sem jargão, sem enrolação" },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: V.teal, marginTop: 8, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: V.display, fontSize: 15, fontWeight: 600, color: V.white, marginBottom: 2 }}>{d.title}</div>
                  <div style={{ fontSize: 13, color: V.ash, lineHeight: 1.5 }}>{d.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 20, padding: "14px 18px", borderRadius: 10,
            background: V.graphite, border: `1px solid ${V.slate}`,
          }}>
            <p style={{ fontSize: 13, color: V.mist, lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: V.amberSoft }}>Por que é diferente de "agentes de AI":</strong> Virô não gera conteúdo genérico nem faz promessas de automação mágica. Cruza dados reais do seu mercado local, toda semana, e traduz em ação específica pro seu negócio. Dado real → ação clara → resultado seu.
            </p>
          </div>
        </div>

        {/* ═══ COUPON + CTA ═══ */}
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
            {couponApplied && (
              <div style={{ fontSize: 12, color: V.teal, marginTop: 8, fontFamily: V.mono }}>
                Cupom {coupon} será validado no checkout
              </div>
            )}
          </div>

          <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
            background: V.night, color: V.white, border: `1px solid ${V.amber}`,
            padding: "16px 36px", borderRadius: 10, fontSize: 15, fontWeight: 600,
            cursor: "pointer", fontFamily: V.body, transition: "all 0.15s",
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Redirecionando..." : couponApplied ? "Desbloquear o como" : "Desbloquear o como — R$ 497"}
          </button>
          {couponApplied && (
            <p style={{ fontSize: 14, color: V.night, marginTop: 12, fontWeight: 500 }}>
              <span style={{ textDecoration: "line-through", color: V.ash }}>R$ 497</span>{" "}
              <span style={{ color: V.teal }}>Desconto aplicado no checkout</span>
            </p>
          )}
          {!couponApplied && (
            <p style={{ fontSize: 13, color: V.ash, marginTop: 12 }}>
              Pagamento único · Acompanhamento semanal opcional: R$ 197/mês
            </p>
          )}
        </div>

        {/* ═══ DISCLAIMER ═══ */}
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ fontSize: 12, color: V.ash, lineHeight: 1.7, maxWidth: 480, margin: "0 auto", fontStyle: "italic" }}>
            Como plano de treino — resultado depende da execução. Virô dá clareza e direção. Consistência é com você.
          </p>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{ textAlign: "center", paddingTop: 24, borderTop: `1px solid ${V.fog}` }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night, letterSpacing: "-0.03em" }}>Virô</span>
          <p style={{ fontSize: 11, color: V.ash, fontFamily: V.mono, marginTop: 4 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
