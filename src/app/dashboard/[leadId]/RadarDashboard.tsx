"use client";

import { useState, useEffect, useCallback } from "react";
import { V } from "@/lib/design-tokens";

// ─── Types ──────────────────────────────────────────────────────────────
type Tier = "free" | "paid" | "subscriber";

interface Props {
  lead: any;
  diagnosis: any;
  tier: Tier;
  initialGrowthMachine?: any;
}

// ─── Copy Block ──────────────────────────────────────────────────────────
function CopyBlock({ label, text, style }: { label: string; text: string; style?: any }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{
      background: V.cloud, borderRadius: 8, padding: "10px 12px",
      borderLeft: `3px solid ${V.amber}`, marginBottom: 8, ...style,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: V.amber, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{
            padding: "2px 8px", borderRadius: 4, border: `1px solid ${V.fog}`,
            background: copied ? V.teal : V.white, color: copied ? V.white : V.zinc,
            fontSize: 10, cursor: "pointer", fontWeight: 600,
          }}>
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

// ─── Score Ring ──────────────────────────────────────────────────────────
function ScoreRing({ score, benchmark, benchmarkLabel }: {
  score: number; benchmark: number; benchmarkLabel: string;
}) {
  const pct = Math.min(score, 100);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (pct / 100) * circumference;
  const color = score >= 50 ? V.teal : score >= 25 ? V.amber : "#D95A4F";

  return (
    <div style={{ textAlign: "center", marginBottom: 24 }}>
      <div style={{ position: "relative", display: "inline-block", width: 130, height: 130 }}>
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="52" fill="none" stroke={V.fog} strokeWidth="8" />
          <circle cx="65" cy="65" r="52" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 65 65)"
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: V.night, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 10, color: V.ash, fontFamily: V.mono }}>/100</div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: V.zinc }}>
          Média de {benchmarkLabel}: <strong style={{ color: V.night }}>{benchmark}</strong>
        </div>
        {score < benchmark ? (
          <div style={{ fontSize: 11, color: V.amber, marginTop: 2 }}>
            {benchmark - score} pontos abaixo da média — espaço pra crescer
          </div>
        ) : (
          <div style={{ fontSize: 11, color: V.teal, marginTop: 2 }}>
            {score - benchmark} pontos acima da média — bom trabalho
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Win Card ─────────────────────────────────────────────────────
function QuickWinCard({ qw, onGenerateContent }: {
  qw: any; onGenerateContent?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div style={{
      background: done ? "rgba(45,155,131,0.04)" : V.white,
      borderRadius: 12, border: `1px solid ${done ? V.teal + '40' : V.fog}`,
      padding: "14px 16px", marginBottom: 10,
      opacity: done ? 0.7 : 1,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <button onClick={() => setDone(!done)} style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: `2px solid ${done ? V.teal : V.fog}`,
          background: done ? V.teal : V.white, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
        }}>
          {done && <span style={{ color: V.white, fontSize: 12, fontWeight: 700 }}>✓</span>}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: V.night,
              textDecoration: done ? "line-through" : "none" }}>
              {qw.title}
            </span>
            <span style={{
              fontFamily: V.mono, fontSize: 9, padding: "2px 6px",
              borderRadius: 100, background: V.fog, color: V.ash,
            }}>{qw.timeEstimate}</span>
          </div>
          <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px", lineHeight: 1.5 }}>
            {qw.description}
          </p>

          {/* Impact badge */}
          <span style={{
            fontSize: 10, fontWeight: 600, color: V.teal,
            background: "rgba(45,155,131,0.08)", padding: "2px 8px",
            borderRadius: 4,
          }}>{qw.impact}</span>

          {/* Expand steps */}
          {!done && (
            <button onClick={() => setExpanded(!expanded)} style={{
              fontSize: 11, color: V.amber, background: "none",
              border: "none", cursor: "pointer", fontWeight: 600,
              marginLeft: 8, padding: 0,
            }}>
              {expanded ? "Ocultar passos ▴" : "Ver como fazer ▾"}
            </button>
          )}

          {expanded && qw.steps && (
            <div style={{ marginTop: 10, paddingLeft: 0 }}>
              {qw.steps.map((step: string, i: number) => (
                <div key={i} style={{
                  display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start",
                }}>
                  <span style={{
                    fontFamily: V.mono, fontSize: 10, color: V.ash,
                    background: V.fog, borderRadius: 4, padding: "1px 6px",
                    flexShrink: 0, marginTop: 2,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Copy ready */}
          {expanded && qw.copyReady && (
            <CopyBlock label="Texto pronto" text={qw.copyReady} style={{ marginTop: 8 }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Strategic Pillar Card ──────────────────────────────────────────────
function PillarCard({ pillar }: { pillar: any }) {
  const [expanded, setExpanded] = useState(false);
  const typeIcons: Record<string, string> = {
    content_engine: "📱",
    authority: "📄",
    prospecting: "🎯",
    reputation: "⭐",
    expansion: "🗺️",
  };

  return (
    <div style={{
      background: V.white, borderRadius: 12,
      border: `1px solid ${V.fog}`, overflow: "hidden", marginBottom: 12,
    }}>
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} style={{
        width: "100%", display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "16px 18px", background: V.white,
        border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>{typeIcons[pillar.type] || "📋"}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: V.night }}>{pillar.title}</div>
            <div style={{ fontSize: 12, color: V.zinc, marginTop: 2 }}>{pillar.description}</div>
          </div>
        </div>
        <span style={{
          fontSize: 14, color: V.ash, transform: expanded ? "rotate(180deg)" : "rotate(0)",
          transition: "transform 0.2s",
        }}>▾</span>
      </button>

      {/* Content */}
      {expanded && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${V.fog}` }}>
          {/* KPI */}
          <div style={{
            display: "flex", gap: 8, marginTop: 14, marginBottom: 14,
            padding: "8px 12px", background: "rgba(45,155,131,0.06)",
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: V.teal, textTransform: "uppercase" }}>Meta:</span>
            <span style={{ fontSize: 11, color: V.night }}>
              {pillar.kpi?.target} em {pillar.kpi?.timeframe}
            </span>
          </div>

          {/* Items */}
          {pillar.items?.map((item: any) => (
            <div key={item.id} style={{ marginBottom: 12 }}>
              <div style={{
                fontFamily: V.mono, fontSize: 10, color: V.ash,
                letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4,
              }}>
                {item.title}
              </div>
              {item.copyable ? (
                <CopyBlock label={item.type === 'copy' ? 'Pronto' : item.type} text={item.content} />
              ) : (
                <p style={{
                  fontSize: 12, color: V.zinc, margin: 0,
                  lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>
                  {item.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Provocation Card ───────────────────────────────────────────────────
function ProvocationCard({ prov }: { prov: any }) {
  return (
    <div style={{
      background: V.amberWash, border: `1px solid ${V.amber}30`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>📡</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: V.night, margin: "0 0 6px", lineHeight: 1.5, fontWeight: 500 }}>
            {prov.insight}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: V.ash, fontFamily: V.mono }}>{prov.dataSource}</span>
            <button style={{
              fontSize: 11, color: V.amber, background: "none",
              border: `1px solid ${V.amber}`, borderRadius: 6,
              padding: "4px 10px", cursor: "pointer", fontWeight: 600,
            }}>
              {prov.actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Free CTA ───────────────────────────────────────────────────────────
function FreeCTA({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{
      background: "linear-gradient(135deg, #161618 0%, #2A2A30 100%)",
      borderRadius: 16, padding: "28px 24px", textAlign: "center",
      marginBottom: 20,
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: V.white, margin: "0 0 8px" }}>
        Ative seu Radar de Crescimento
      </h3>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 18px", lineHeight: 1.5 }}>
        Monitoramento semanal do seu mercado, ações prontas pra executar e conteúdo pronto pra crescer.
      </p>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            const res = await fetch("/api/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ leadId }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
          } catch { /* ignore */ }
          setLoading(false);
        }}
        disabled={loading}
        style={{
          padding: "12px 32px", borderRadius: 10, border: "none",
          background: V.teal, color: V.white, fontSize: 15, fontWeight: 700,
          cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Redirecionando..." : "Ativar Radar · R$247/mês"}
      </button>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 10 }}>
        Cancele quando quiser · Sem fidelidade
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN RADAR DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
export default function RadarDashboard({ lead, diagnosis, tier, initialGrowthMachine }: Props) {
  const [gm, setGm] = useState<any>(initialGrowthMachine || null);
  const [generating, setGenerating] = useState(false);

  // Fetch or generate growth machine
  useEffect(() => {
    if (gm) return;
    if (tier === "free") return; // Free users don't get growth machine

    const fetchGM = async () => {
      try {
        const res = await fetch(`/api/growth-machine?leadId=${lead.id}`);
        const data = await res.json();
        if (data.status === "ready") {
          setGm(data.data);
          return;
        }
        // Generate if not exists
        setGenerating(true);
        const genRes = await fetch("/api/growth-machine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id }),
        });
        const genData = await genRes.json();
        if (genData.status === "ready") setGm(genData.data);
      } catch {
        /* silent */
      } finally {
        setGenerating(false);
      }
    };
    fetchGM();
  }, [lead.id, tier, gm]);

  const display = lead.diagnosis_display || {};
  const score = gm?.score || {
    current: display.influencePercent || 0,
    benchmark: 35,
    benchmarkLabel: `negócios de ${lead.product} em ${(lead.region || '').split(',')[0]}`,
    gap: 35 - (display.influencePercent || 0),
  };

  const shortRegion = (lead.region || '').split(',')[0].trim();

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{
            fontFamily: V.display, fontSize: 18, fontWeight: 800,
            color: V.night, letterSpacing: "-0.02em",
          }}>
            Virô<span style={{ color: V.teal }}>.</span>
          </div>
          <div style={{ fontSize: 10, color: V.ash, fontFamily: V.mono, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
            RADAR DE CRESCIMENTO
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: V.night, margin: "0 0 4px" }}>
            {lead.name || lead.product}
          </h1>
          <p style={{ fontSize: 13, color: V.zinc, margin: 0 }}>
            {shortRegion}{gm?.blueprintLabel ? ` · ${gm.blueprintLabel}` : ''}
          </p>
        </div>

        {/* Score Ring */}
        <ScoreRing
          score={score.current}
          benchmark={score.benchmark}
          benchmarkLabel={score.benchmarkLabel}
        />

        {/* Free CTA */}
        {tier === "free" && <FreeCTA leadId={lead.id} />}

        {/* Generating state */}
        {generating && (
          <div style={{
            textAlign: "center", padding: "32px 0",
            color: V.amber, fontSize: 13, fontWeight: 500,
          }}>
            <div style={{
              width: 28, height: 28, border: `3px solid ${V.fog}`,
              borderTopColor: V.amber, borderRadius: "50%",
              margin: "0 auto 12px",
              animation: "spin 0.7s linear infinite",
            }} />
            Montando seu plano de crescimento...
          </div>
        )}

        {/* ─── PROVOCAÇÕES (topo, pra chamar atenção) ─── */}
        {gm?.provocations?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: V.mono, fontSize: 10, color: V.amber,
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
            }}>
              📡 SEU RADAR DETECTOU
            </div>
            {gm.provocations.map((p: any) => (
              <ProvocationCard key={p.id} prov={p} />
            ))}
          </div>
        )}

        {/* ─── QUICK WINS ─── */}
        {(gm?.quickWins?.length > 0 || tier === "free") && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: V.mono, fontSize: 10, color: V.teal,
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
            }}>
              ⚡ AÇÕES RÁPIDAS — COMECE AGORA
            </div>
            {(gm?.quickWins || []).map((qw: any) => (
              <QuickWinCard key={qw.id} qw={qw} />
            ))}
            {!gm?.quickWins?.length && tier === "free" && (
              <p style={{ fontSize: 12, color: V.ash, textAlign: "center" }}>
                Ative o Radar pra ver ações personalizadas pro seu negócio.
              </p>
            )}
          </div>
        )}

        {/* ─── PILARES ESTRATÉGICOS ─── */}
        {gm?.strategicPillars?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: V.mono, fontSize: 10, color: V.night,
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
            }}>
              🏗️ SEU PLANO DE CRESCIMENTO
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 12px", lineHeight: 1.5 }}>
              Montado a partir dos dados do seu mercado.
              Cada item tem conteúdo pronto — copie e use.
            </p>
            {gm.strategicPillars
              .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
              .map((pillar: any) => (
                <PillarCard key={pillar.id} pillar={pillar} />
              ))}
          </div>
        )}

        {/* ─── KPIs ─── */}
        {gm?.kpis && (
          <div style={{
            background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`,
            padding: "18px 20px", marginBottom: 24,
          }}>
            <div style={{
              fontFamily: V.mono, fontSize: 10, color: V.ash,
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12,
            }}>
              📈 METAS
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <span style={{ fontSize: 10, color: V.ash, fontFamily: V.mono }}>30 DIAS</span>
                <p style={{ fontSize: 13, color: V.night, margin: "2px 0 0", fontWeight: 500 }}>
                  {gm.kpis.thirtyDay}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 10, color: V.ash, fontFamily: V.mono }}>90 DIAS</span>
                <p style={{ fontSize: 13, color: V.night, margin: "2px 0 0", fontWeight: 500 }}>
                  {gm.kpis.ninetyDay}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 28, marginTop: 20, borderTop: `1px solid ${V.fog}` }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night }}>
            Virô<span style={{ color: V.teal }}>.</span>
          </span>
          <p style={{ fontSize: 11, color: V.ash, fontFamily: V.mono, marginTop: 4 }}>
            Seu radar de crescimento · virolocal.com
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
