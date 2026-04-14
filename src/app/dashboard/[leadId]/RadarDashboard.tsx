"use client";

import { useState, useEffect, useCallback } from "react";
import { V } from "@/lib/design-tokens";

// ─── Types ──────────────────────────────────────────────────────────────
type Tier = "free" | "subscriber";

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
        <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 4px", lineHeight: 1.5 }}>
          {score < 20
            ? "Seu negócio é quase invisível pra quem busca o que você faz. A maioria dos clientes potenciais encontra seus concorrentes primeiro."
            : score < 40
            ? "Você aparece pra parte do mercado, mas perde a maioria das oportunidades. Há espaço concreto pra crescer."
            : score < 60
            ? "Presença razoável. Você é encontrado, mas concorrentes mais ativos capturam mais atenção."
            : "Boa presença digital. Seu desafio agora é manter e ampliar a distância pros concorrentes."}
        </p>
        <div style={{ fontSize: 12, color: V.zinc, marginTop: 4 }}>
          Média de {benchmarkLabel}: <strong style={{ color: V.night }}>{benchmark}</strong>
          {" · "}
          <strong style={{ color: V.amber }}>Meta: {Math.min(score + 25, 85)}</strong>
        </div>
        {score < benchmark && (
          <div style={{ fontSize: 11, color: V.amber, marginTop: 2 }}>
            {benchmark - score} pontos abaixo da média — espaço pra crescer
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Reviews Component ───────────────────────────────────────────
function InlineReviews({ leadId }: { leadId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reviews?leadId=${leadId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.reviews?.length > 0) setReviews(d.reviews); })
      .catch(() => {});
  }, [leadId]);

  const generateDrafts = async () => {
    setGenerating(true);
    try {
      await fetch('/api/reviews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const r = await fetch(`/api/reviews?leadId=${leadId}`);
      const d = await r.json();
      if (d?.reviews) setReviews(d.reviews);
    } catch { /* */ }
    setGenerating(false);
  };

  const copyResponse = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    fetch('/api/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'copied' }),
    }).catch(() => {});
  };

  if (reviews.length === 0 && !generating) {
    return (
      <button onClick={generateDrafts} style={{
        width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${V.fog}`,
        background: V.cloud, color: V.night, fontSize: 12, fontWeight: 600, cursor: "pointer",
        marginTop: 8,
      }}>
        Carregar reviews e gerar respostas
      </button>
    );
  }

  if (generating) {
    return <p style={{ fontSize: 11, color: V.amber, marginTop: 8 }}>Gerando respostas personalizadas (~30s)...</p>;
  }

  return (
    <div style={{ marginTop: 10 }}>
      {reviews.slice(0, 5).map(r => (
        <div key={r.id} style={{
          background: V.cloud, borderRadius: 8, padding: "10px 12px", marginBottom: 8,
          border: `1px solid ${r.status === 'copied' ? V.teal + '40' : V.fog}`,
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontFamily: V.mono, fontSize: 9, color: V.amber }}>
              {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: V.night }}>{r.author_name || 'Cliente'}</span>
            {r.status === 'copied' && <span style={{ fontSize: 9, color: V.teal, marginLeft: 'auto' }}>✓ Copiada</span>}
          </div>
          <p style={{ fontSize: 11, color: V.zinc, margin: "0 0 6px", fontStyle: "italic", lineHeight: 1.4 }}>
            &ldquo;{(r.review_text || '').slice(0, 150)}{r.review_text?.length > 150 ? '...' : ''}&rdquo;
          </p>
          {r.draft_response && (
            <div style={{ background: V.white, borderRadius: 6, padding: "8px 10px", borderLeft: `3px solid ${V.amber}` }}>
              <p style={{ fontSize: 11, color: V.night, margin: "0 0 4px", lineHeight: 1.4 }}>{r.draft_response}</p>
              <button onClick={() => copyResponse(r.id, r.draft_response)} style={{
                fontSize: 10, color: copiedId === r.id ? V.teal : V.amber,
                background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0,
              }}>
                {copiedId === r.id ? 'Copiado!' : 'Copiar resposta'}
              </button>
            </div>
          )}
        </div>
      ))}
      {reviews.length > 5 && (
        <p style={{ fontSize: 10, color: V.ash, textAlign: "center" }}>+ {reviews.length - 5} reviews</p>
      )}
    </div>
  );
}

// ─── Quick Win Card ─────────────────────────────────────────────────────
function QuickWinCard({ qw, leadId }: {
  qw: any; leadId: string;
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

          {/* Inline reviews for review quick wins */}
          {expanded && qw.type === 'responder_reviews' && (
            <InlineReviews leadId={leadId} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Locked Quick Win Card (free tier, blurred) ────────────────────────
function LockedQuickWinCard({ qw }: { qw: any }) {
  return (
    <div style={{
      background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`,
      padding: "14px 16px", marginBottom: 10, position: "relative", overflow: "hidden",
    }}>
      <div style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${V.fog}`, background: V.white, marginTop: 1,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{qw.title}</span>
              <span style={{ fontFamily: V.mono, fontSize: 9, padding: "2px 6px", borderRadius: 100, background: V.fog, color: V.ash }}>{qw.timeEstimate}</span>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px", lineHeight: 1.5 }}>{qw.description}</p>
            <span style={{ fontSize: 10, fontWeight: 600, color: V.teal, background: "rgba(45,155,131,0.08)", padding: "2px 8px", borderRadius: 4 }}>{qw.impact}</span>
          </div>
        </div>
      </div>
      {/* Lock overlay */}
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.4)", borderRadius: 12,
      }}>
        <span style={{ fontSize: 16, opacity: 0.6 }}>🔒</span>
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
    retention: "🔄",
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
          {/* Objetivo + Meta + Recursos + Riscos + Ferramentas */}
          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <div style={{
              padding: "10px 12px", background: "rgba(45,155,131,0.06)",
              borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: V.teal, textTransform: "uppercase", marginBottom: 4 }}>OBJETIVO</div>
              <span style={{ fontSize: 12, color: V.night, fontWeight: 500 }}>
                {pillar.objective || pillar.kpi?.metric || pillar.title}
              </span>
              {pillar.targetMetric && (
                <div style={{ fontSize: 11, color: V.teal, fontWeight: 600, marginTop: 4 }}>
                  Meta: {pillar.targetMetric}
                </div>
              )}
              {pillar.timeline && (
                <div style={{ fontSize: 11, color: V.ash, marginTop: 2 }}>⏱ {pillar.timeline}</div>
              )}
            </div>

            {/* Recursos + Riscos */}
            {(pillar.resources || pillar.risks) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                {pillar.resources && (
                  <div style={{ padding: "8px 10px", background: V.cloud, borderRadius: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: V.ash, textTransform: "uppercase", marginBottom: 2 }}>RECURSOS</div>
                    <div style={{ fontSize: 11, color: V.zinc, lineHeight: 1.4 }}>{pillar.resources}</div>
                  </div>
                )}
                {pillar.risks && (
                  <div style={{ padding: "8px 10px", background: "rgba(217,83,79,0.04)", borderRadius: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: V.coral, textTransform: "uppercase", marginBottom: 2 }}>RISCOS</div>
                    <div style={{ fontSize: 11, color: V.zinc, lineHeight: 1.4 }}>{pillar.risks}</div>
                  </div>
                )}
              </div>
            )}

            {/* Ferramentas */}
            {pillar.tools?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 8 }}>
                {pillar.tools.map((tool: string, ti: number) => (
                  <span key={ti} style={{ fontSize: 9, fontWeight: 500, color: V.night, background: V.fog, padding: "2px 6px", borderRadius: 4 }}>
                    🔧 {tool}
                  </span>
                ))}
              </div>
            )}

            {/* Etapas resumidas */}
            <div style={{
              padding: "10px 12px", background: V.cloud, borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: V.ash, textTransform: "uppercase", marginBottom: 6 }}>ETAPAS</div>
              {pillar.items?.map((item: any, idx: number) => (
                <div key={item.id} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "flex-start" }}>
                  <span style={{
                    fontFamily: V.mono, fontSize: 9, color: V.ash, background: V.fog,
                    borderRadius: 3, padding: "1px 5px", flexShrink: 0, marginTop: 1,
                  }}>{idx + 1}</span>
                  <span style={{ fontSize: 12, color: V.night, fontWeight: 500 }}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conteúdo pronto de cada item */}
          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
            CONTEÚDO PRONTO
          </div>
          {pillar.items?.map((item: any) => (
            <div key={item.id} style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 11, color: V.night, fontWeight: 600, marginBottom: 4,
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
function ProvocationCard({ prov, onAction }: { prov: any; onAction?: () => void }) {
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
            <button onClick={() => {
              if (onAction) onAction();
              // Scroll pro plano de crescimento
              document.getElementById('growth-plan')?.scrollIntoView({ behavior: 'smooth' });
            }} style={{
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
            const res = await fetch("/api/checkout/subscription", {
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

// ─── Weekly Contents Section (subscriber) ───────────────────────────
function WeeklyContentsSection({ leadId }: { leadId: string }) {
  const [contents, setContents] = useState<any[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [byWeek, setByWeek] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/contents?leadId=${leadId}&all=true`);
        if (res.ok) {
          const data = await res.json();
          setContents(data.contents || []);
          setWeeks(data.weeks || []);
          setByWeek(data.byWeek || {});
          if (data.weeks?.length > 0) setExpandedWeek(data.weeks[0]);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [leadId]);

  if (loading) return null;
  if (weeks.length === 0) return (
    <div style={{ marginBottom: 24, textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
        📅 CONTEÚDO SEMANAL
      </div>
      <p style={{ fontSize: 12, color: V.ash }}>Próxima geração na sexta-feira. Seus conteúdos aparecerão aqui.</p>
    </div>
  );

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: V.mono, fontSize: 10, color: V.night, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        📅 CONTEÚDO SEMANAL · {weeks.length} semana{weeks.length > 1 ? 's' : ''}
      </div>

      {weeks.map(wk => {
        const wkContents = byWeek[wk] || [];
        const isExpanded = expandedWeek === wk;
        const isLatest = wk === weeks[0];
        const firstContent = wkContents[0];
        const genDate = firstContent?.generation_date || firstContent?.created_at;
        const dateLabel = genDate ? new Date(genDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';

        return (
          <div key={wk} style={{ marginBottom: 8 }}>
            <button onClick={() => setExpandedWeek(isExpanded ? null : wk)} style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", borderRadius: 10, border: `1px solid ${isLatest ? V.amber + '40' : V.fog}`,
              background: isLatest ? V.amberWash : V.white, cursor: "pointer", textAlign: "left",
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>
                  Semana {wk}{dateLabel ? ` · ${dateLabel}` : ''}
                </span>
                {isLatest && <span style={{ fontSize: 9, color: V.amber, fontWeight: 600, marginLeft: 8 }}>ATUAL</span>}
                <span style={{ fontSize: 10, color: V.ash, marginLeft: 8 }}>{wkContents.length} conteúdo{wkContents.length !== 1 ? 's' : ''}</span>
              </div>
              <span style={{ fontSize: 14, color: V.ash, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▾</span>
            </button>

            {isExpanded && (
              <div style={{ padding: "12px 16px", background: V.white, borderRadius: "0 0 10px 10px", border: `1px solid ${V.fog}`, borderTopColor: "transparent", marginTop: -1 }}>
                {wkContents.map((c: any) => (
                  <div key={c.id} style={{ marginBottom: 10, padding: "10px 12px", background: V.cloud, borderRadius: 8, borderLeft: `3px solid ${V.amber}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: V.amber, textTransform: "uppercase" }}>{c.channel_key || c.channel}</span>
                      {c.best_time && <span style={{ fontSize: 9, color: V.ash, fontFamily: V.mono }}>{c.best_time}</span>}
                    </div>
                    {c.hook && <p style={{ fontSize: 13, fontWeight: 600, color: V.night, margin: "0 0 4px", lineHeight: 1.4 }}>{c.hook}</p>}
                    <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {(c.content || '').slice(0, 200)}{(c.content || '').length > 200 ? '...' : ''}
                    </p>
                    {c.content && (
                      <button onClick={() => { navigator.clipboard.writeText(c.content); }} style={{
                        marginTop: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600,
                        color: V.amber, background: V.amberWash, border: "none", borderRadius: 4, cursor: "pointer",
                      }}>
                        Copiar texto
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN RADAR DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
export default function RadarDashboard({ lead, diagnosis, tier: initialTier, initialGrowthMachine }: Props) {
  const [gm, setGm] = useState<any>(initialGrowthMachine || null);
  const [generating, setGenerating] = useState(false);
  const [tier, setTier] = useState(initialTier);

  // Pós-pagamento: se ?subscribed=true e tier=free, poll até webhook setar subscription_status=active
  useEffect(() => {
    if (tier !== 'free') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('subscribed')) return;

    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/diagnose?leadId=${lead.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.subscription_status === 'active' || data.status === 'done') {
            setTier('subscriber');
            clearInterval(poll);
            // Remove ?subscribed da URL
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
      } catch { /* ignore */ }
      if (attempts >= 20) { // 60s max
        clearInterval(poll);
        // Força reload — webhook pode ter completado
        window.location.reload();
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [lead.id, tier]);

  // Fetch or generate growth machine (free também recebe pra exibir quick wins)
  useEffect(() => {
    if (gm) return;

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
        {gm?.quickWins?.length > 0 && (() => {
          const FREE_VISIBLE = 3;
          const allQw = gm.quickWins || [];
          const visibleQw = tier === "free" ? allQw.slice(0, FREE_VISIBLE) : allQw;
          const lockedQw = tier === "free" ? allQw.slice(FREE_VISIBLE) : [];

          return (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: V.mono, fontSize: 10, color: V.teal,
                letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
              }}>
                ⚡ AÇÕES RÁPIDAS — COMECE AGORA
                {tier === "free" && allQw.length > FREE_VISIBLE && (
                  <span style={{ color: V.ash, marginLeft: 8 }}>
                    {FREE_VISIBLE} de {allQw.length}
                  </span>
                )}
              </div>

              {visibleQw.map((qw: any) => (
                <QuickWinCard key={qw.id} qw={qw} leadId={lead.id} />
              ))}

              {lockedQw.length > 0 && (
                <>
                  {lockedQw.slice(0, 3).map((qw: any) => (
                    <LockedQuickWinCard key={qw.id} qw={qw} />
                  ))}

                  {lockedQw.length > 3 && (
                    <p style={{ fontSize: 11, color: V.ash, textAlign: "center", margin: "4px 0 12px" }}>
                      + {lockedQw.length - 3} ação(ões) disponível(is)
                    </p>
                  )}

                  <div style={{
                    background: "linear-gradient(135deg, #161618 0%, #2A2A30 100%)",
                    borderRadius: 12, padding: "18px 20px", textAlign: "center",
                  }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: V.white, margin: "0 0 4px" }}>
                      Desbloqueie {lockedQw.length} ação(ões) personalizada(s)
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "0 0 12px" }}>
                      Com passos detalhados, textos prontos e monitoramento semanal.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/checkout/subscription", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ leadId: lead.id }),
                          });
                          const data = await res.json();
                          if (data.url) window.location.href = data.url;
                        } catch { /* ignore */ }
                      }}
                      style={{
                        padding: "10px 24px", borderRadius: 8, border: "none",
                        background: V.teal, color: V.white, fontSize: 13, fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Ativar Radar · R$247/mês
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ─── PILARES ESTRATÉGICOS ─── */}
        {gm?.strategicPillars?.length > 0 && tier !== "free" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: V.mono, fontSize: 10, color: V.night,
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10,
            }}>
              <span id="growth-plan">🏗️</span> SEU PLANO DE CRESCIMENTO
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
        {gm?.kpis && tier !== "free" && (
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

        {/* ─── CONTEÚDO SEMANAL (subscriber only) ─── */}
        {tier === "subscriber" && <WeeklyContentsSection leadId={lead.id} />}

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
