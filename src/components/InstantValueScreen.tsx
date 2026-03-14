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
  instagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes: number; avgViews: number; recentPostsCount?: number; recentAvgReach?: number; dataAvailable: boolean };
  competitorInstagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes?: number; avgViews?: number }[];
  serpSummary?: { termsScraped: number; termsRanked: number; hasLocalPack: boolean; hasAds: boolean };
  pipeline?: { version: string; durationMs: number; sourcesUsed: string[]; sourcesUnavailable: string[] };
  gaps?: any[]; gapPattern?: any;
  workRoutes?: { priority: number; title: string; rationale: string; connection: string; horizon: string; expectedImpact: string }[];
  aiVisibility?: { score: number; summary: string; likelyMentioned: boolean; factors: any[]; competitorMentions: any[] } | null;
  audiencia?: {
    populacaoRaio: number; raioKm: number | null; densidade: 'alta' | 'baixa' | 'nacional';
    municipioNome: string; targetProfile: string; estimatedPercentage: number;
    audienciaTarget: number; rationale: string; ibgeAno?: number;
  } | null;
  competitionIndex?: {
    totalCompetitors: number; activeCompetitors: number; totalSearchVolume: number;
    indexValue: number; label: 'subatendido' | 'equilibrado' | 'saturado';
    labelText: string; color: 'green' | 'yellow' | 'red';
    competitors: { name: string; hasWebsite: boolean; hasInstagram: boolean; mapsPosition?: number; rating?: number; reviewCount?: number }[];
  } | null;
  clientType?: 'b2c' | 'b2b';
}
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; leadId?: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPop(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 2 ? `${m.toFixed(1).replace(".", ",")} milhões` : `${m.toFixed(1).replace(".", ",")} milhão`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`;
  return n.toLocaleString("pt-BR");
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
  const aud = results.audiencia;
  const hasAudiencia = aud && aud.audienciaTarget > 0;
  const hasInfluence = results.influencePercent > 0;
  const ci = results.competitionIndex;
  const hasCi = ci && (ci.totalSearchVolume > 0 || ci.totalCompetitors > 0);
  const isB2B = results.clientType === 'b2b';
  const audienciaLabel = isB2B ? 'empresas no seu mercado' : 'pessoas no seu mercado';
  const audienciaUnit = isB2B ? 'empresas' : 'pessoas';

  // Audiência sublabel
  const audSublabel = aud
    ? aud.densidade === "nacional"
      ? "Nacional"
      : `Raio ${aud.raioKm}km · ${aud.densidade === "alta" ? "Alta" : "Baixa"} densidade`
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

        {/* ═══ HERO: 3 BIG NUMBERS ═══ */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
        }}>
          {/* (a) Audiência Potencial */}
          {hasAudiencia ? (
            <div style={{ background: V.white, borderRadius: 14, padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}` }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, color: V.teal, letterSpacing: "-0.03em", lineHeight: 1 }}>
                ~{fmtPop(aud!.audienciaTarget)}
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>{audienciaLabel}</p>
              <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontFamily: V.mono }}>{audSublabel}</p>
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: 14, padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Audiência local indisponível para este município</p>
            </div>
          )}

          {/* (b) Buscas por mês */}
          {hasVolume ? (
            <div style={{ background: V.white, borderRadius: 14, padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}` }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, color: V.night, letterSpacing: "-0.03em", lineHeight: 1 }}>
                <AnimatedCounter target={results.totalVolume} duration={1500} />
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>buscas/mês nos seus termos</p>
              {results.pipeline?.sourcesUsed?.includes("claude_volume_estimate") && (
                <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontFamily: V.mono }}>volume estimado</p>
              )}
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: 14, padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Volume de buscas indisponível para este mercado</p>
            </div>
          )}

          {/* (c) Influência Digital */}
          {hasInfluence ? (
            <div style={{ background: V.white, borderRadius: 14, padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}` }}>
              <div style={{
                fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
                color: results.influencePercent < 20 ? V.amber : V.teal,
              }}>
                {results.influencePercent}%
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>de influência digital</p>
              <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontFamily: V.mono }}>{isB2B ? 'Google + LinkedIn + Instagram' : 'Google + Instagram + AI'}</p>
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: 14, padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}` }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, color: V.coral, letterSpacing: "-0.03em", lineHeight: 1 }}>0%</div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>de influência digital</p>
              <p style={{ fontSize: 10, color: V.coral, margin: "4px 0 0" }}>Invisível no mercado</p>
            </div>
          )}

          {/* (d) Índice de Saturação */}
          {hasCi && (
            <div style={{ background: V.white, borderRadius: 14, padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}` }}>
              {ci!.activeCompetitors === 0 && ci!.totalCompetitors === 0 ? (
                <>
                  <div style={{ fontFamily: V.display, fontSize: 18, fontWeight: 600, color: V.teal, lineHeight: 1.3 }}>Sem concorrência digital</div>
                  <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>identificada no seu raio</p>
                  <span style={{ display: "inline-block", marginTop: 8, fontFamily: V.mono, fontSize: 10, padding: "3px 10px", borderRadius: 100, background: "rgba(45,155,131,0.12)", color: V.teal, fontWeight: 600 }}>Oportunidade</span>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral }}>
                    {ci!.indexValue.toLocaleString("pt-BR")}
                  </div>
                  <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>buscas por concorrente ativo</p>
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
          )}
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

        {/* ═══ 5 BLOCOS COLAPSÁVEIS ═══ */}

        {/* Bloco 1 — Tamanho da audiência */}
        <Expandable title="Tamanho da audiência" icon="👥" defaultOpen={!!hasAudiencia}>
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
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                <span style={{ fontSize: 12, color: V.zinc }}>Densidade</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: V.night }}>
                  {aud.densidade === "nacional" ? (
                    <span style={{ background: V.amberWash, color: V.amber, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Nacional</span>
                  ) : aud.densidade === "alta"
                    ? isB2B ? "Alta densidade empresarial" : "Alta densidade populacional"
                    : isB2B ? "Baixa densidade empresarial" : "Baixa densidade populacional"}
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
              <p style={{ fontSize: 10, color: V.ash, margin: "10px 0 0", fontFamily: V.mono }}>Fonte: IBGE{aud.ibgeAno ? ` ${aud.ibgeAno}` : ''} · Estimativa Virô</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Dados IBGE indisponíveis para este município.</p>
          )}
        </Expandable>

        {/* Bloco 2 — Volume de buscas */}
        <Expandable
          title="Volume de buscas"
          icon="🔍"
        >
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Termos reais que pessoas buscam no Google quando precisam de {product} na sua região.
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
          {/* Concorrentes ativos no raio */}
          {ci && ci.activeCompetitors > 0 && (
            <div style={{ marginTop: 16, padding: "12px", background: V.cloud, borderRadius: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: V.night, margin: "0 0 8px" }}>
                {ci.activeCompetitors} concorrente{ci.activeCompetitors !== 1 ? 's' : ''} ativ{ci.activeCompetitors !== 1 ? 'os' : 'o'} no seu raio
              </p>
              {ci.competitors.filter(c => c.hasWebsite || c.hasInstagram).slice(0, 8).map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: V.zinc, borderBottom: i < Math.min(ci.competitors.filter(cc => cc.hasWebsite || cc.hasInstagram).length, 8) - 1 ? `1px solid ${V.fog}` : "none" }}>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ display: "flex", gap: 4, fontSize: 10 }}>
                    {c.hasWebsite && <span title="Site" style={{ background: V.tealWash, color: V.teal, padding: "1px 5px", borderRadius: 4, fontFamily: V.mono }}>Site</span>}
                    {c.hasInstagram && <span title="Instagram" style={{ background: "#E1306C18", color: "#E1306C", padding: "1px 5px", borderRadius: 4, fontFamily: V.mono }}>IG</span>}
                  </span>
                  {c.rating && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>★{c.rating}</span>}
                  {c.mapsPosition && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>#{c.mapsPosition}</span>}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 10, color: V.ash, margin: "12px 0 0", fontFamily: V.mono }}>
            Dados: DataForSEO (volume + SERP)
          </p>
        </Expandable>

        {/* Bloco 3 — Capacidade de influência */}
        <Expandable title="Capacidade de influência" icon="📊">
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

          {/* Instagram */}
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Instagram</span>
              <span style={{ fontFamily: V.mono, fontSize: 12, color: V.night }}>{breakdown?.instagram || 0}%</span>
            </div>
            {igData?.dataAvailable ? (
              <>
                <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 4px", lineHeight: 1.5 }}>
                  @{igData.handle}: {igData.followers.toLocaleString("pt-BR")} seguidores · {(igData.avgViews || igData.avgLikes || 0).toLocaleString("pt-BR")} alcance médio · {(igData.engagementRate * 100).toFixed(1)}% engajamento · {igData.postsLast30d} posts/30d
                </p>
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
                  const aiDimFactor = results.aiVisibility!.factors?.find(
                    (f: any) => f.status === 'positive' && f.factor.startsWith('Aparece em buscas de IA')
                  );
                  if (aiDimFactor) return aiDimFactor.factor + `. Score ${results.aiVisibility!.score}/100.`;
                  if (results.aiVisibility!.likelyMentioned) return `Seu negócio provavelmente é mencionado em respostas de AI. Score ${results.aiVisibility!.score}/100.`;
                  return `Não aparece em nenhuma busca de IA local. ${results.aiVisibility!.summary}`;
                })()}
              </p>
            </div>
          )}
        </Expandable>

        {/* Bloco 4 — Rotas de trabalho priorizadas */}
        {results.workRoutes && results.workRoutes.length > 0 && (
          <Expandable title="Rotas de trabalho priorizadas" icon="🎯" defaultOpen={true}>
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

        {/* Bloco 5 — Fontes de dados e metodologia */}
        <Expandable title="Fontes de dados e metodologia" icon="🔬">
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
            O score de influência digital mede quanto do mercado local você captura nos canais onde as decisões de compra acontecem — Google (busca + Maps) e Instagram. O score é normalizado contra benchmarks do segmento — não é absoluto, é relativo ao mercado local. O dimensionamento de mercado cruza volume de busca com dados populacionais para estimar a demanda total disponível. Todos os dados são coletados em tempo real no momento do diagnóstico.
          </p>
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

        {/* Prévia */}
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
