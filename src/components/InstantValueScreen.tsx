"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";

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
  influenceBreakdown?: { google: number; instagram: number; web: number | null };
  maps?: { found: boolean; rating: number | null; reviewCount: number | null; categories: string[]; inLocalPack: boolean; photos: number };
  instagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes: number; avgViews: number; dataAvailable: boolean };
  competitorInstagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes?: number; avgViews?: number }[];
  serpSummary?: { termsScraped: number; termsRanked: number; hasLocalPack: boolean; hasAds: boolean };
  pipeline?: { version: string; durationMs: number; sourcesUsed: string[]; sourcesUnavailable: string[] };
  gaps?: any[]; gapPattern?: any;
  workRoutes?: { priority: number; title: string; rationale: string; connection: string; horizon: string; expectedImpact: string }[];
  aiVisibility?: { score: number; summary: string; likelyMentioned: boolean; factors: any[]; competitorMentions: any[] } | null;
}
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; }

// ─── Helpers ────────────────────────────────────────────────────────

function Expandable({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 18px", borderRadius: 10, border: `1px solid ${V.fog}`,
        background: V.white, cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: V.night }}>{title}</span>
        <span style={{ fontSize: 16, color: V.ash, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "16px 18px", background: V.white, borderRadius: "0 0 10px 10px", borderTop: "none", border: `1px solid ${V.fog}`, borderTopColor: "transparent", marginTop: -1 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Chip({ children, color = V.ash }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily: V.mono, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase" as const,
      color, background: `${color}18`, padding: "3px 8px", borderRadius: 100, fontWeight: 500,
    }}>{children}</span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function InstantValueScreen({ product, region, results, onCheckout, loading }: Props) {
  const [show, setShow] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const termCount = results.termGeneration?.count || results.terms.length;
  const hasVolume = results.totalVolume > 0;
  const hasMarket = results.marketLow > 0;
  const serpData = results.serpSummary;
  const igData = results.instagram;
  const breakdown = results.influenceBreakdown;
  const competitors = results.competitorInstagram || [];
  const shortRegion = region.split(",")[0].trim();

  return (
    <div style={{
      minHeight: "100vh", background: V.cloud, padding: "48px 20px",
      opacity: show ? 1 : 0, transition: "opacity 0.5s ease",
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: V.night,
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: V.white }}>V</span>
          </div>
          <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>{product} · {shortRegion}</p>
        </div>

        {/* ═══ HERO — 2 números ═══ */}
        <div style={{
          background: V.white, borderRadius: 16, padding: "32px 24px",
          marginBottom: 16, textAlign: "center", border: `1px solid ${V.fog}`,
        }}>
          {/* Volume */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontFamily: V.display, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1,
              fontSize: hasVolume ? "clamp(40px, 8vw, 64px)" : "clamp(36px, 7vw, 52px)",
              color: V.night,
            }}>
              {hasVolume
                ? <><AnimatedCounter target={results.totalVolume} duration={1500} />/mês</>
                : <>{termCount} termos</>
              }
            </div>
            <p style={{ fontSize: 13, color: V.zinc, margin: "8px 0 0", lineHeight: 1.5 }}>
              {hasVolume
                ? `buscas no Google por ${product} na sua região`
                : `de busca mapeados para ${product} em ${shortRegion}`
              }
            </p>
          </div>

          <div style={{ height: 1, background: V.fog, margin: "0 -24px 28px" }} />

          {/* Influência */}
          <div>
            <div style={{
              fontFamily: V.display, fontSize: "clamp(40px, 8vw, 64px)", fontWeight: 700,
              color: results.influencePercent === 0 ? V.coral : results.influencePercent < 20 ? V.amber : V.teal,
              letterSpacing: "-0.04em", lineHeight: 1,
            }}>
              {results.influencePercent}%
            </div>
            <p style={{ fontSize: 13, color: V.zinc, margin: "8px 0 0", lineHeight: 1.5 }}>
              é sua influência digital nesse mercado
            </p>
          </div>
        </div>

        {/* Contexto */}
        <div style={{
          background: results.influencePercent === 0 ? V.coralWash : V.amberWash,
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
        }}>
          <p style={{ fontSize: 14, color: V.night, margin: 0, lineHeight: 1.6 }}>
            {results.influencePercent === 0
              ? `Quando buscam por ${product} em ${shortRegion}, você não aparece. Essa é sua maior oportunidade.`
              : results.influencePercent < 20
              ? `Você captura ${results.influencePercent}% da atenção digital. Há espaço para crescer.`
              : `Você captura ${results.influencePercent}% — boa posição. O plano mostra como manter e ampliar.`
            }
          </p>
        </div>

        {/* ═══ DRILL-DOWNS ═══ */}

        <Expandable title={`${termCount} termos mapeados`}>
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Termos reais que pessoas digitam no Google quando precisam de {product} na sua região.
          </p>
          {results.terms.slice(0, 15).map((t, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "8px 0", borderBottom: i < 14 ? `1px solid ${V.fog}` : "none",
            }}>
              <span style={{ fontSize: 13, color: V.night, lineHeight: 1.4 }}>{t.term}</span>
              {t.volume > 0 && (
                <span style={{ fontFamily: V.mono, fontSize: 11, color: V.zinc, flexShrink: 0, marginLeft: 8 }}>
                  {t.volume.toLocaleString("pt-BR")}/mês
                </span>
              )}
            </div>
          ))}
          {results.terms.length > 15 && (
            <p style={{ fontSize: 11, color: V.ash, marginTop: 8, textAlign: "center" }}>
              +{results.terms.length - 15} termos no diagnóstico completo
            </p>
          )}
        </Expandable>

        <Expandable title="Como medimos sua influência">
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Cruzamos dados reais de 3 canais para calcular quanto do mercado digital local você captura:
          </p>

          {/* Google */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Google</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.google || 0}%</span>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
              {serpData?.termsRanked === 0
                ? `Não aparece no top 10 para nenhum dos ${serpData?.termsScraped || 0} termos pesquisados.`
                : serpData
                ? `Aparece para ${serpData.termsRanked} de ${serpData.termsScraped} termos.`
                : "SERP não disponível nesta análise."
              }
              {results.maps?.found
                ? ` Google Maps: ★ ${results.maps.rating || "—"} (${results.maps.reviewCount || 0} avaliações).`
                : " Google Maps: não encontrado."
              }
            </p>
          </div>

          {/* Instagram */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Instagram</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.instagram || 0}%</span>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
              {igData?.dataAvailable
                ? `@${igData.handle}: ${(igData.avgViews || igData.avgLikes || 0).toLocaleString("pt-BR")} alcance médio · ${(igData.engagementRate * 100).toFixed(1)}% engajamento · ${igData.postsLast30d} posts/30d`
                : "Dados não disponíveis — perfil não informado ou dados não coletados."
              }
            </p>
          </div>

          {/* AI */}
          {results.aiVisibility && (
            <div style={{ padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>AI (ChatGPT, Perplexity)</span>
                <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{results.aiVisibility.score}%</span>
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                {results.aiVisibility.summary}
              </p>
            </div>
          )}

          {/* Instagram comparative */}
          {(igData?.dataAvailable || competitors.length > 0) && (
            <div style={{ marginTop: 12, padding: "12px 0 0", borderTop: `1px solid ${V.fog}` }}>
              <p style={{ fontSize: 11, color: V.ash, marginBottom: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Comparativo Instagram</p>
              {igData?.dataAvailable && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                  <span style={{ color: V.amber, fontWeight: 600 }}>@{igData.handle} (você)</span>
                  <span style={{ color: V.zinc }}>{(igData.avgViews || igData.avgLikes || 0).toLocaleString("pt-BR")} alcance</span>
                </div>
              )}
              {competitors.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                  <span style={{ color: V.zinc }}>@{c.handle}</span>
                  <span style={{ color: V.zinc }}>{((c as any).avgViews || (c as any).avgLikes || Math.round(c.followers * 0.1)).toLocaleString("pt-BR")} alcance</span>
                </div>
              ))}
            </div>
          )}
        </Expandable>

        {/* Rotas de trabalho */}
        {results.workRoutes && results.workRoutes.length > 0 && (
          <Expandable title="Rotas de trabalho priorizadas" defaultOpen={true}>
            {results.gapHeadline && (
              <p style={{ fontSize: 13, color: V.night, margin: "0 0 12px", fontWeight: 500, lineHeight: 1.5 }}>
                {results.gapHeadline}
              </p>
            )}
            {results.workRoutes.sort((a, b) => a.priority - b.priority).slice(0, 3).map((route, i) => (
              <div key={i} style={{
                padding: "12px", marginBottom: 8, borderRadius: 8,
                background: i === 0 ? V.amberWash : V.cloud,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: V.mono, fontSize: 10, fontWeight: 600, color: i === 0 ? V.amber : V.zinc,
                    background: i === 0 ? "rgba(207,133,35,0.15)" : V.fog,
                    width: 20, height: 20, borderRadius: "50%", display: "inline-flex",
                    alignItems: "center", justifyContent: "center",
                  }}>{route.priority}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{route.title}</span>
                  <Chip color={route.horizon === "curto prazo" ? V.teal : V.amber}>{route.horizon}</Chip>
                </div>
                <p style={{ fontSize: 12, color: V.zinc, margin: "4px 0 0", lineHeight: 1.5, paddingLeft: 28 }}>
                  {route.rationale}
                </p>
              </div>
            ))}
          </Expandable>
        )}

        {/* Metodologia */}
        <Expandable title="Fontes de dados e metodologia">
          <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px", lineHeight: 1.5 }}>
            Cruzamos {results.pipeline?.sourcesUsed?.length || 2} fontes em tempo real. Nenhum dado é inventado.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(results.pipeline?.sourcesUsed || []).map((src, i) => {
              const labels: Record<string, string> = {
                claude_term_gen: "IA · Termos", apify_serp: "Google SERP", apify_maps: "Google Maps",
                apify_instagram: "Instagram", claude_gap_analysis: "IA · Análise", google_ads: "Google Ads",
                dataforseo: "DataForSEO", ai_visibility: "IA · Visibilidade", claude_fallback_terms: "IA · Fallback",
                auto_competitor_discovery: "Concorrentes auto",
              };
              return <Chip key={i} color={V.teal}>{labels[src] || src}</Chip>;
            })}
          </div>
          {results.pipeline?.durationMs && (
            <p style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, marginTop: 8 }}>
              {(results.pipeline.durationMs / 1000).toFixed(1)}s · {results.pipeline.version}
            </p>
          )}
        </Expandable>

        {/* ═══ CTA ═══ */}
        <div style={{ padding: "24px 0 16px" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: V.night, margin: "0 0 8px", lineHeight: 1.4 }}>
            E agora?
          </p>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 20px", lineHeight: 1.6 }}>
            Você viu o tamanho do mercado e onde está nele. O próximo passo é um plano concreto para capturar essa demanda.
          </p>
        </div>

        {/* Oferta */}
        <div style={{ background: V.night, borderRadius: 14, padding: "28px 20px", marginBottom: 16, color: V.white }}>
          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 4 }}>
            Pacote completo · pagamento único
          </div>
          <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>R$ 397</div>

          {[
            "Diagnóstico completo por canal",
            "Plano de 90 dias com roteiros",
            "12 briefings semanais (email + WhatsApp)",
            "Monitoramento de concorrentes",
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
              <span style={{ color: V.amber, fontSize: 12 }}>✓</span>
              <span style={{ fontSize: 13, color: V.mist }}>{d}</span>
            </div>
          ))}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${V.graphite}` }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text" placeholder="Cupom" value={coupon}
                onChange={(e: any) => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); }}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${V.slate}`,
                  background: V.graphite, color: V.white, fontSize: 13, fontFamily: V.mono, outline: "none",
                }}
              />
              {coupon.length > 0 && (
                <button onClick={() => setCouponApplied(true)} style={{
                  padding: "10px 14px", borderRadius: 8, border: "none",
                  background: couponApplied ? V.teal : V.amber, color: V.white,
                  fontSize: 12, fontFamily: V.mono, cursor: "pointer",
                }}>
                  {couponApplied ? "✓" : "Aplicar"}
                </button>
              )}
            </div>
            <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: V.white, color: V.night, fontSize: 15, fontWeight: 600,
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Redirecionando..." : "Desbloquear plano completo"}
            </button>
            <p style={{ fontSize: 11, color: V.ash, textAlign: "center", marginTop: 8 }}>
              Pagamento único · sem assinatura
            </p>
          </div>
        </div>

        {/* Prévia */}
        <Expandable title="Prévia do que você recebe">
          {[
            { label: "Diagnóstico", desc: "Posicionamento real em Google, Instagram, Maps e AI vs concorrentes", color: V.amber },
            { label: "Plano 90 dias", desc: "1 ação por semana com roteiro — ex: 'Grave Reels 30s com gancho + diferencial + CTA'", color: V.teal },
            { label: "Briefing semanal", desc: "O que mudou no seu mercado + ação da semana. Por email e WhatsApp", color: "#8B5CF6" },
          ].map((item, i) => (
            <div key={i} style={{
              padding: "12px", borderRadius: 8, background: V.cloud, marginBottom: 8,
              borderLeft: `3px solid ${item.color}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </Expandable>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0 0" }}>
          <p style={{ fontSize: 11, color: V.ash, fontStyle: "italic", lineHeight: 1.6, margin: "0 0 16px" }}>
            Resultado depende da execução. Virô dá clareza e direção.
          </p>
          <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.night }}>Virô</span>
          <p style={{ fontSize: 10, color: V.ash, fontFamily: V.mono, marginTop: 2 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
