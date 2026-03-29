// ============================================================================
// Virô — Dashboard Client Component
// Renders 5-block diagnosis + weekly tab + feedback
// ============================================================================
// File: src/app/dashboard/[leadId]/DashboardClient.tsx

"use client";

import { useState } from "react";
import FeedbackWidget from "@/components/FeedbackWidget";
import { NelsonLogo } from "@/components/NelsonLogo";

// ─── DESIGN TOKENS ───
const C = {
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
};

const font = {
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

// ─── TYPES ───
interface DashboardProps {
  lead: any;
  plan: any;
  diagnosis: any;
  briefings: any[];
}

type Tab = "diagnosis" | "weekly";

// ─── MAIN COMPONENT ───
export default function DashboardClient({ lead, plan, diagnosis, briefings }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("diagnosis");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const blocks = plan?.blocks || plan?.content?.blocks || [];
  const isGenerating = lead.plan_status === "generating";
  const isError = lead.plan_status === "error";
  const isReady = plan && plan.status === "ready";

  return (
    <div style={{ minHeight: "100vh", background: C.cloud }}>
      {/* ─── NAV ─── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(254,254,255,0.92)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.fog}`, padding: "0 24px",
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto",
          display: "flex", alignItems: "center", gap: 16, padding: "12px 0",
        }}>
          <span style={{
            fontFamily: font.display, fontWeight: 700, fontSize: 18,
            color: C.night, letterSpacing: "-0.03em",
          }}>Virô</span>
          <span style={{ fontFamily: font.body, fontSize: 13, color: C.ash }}>·</span>
          <span style={{ fontFamily: font.body, fontSize: 13, color: C.zinc }}>
            {lead.product} · {lead.region}
          </span>
          <div style={{ flex: 1 }} />
          {/* Tabs */}
          {["diagnosis", "weekly"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as Tab)}
              style={{
                fontFamily: font.body, fontSize: 13, fontWeight: 500,
                color: activeTab === tab ? C.amber : C.zinc,
                background: activeTab === tab ? C.amberWash : "transparent",
                border: "none", borderRadius: 8, padding: "6px 14px",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {tab === "diagnosis" ? "Diagnóstico" : `Semanas (${briefings.length}/12)`}
            </button>
          ))}
        </div>
      </nav>

      {/* ─── CONTENT ─── */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* GENERATING STATE */}
        {isGenerating && (
          <div style={{
            textAlign: "center", padding: "80px 20px",
            background: C.white, borderRadius: 16, border: `1px solid ${C.fog}`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: C.night, display: "inline-flex",
              alignItems: "center", justifyContent: "center", marginBottom: 20,
            }}>
              <NelsonLogo size={24} variant="light" />
            </div>
            <div style={{
              fontFamily: font.display, fontSize: 20, fontWeight: 600,
              color: C.night, marginBottom: 8,
            }}>
              Estou mapeando seu mercado agora.
            </div>
            <div style={{
              fontFamily: font.body, fontSize: 14, color: C.zinc, marginBottom: 24, maxWidth: 400, margin: "0 auto",
            }}>
              Cruzo Google, Maps, Instagram e IA para montar sua leitura em tempo real.
            </div>
            <div style={{
              width: 200, height: 3, background: C.fog, borderRadius: 2, margin: "24px auto",
              overflow: "hidden",
            }}>
              <div style={{
                width: "40%", height: "100%", background: C.amber, borderRadius: 2,
                animation: "pulse 2s ease-in-out infinite",
              }} />
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 11, color: C.ash }}>
              Pode sair e voltar quando quiser — estarei aqui com tudo pronto.
            </div>
            <div style={{ fontSize: 11, color: C.ash, marginTop: 16, fontStyle: "italic" }}>
              — Nelson, da Virô
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {isError && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: C.coralWash, borderRadius: 16, border: "1px solid rgba(217,83,79,0.12)",
          }}>
            <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: C.coral, marginBottom: 8 }}>
              Houve um erro ao gerar seu diagnóstico
            </div>
            <div style={{ fontFamily: font.body, fontSize: 14, color: C.zinc }}>
              Algo travou aqui. Estou resolvendo — te aviso por email quando terminar.
            </div>
          </div>
        )}

        {/* DIAGNOSIS TAB */}
        {activeTab === "diagnosis" && isReady && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {blocks.map((block: any, index: number) => (
              <BlockCard
                key={block.id || index}
                block={block}
                index={index}
                expanded={expandedBlock === block.id}
                onToggle={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)}
              />
            ))}

            {/* Feedback after diagnosis */}
            <div style={{ marginTop: 20 }}>
              <FeedbackWidget leadId={lead.id} triggerPoint="post_diagnosis" />
            </div>
          </div>
        )}

        {/* WEEKLY TAB */}
        {activeTab === "weekly" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {briefings.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                background: C.white, borderRadius: 16, border: `1px solid ${C.fog}`,
              }}>
                <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 600, color: C.night, marginBottom: 8 }}>
                  Seu primeiro briefing chega na segunda-feira
                </div>
                <div style={{ fontFamily: font.body, fontSize: 14, color: C.zinc, maxWidth: 400, margin: "0 auto" }}>
                  Toda semana você recebe o que mudou no seu mercado e o que fazer. São 12 semanas de acompanhamento.
                </div>
              </div>
            ) : (
              briefings.map((briefing: any) => (
                <BriefingCard key={briefing.id} briefing={briefing} leadId={lead.id} />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── BLOCK CARD ──────────────────────────────────────────────────────

function BlockCard({ block, index, expanded, onToggle }: {
  block: any; index: number; expanded: boolean; onToggle: () => void;
}) {
  const content = block.content || {};
  const blockColors = [C.amber, C.teal, C.coral, C.amber, C.teal];
  const accentColor = blockColors[index % blockColors.length];

  return (
    <div style={{
      background: C.white, borderRadius: 16, overflow: "hidden",
      border: `1px solid ${C.fog}`, boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
    }}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "24px 28px", border: "none", background: "transparent",
          cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "flex-start", gap: 16,
        }}
      >
        <div style={{
          fontFamily: font.mono, fontSize: 11, fontWeight: 500,
          color: accentColor, letterSpacing: "0.04em",
          marginTop: 2, flexShrink: 0, minWidth: 20,
        }}>
          {String(index + 1).padStart(2, "0")}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: font.display, fontSize: 18, fontWeight: 600,
            color: C.night, letterSpacing: "-0.02em", marginBottom: 4,
          }}>
            {block.title}
          </div>
          {block.subtitle && (
            <div style={{ fontFamily: font.body, fontSize: 13, color: C.ash }}>
              {block.subtitle}
            </div>
          )}
          {content.headline && (
            <div style={{
              fontFamily: font.body, fontSize: 15, color: C.slate,
              marginTop: 10, lineHeight: 1.6, fontWeight: 500,
            }}>
              {content.headline}
            </div>
          )}
        </div>
        <span style={{
          fontFamily: font.body, fontSize: 20, color: C.ash,
          transition: "transform 0.2s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        }}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          padding: "0 28px 28px",
          borderTop: `1px solid ${C.fog}`,
        }}>
          {/* Narrative */}
          {content.narrative && (
            <div style={{
              fontFamily: font.body, fontSize: 15, color: C.zinc,
              lineHeight: 1.75, marginTop: 20, whiteSpace: "pre-line",
            }}>
              {content.narrative}
            </div>
          )}

          {/* Key Metrics (O Número) */}
          {content.keyMetrics && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 20 }}>
              {content.keyMetrics.map((m: any, i: number) => (
                <div key={i} style={{
                  flex: "1 1 140px", padding: "16px 18px", borderRadius: 12,
                  background: C.cloud, border: `1px solid ${C.fog}`,
                }}>
                  <div style={{ fontFamily: font.mono, fontSize: 10, color: C.ash, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: C.night, letterSpacing: "-0.02em" }}>
                    {m.value}
                  </div>
                  {m.source && (
                    <div style={{ fontFamily: font.mono, fontSize: 9, color: C.ash, marginTop: 4 }}>
                      Fonte: {m.source} · {m.confidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Gaps (O Espelho) */}
          {content.gaps && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
              {content.gaps.map((g: any, i: number) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "14px 18px", borderRadius: 12,
                  background: C.amberWash, borderLeft: `3px solid ${C.amber}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: font.mono, fontSize: 10, color: C.amber, textTransform: "uppercase", marginBottom: 4 }}>
                      Você diz
                    </div>
                    <div style={{ fontFamily: font.body, fontSize: 14, color: C.slate }}>
                      {g.what_you_say}
                    </div>
                  </div>
                  <div style={{ width: 1, background: C.fog }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: font.mono, fontSize: 10, color: C.teal, textTransform: "uppercase", marginBottom: 4 }}>
                      Cliente vê
                    </div>
                    <div style={{ fontFamily: font.body, fontSize: 14, color: C.slate }}>
                      {g.what_they_see}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Competitors (Mapa Competitivo) */}
          {content.competitors && (
            <div style={{ marginTop: 20 }}>
              {content.competitors.map((comp: any, i: number) => (
                <div key={i} style={{
                  display: "flex", gap: 16, padding: "14px 0",
                  borderBottom: i < content.competitors.length - 1 ? `1px solid ${C.fog}` : "none",
                  alignItems: "flex-start",
                }}>
                  <div style={{
                    fontFamily: font.display, fontSize: 14, fontWeight: 600,
                    color: C.night, minWidth: 120,
                  }}>
                    {comp.name}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: font.body, fontSize: 13, color: C.teal, marginBottom: 2 }}>
                      Forte: {comp.strength}
                    </div>
                    <div style={{ fontFamily: font.body, fontSize: 13, color: C.coral }}>
                      Fraco: {comp.weakness}
                    </div>
                  </div>
                  {comp.influence_score !== undefined && (
                    <div style={{
                      fontFamily: font.mono, fontSize: 12, fontWeight: 500,
                      color: C.amber, background: C.amberWash, borderRadius: 6,
                      padding: "4px 10px", flexShrink: 0,
                    }}>
                      {comp.influence_score}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions (Ajustes Imediatos) */}
          {content.actions && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
              {content.actions.map((a: any, i: number) => (
                <div key={i} style={{
                  padding: "16px 18px", borderRadius: 12,
                  background: C.cloud, border: `1px solid ${C.fog}`,
                }}>
                  <div style={{
                    fontFamily: font.display, fontSize: 15, fontWeight: 600, color: C.night, marginBottom: 6,
                  }}>
                    {a.action}
                  </div>
                  <div style={{ fontFamily: font.body, fontSize: 13, color: C.zinc, lineHeight: 1.6, marginBottom: 6 }}>
                    <strong style={{ color: C.slate }}>Por quê:</strong> {a.why}
                  </div>
                  <div style={{ fontFamily: font.body, fontSize: 13, color: C.zinc, lineHeight: 1.6 }}>
                    <strong style={{ color: C.slate }}>Como:</strong> {a.how}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <span style={{
                      fontFamily: font.mono, fontSize: 10, color: a.impact === "alto" ? C.amber : C.zinc,
                      background: a.impact === "alto" ? C.amberWash : C.cloud,
                      padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
                    }}>
                      impacto {a.impact}
                    </span>
                    <span style={{
                      fontFamily: font.mono, fontSize: 10, color: C.zinc,
                      background: C.cloud, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
                    }}>
                      esforço {a.effort}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weeks (Plano 12 Semanas) */}
          {content.weeks && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 20 }}>
              {content.weeks.map((w: any) => (
                <WeekRow key={w.week} week={w} />
              ))}
            </div>
          )}

          {/* Assumptions */}
          {content.assumptions && (
            <div style={{
              marginTop: 20, padding: "14px 18px", borderRadius: 10,
              background: C.cloud, border: `1px solid ${C.fog}`,
            }}>
              <div style={{ fontFamily: font.mono, fontSize: 10, color: C.ash, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Premissas
              </div>
              {content.assumptions.map((a: string, i: number) => (
                <div key={i} style={{
                  fontFamily: font.body, fontSize: 12, color: C.zinc, lineHeight: 1.6,
                  padding: "4px 0", borderBottom: i < content.assumptions.length - 1 ? `1px solid ${C.fog}` : "none",
                }}>
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WEEK ROW ────────────────────────────────────────────────────────

function WeekRow({ week }: { week: any }) {
  const [checked, setChecked] = useState(false);

  return (
    <div style={{
      display: "flex", gap: 14, padding: "14px 0",
      borderBottom: `1px solid ${C.fog}`, alignItems: "flex-start",
      opacity: checked ? 0.6 : 1, transition: "opacity 0.2s",
    }}>
      <button
        onClick={() => setChecked(!checked)}
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
          border: `2px solid ${checked ? C.teal : C.mist}`,
          background: checked ? C.tealWash : "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        {checked && <span style={{ fontSize: 12, color: C.teal }}>✓</span>}
      </button>
      <div style={{
        fontFamily: font.mono, fontSize: 11, fontWeight: 500, color: C.amber,
        minWidth: 54, marginTop: 3,
      }}>
        SEM {week.week}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: font.display, fontSize: 14, fontWeight: 600, color: C.night, marginBottom: 2,
          textDecoration: checked ? "line-through" : "none",
        }}>
          {week.theme || week.action}
        </div>
        {week.why && (
          <div style={{ fontFamily: font.body, fontSize: 12, color: C.zinc, lineHeight: 1.5 }}>
            {week.why}
          </div>
        )}
        {week.how && (
          <div style={{ fontFamily: font.body, fontSize: 12, color: C.ash, lineHeight: 1.5, marginTop: 4 }}>
            Como: {week.how}
          </div>
        )}
        {week.metric && (
          <div style={{
            fontFamily: font.mono, fontSize: 10, color: C.teal, marginTop: 6,
            background: C.tealWash, padding: "3px 8px", borderRadius: 4, display: "inline-block",
          }}>
            Métrica: {week.metric}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BRIEFING CARD ───────────────────────────────────────────────────

function BriefingCard({ briefing, leadId }: { briefing: any; leadId: string }) {
  const [expanded, setExpanded] = useState(false);
  const content = briefing.content || {};
  const feedbackWeeks: Record<number, string> = {
    2: "week_2", 4: "week_4", 6: "week_6", 10: "week_10", 12: "week_12",
  };
  const feedbackTrigger = feedbackWeeks[briefing.week_number];

  return (
    <div style={{
      background: C.white, borderRadius: 14, overflow: "hidden",
      border: `1px solid ${C.fog}`, boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", padding: "18px 22px", border: "none", background: "transparent",
          cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 14,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: C.night, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: C.white, fontFamily: font.mono, fontSize: 12, fontWeight: 600 }}>
            {briefing.week_number}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: font.display, fontSize: 15, fontWeight: 600, color: C.night }}>
            Semana {briefing.week_number}
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 11, color: C.ash }}>
            {new Date(briefing.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>
        {briefing.dashboard_read_at && (
          <span style={{ fontFamily: font.mono, fontSize: 10, color: C.teal }}>lido</span>
        )}
        <span style={{
          fontSize: 18, color: C.ash, transition: "transform 0.2s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 22px 22px", borderTop: `1px solid ${C.fog}` }}>
          {/* Changes */}
          {content.changes && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: font.display, fontSize: 15, fontWeight: 600, color: C.night, marginBottom: 12 }}>
                O que mudou
              </div>
              {content.changes.map((change: any, i: number) => (
                <div key={i} style={{
                  display: "flex", gap: 10, padding: "10px 0",
                  borderBottom: i < content.changes.length - 1 ? `1px solid ${C.fog}` : "none",
                }}>
                  <span style={{ fontFamily: font.mono, fontSize: 12, color: change.direction === "up" ? C.teal : change.direction === "down" ? C.coral : C.amber }}>
                    {change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "◆"}
                  </span>
                  <span style={{ fontFamily: font.body, fontSize: 13, color: C.slate, lineHeight: 1.5 }}>
                    {change.description}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action of the week */}
          {content.weeklyAction && (
            <div style={{
              marginTop: 16, background: C.cloud, borderRadius: 10, padding: "14px 16px",
            }}>
              <div style={{ fontFamily: font.mono, fontSize: 10, color: C.amber, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                Ação da semana
              </div>
              <div style={{ fontFamily: font.body, fontSize: 14, color: C.night, lineHeight: 1.5, fontWeight: 500 }}>
                {content.weeklyAction}
              </div>
            </div>
          )}

          {/* Narrative */}
          {content.narrative && (
            <div style={{
              fontFamily: font.body, fontSize: 14, color: C.zinc, lineHeight: 1.7,
              marginTop: 16, whiteSpace: "pre-line",
            }}>
              {content.narrative}
            </div>
          )}

          {/* Feedback (on specific weeks) */}
          {feedbackTrigger && (
            <div style={{ marginTop: 20 }}>
              <FeedbackWidget
                leadId={leadId}
                triggerPoint={feedbackTrigger as any}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
