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
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; leadId?: string; }

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

export default function InstantValueScreen({ product, region, results, onCheckout, loading, leadId }: Props) {
  const [show, setShow] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const termCount = results.termGeneration?.count || results.terms.length;
  const hasVolume = results.totalVolume > 0;
  const serpData = results.serpSummary;
  const igData = results.instagram;
  const breakdown = results.influenceBreakdown;
  const competitors = results.competitorInstagram || [];
  const shortRegion = region.split(",")[0].trim();

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

        {/* ═══ HERO ═══ */}
        <div style={{ background: V.white, borderRadius: 16, padding: "32px 24px", marginBottom: 16, textAlign: "center", border: `1px solid ${V.fog}` }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: V.display, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, fontSize: hasVolume ? "clamp(40px, 8vw, 64px)" : "clamp(36px, 7vw, 52px)", color: V.night }}>
              {hasVolume ? <><AnimatedCounter target={results.totalVolume} duration={1500} />/mês</> : <>{termCount} termos</>}
            </div>
            <p style={{ fontSize: 13, color: V.zinc, margin: "8px 0 0", lineHeight: 1.5 }}>
              {hasVolume ? `buscas no Google por ${product} na sua região` : `de busca mapeados para ${product} em ${shortRegion}`}
            </p>
            {hasVolume && results.pipeline?.sourcesUsed?.includes("claude_volume_estimate") && (
              <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontFamily: V.mono }}>volume estimado · dados exatos em breve</p>
            )}
          </div>
          <div style={{ height: 1, background: V.fog, margin: "0 -24px 28px" }} />
          <div>
            <div style={{ fontFamily: V.display, fontSize: "clamp(40px, 8vw, 64px)", fontWeight: 700, color: results.influencePercent === 0 ? V.coral : results.influencePercent < 20 ? V.amber : V.teal, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {results.influencePercent}%
            </div>
            <p style={{ fontSize: 13, color: V.zinc, margin: "8px 0 0", lineHeight: 1.5 }}>é sua influência digital nesse mercado</p>
          </div>
        </div>

        {/* Contexto */}
        <div style={{ background: results.influencePercent === 0 ? V.coralWash : V.amberWash, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ fontSize: 14, color: V.night, margin: 0, lineHeight: 1.6 }}>
            {results.influencePercent === 0
              ? `Quando alguém busca ${product} em ${shortRegion}, você não aparece. Enquanto isso, seus concorrentes recebem esses clientes.`
              : results.influencePercent < 20
              ? `Você captura ${results.influencePercent}% do mercado digital. O restante vai para quem tem mais presença — não necessariamente quem é melhor.`
              : `Você captura ${results.influencePercent}% do mercado digital — boa posição. O plano mostra como proteger e ampliar essa vantagem.`}
          </p>
        </div>

        {/* ═══ DRILL-DOWNS ═══ */}

        <Expandable title={`${termCount} termos mapeados`}>
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Termos reais que pessoas buscam no Google quando precisam de {product} na sua região.
          </p>
          {results.terms.slice(0, 15).map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: i < 14 ? `1px solid ${V.fog}` : "none" }}>
              <span style={{ fontSize: 13, color: V.night, lineHeight: 1.4 }}>{t.term}</span>
              {t.volume > 0 && <span style={{ fontFamily: V.mono, fontSize: 11, color: V.zinc, flexShrink: 0, marginLeft: 8 }}>{t.volume.toLocaleString("pt-BR")}/mês</span>}
            </div>
          ))}
          {results.terms.length > 15 && <p style={{ fontSize: 11, color: V.ash, marginTop: 8, textAlign: "center" }}>+{results.terms.length - 15} termos no diagnóstico completo</p>}
        </Expandable>

        <Expandable title="Como medimos sua influência">
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Cruzamos dados de Google, Instagram e AI para calcular quanto do mercado digital local você captura.
          </p>

          {/* Google */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Google</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.google || 0}%</span>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
              {serpData?.termsRanked === 0
                ? `Não aparece no top 10 para nenhum dos ${serpData?.termsScraped || 0} termos.`
                : serpData ? `Aparece para ${serpData.termsRanked} de ${serpData.termsScraped} termos.` : "SERP não disponível."}
              {results.maps?.found ? ` Maps: ★ ${results.maps.rating || "—"} (${results.maps.reviewCount || 0} avaliações).` : " Maps: não encontrado."}
            </p>
          </div>

          {/* Instagram with full details */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Instagram</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.instagram || 0}%</span>
            </div>
            {igData?.dataAvailable ? (
              <>
                <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px", lineHeight: 1.5 }}>
                  @{igData.handle}: {igData.followers.toLocaleString("pt-BR")} seguidores · {(igData.avgViews || igData.avgLikes || 0).toLocaleString("pt-BR")} alcance médio · {(igData.engagementRate * 100).toFixed(1)}% engajamento · {igData.postsLast30d} posts/30d
                </p>
                {/* Competitor table */}
                {competitors.length > 0 && (
                  <div style={{ background: V.cloud, borderRadius: 8, padding: "10px 12px", marginTop: 4 }}>
                    <p style={{ fontSize: 10, color: V.ash, margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Comparativo</p>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, borderBottom: `1px solid ${V.fog}` }}>
                      <span style={{ color: V.ash, width: "30%" }}>Perfil</span>
                      <span style={{ color: V.ash, width: "20%", textAlign: "right" }}>Seguidores</span>
                      <span style={{ color: V.ash, width: "25%", textAlign: "right" }}>Alcance</span>
                      <span style={{ color: V.ash, width: "25%", textAlign: "right" }}>Engaj.</span>
                    </div>
                    {/* You */}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, background: V.amberWash, borderRadius: 4, paddingLeft: 4, paddingRight: 4, marginTop: 2 }}>
                      <span style={{ color: V.amber, fontWeight: 600, width: "30%" }}>@{igData.handle}</span>
                      <span style={{ color: V.night, width: "20%", textAlign: "right" }}>{igData.followers.toLocaleString("pt-BR")}</span>
                      <span style={{ color: V.night, width: "25%", textAlign: "right" }}>{(igData.avgViews || igData.avgLikes || 0).toLocaleString("pt-BR")}</span>
                      <span style={{ color: V.night, width: "25%", textAlign: "right" }}>{(igData.engagementRate * 100).toFixed(1)}%</span>
                    </div>
                    {/* Competitors */}
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
                {competitors.length === 0 && (
                  <p style={{ fontSize: 11, color: V.ash, margin: "4px 0 0" }}>
                    Influência calculada com base no alcance absoluto do perfil. Diagnóstico completo inclui comparativo com concorrentes da região.
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12, color: V.zinc, margin: 0 }}>Perfil não informado ou dados não coletados.</p>
            )}
          </div>

          {/* AI */}
          {results.aiVisibility && (
            <div style={{ padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>AI (ChatGPT, Perplexity)</span>
                <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{results.aiVisibility.score}/100</span>
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                {(() => {
                  const aiDimFactor = results.aiVisibility.factors?.find(
                    (f: any) => f.status === 'positive' && f.factor.startsWith('Aparece em buscas de IA')
                  );
                  if (aiDimFactor) {
                    return aiDimFactor.factor + `. Score ${results.aiVisibility.score}/100.`;
                  }
                  if (results.aiVisibility.likelyMentioned) {
                    return `Seu negócio provavelmente é mencionado em respostas de AI. Score ${results.aiVisibility.score}/100.`;
                  }
                  return `Não aparece em nenhuma busca de IA local. ${results.aiVisibility.summary}`;
                })()}
              </p>
            </div>
          )}
        </Expandable>

        {/* Rotas */}
        {results.workRoutes && results.workRoutes.length > 0 && (
          <Expandable title="Rotas de trabalho priorizadas" defaultOpen={true}>
            {results.gapHeadline && (
              <p style={{ fontSize: 13, color: V.night, margin: "0 0 12px", fontWeight: 500, lineHeight: 1.5 }}>{results.gapHeadline}</p>
            )}
            {results.workRoutes.sort((a, b) => a.priority - b.priority).slice(0, 3).map((route, i) => (
              <div key={i} style={{ padding: "12px", marginBottom: 8, borderRadius: 8, background: i === 0 ? V.amberWash : V.cloud }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: V.mono, fontSize: 10, fontWeight: 600, color: i === 0 ? V.amber : V.zinc, background: i === 0 ? "rgba(207,133,35,0.15)" : V.fog, width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{route.priority}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{route.title}</span>
                  <Chip color={route.horizon === "curto prazo" ? V.teal : V.amber}>{route.horizon}</Chip>
                </div>
                <p style={{ fontSize: 12, color: V.zinc, margin: "4px 0 0", lineHeight: 1.5, paddingLeft: 28 }}>{route.rationale}</p>
              </div>
            ))}
          </Expandable>
        )}

        {/* Metodologia */}
        <Expandable title="Fontes de dados e metodologia">
          <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px", lineHeight: 1.5 }}>
            Cruzamos {results.pipeline?.sourcesUsed?.length || 2} fontes em tempo real.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(results.pipeline?.sourcesUsed || []).map((src, i) => {
              const labels: Record<string, string> = {
                claude_term_gen: "IA · Termos", apify_serp: "Google SERP", apify_maps: "Google Maps",
                apify_instagram: "Instagram", claude_gap_analysis: "IA · Análise", google_ads: "Google Ads",
                dataforseo: "DataForSEO", ai_visibility: "IA · Visibilidade", claude_fallback_terms: "IA · Fallback",
                auto_competitor_discovery: "Concorrentes auto", claude_volume_estimate: "IA · Volume estimado",
              };
              return <Chip key={i} color={V.teal}>{labels[src] || src}</Chip>;
            })}
          </div>
          {results.pipeline?.durationMs && (
            <p style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, marginTop: 8 }}>{(results.pipeline.durationMs / 1000).toFixed(1)}s · {results.pipeline.version}</p>
          )}
        </Expandable>

        {/* ═══ CTA ═══ */}
        <div style={{ padding: "24px 0 16px" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: V.night, margin: "0 0 8px", lineHeight: 1.4 }}>
            Pare de adivinhar. Comece a decidir com dado.
          </p>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 4px", lineHeight: 1.6 }}>
            <strong style={{ color: V.night }}>De:</strong> Faço posts e espero que apareça cliente
          </p>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 20px", lineHeight: 1.6 }}>
            <strong style={{ color: V.teal }}>Para:</strong> Sei onde estou, onde estão meus concorrentes e o que fazer essa semana
          </p>
        </div>

        <div style={{ background: V.night, borderRadius: 14, padding: "28px 20px", marginBottom: 16, color: V.white }}>
          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 4 }}>
            Pacote completo · pagamento único
          </div>
          <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>R$ 397</div>

          {["Diagnóstico completo por canal", "Plano de 90 dias com ações semanais", "Sugestão de ação semanal por email + WhatsApp"].map((d, i) => (
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
              {loading ? "Redirecionando..." : "Desbloquear plano completo"}
            </button>
            <p style={{ fontSize: 11, color: V.ash, textAlign: "center", marginTop: 8 }}>Pagamento único · sem assinatura</p>
          </div>
        </div>

        {/* Prévia — focado no COMO */}
        <Expandable title="Prévia do que você recebe">
          <div style={{ padding: "12px", borderRadius: 8, background: V.cloud, marginBottom: 8, borderLeft: `3px solid ${V.amber}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 4 }}>Diagnóstico completo</div>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>
              Onde você está de verdade — Google, Instagram, Maps e AI — comparado com quem disputa os mesmos clientes na sua região.
            </div>
          </div>
          <div style={{ padding: "12px", borderRadius: 8, background: V.cloud, marginBottom: 8, borderLeft: `3px solid ${V.teal}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 4 }}>Plano de 90 dias</div>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>
              O que fazer, em que ordem e por quê — para sair da posição atual com ações concretas a cada semana.
            </div>
          </div>
          <div style={{ padding: "12px", borderRadius: 8, background: V.cloud, borderLeft: `3px solid #8B5CF6` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 4 }}>Inteligência semanal</div>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5, marginBottom: 8 }}>
              Toda semana: o que mudou no seu mercado + uma ação específica com o como executar. Por email e WhatsApp.
            </div>
            <div style={{ fontSize: 11, color: V.ash, lineHeight: 1.5, fontStyle: "italic" }}>
              Ex: "Otimize o Google Meu Negócio — 3 passos" · "Grave Reels 30s com roteiro" · "Invista R$X em mídia e capture Y clientes"
            </div>
          </div>
        </Expandable>

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
