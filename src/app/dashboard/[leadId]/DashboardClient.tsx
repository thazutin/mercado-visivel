"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import PlanTasks from "@/components/PlanTasks";
import type { PlanTask } from "@/components/PlanTasks";
import TaskContentButton from "@/components/TaskContentButton";

const V = {
  night: "#161618", graphite: "#232326", slate: "#3A3A40",
  zinc: "#6E6E78", ash: "#9E9EA8", fog: "#EAEAEE",
  cloud: "#F4F4F7", white: "#FEFEFF", amber: "#CF8523",
  teal: "#2D9B83", coral: "#D9534F", coralWash: "rgba(217,83,79,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

interface Props {
  lead: any;
  plan: any;
  briefings: any[];
  diagnosis: any;
  snapshots: any[];
  planTasks?: PlanTask[];
}

export default function DashboardClient({ lead, plan, briefings, diagnosis, snapshots, planTasks = [] }: Props) {
  const [tab, setTab] = useState<"plan" | "weekly" | "briefings">("plan");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const blocks = plan?.blocks || [];
  const weeklyPlan = plan?.weekly_plan || plan?.weeklyPlan || [];
  const isGenerating = lead.plan_status === "generating";
  const planReady = plan?.status === "ready";

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: V.night, display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <span style={{ fontFamily: V.display, fontWeight: 700, fontSize: 20, color: V.white }}>V</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: V.night, margin: "0 0 8px" }}>
            {lead.product} · {lead.region}
          </h1>
          <p style={{ fontSize: 13, color: V.ash }}>
            Diagnóstico completo + Plano de 90 dias
          </p>
        </div>

        {/* Status banner */}
        {isGenerating && (
          <div style={{
            background: "rgba(207,133,35,0.1)", border: `1px solid rgba(207,133,35,0.2)`,
            borderRadius: 12, padding: "16px 20px", marginBottom: 24, textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: V.amber, margin: 0, fontWeight: 500 }}>
              Seu plano está sendo gerado... isso pode levar até 2 minutos.
            </p>
            <p style={{ fontSize: 12, color: V.ash, margin: "8px 0 0" }}>
              Recarregue a página em instantes.
            </p>
          </div>
        )}

        {!planReady && !isGenerating && (
          <div style={{
            background: V.coralWash, borderRadius: 12, padding: "16px 20px",
            marginBottom: 24, textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: V.coral, margin: 0 }}>
              Houve um problema na geração do plano. Entre em contato pelo WhatsApp.
            </p>
          </div>
        )}

        {/* Tabs */}
        {planReady && (
          <>
            <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
              {([
                { key: "plan", label: "Diagnóstico" },
                { key: "weekly", label: "Plano Semanal" },
                { key: "briefings", label: `Briefings (${briefings.length})` },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: tab === t.key ? V.night : V.white,
                  color: tab === t.key ? V.white : V.zinc,
                  fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Diagnostic Blocks */}
            {tab === "plan" && (
              <div>
                {blocks.map((block: any, i: number) => (
                  <div key={block.id || i} style={{
                    background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
                    marginBottom: 12, overflow: "hidden",
                  }}>
                    <button
                      onClick={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)}
                      style={{
                        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "18px 24px", border: "none", background: "transparent",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                          Bloco {i + 1}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: V.night }}>
                          {block.title}
                        </div>
                      </div>
                      <span style={{ fontSize: 18, color: V.ash, transition: "transform 0.2s", transform: expandedBlock === block.id ? "rotate(180deg)" : "rotate(0)" }}>
                        ▾
                      </span>
                    </button>
                    {expandedBlock === block.id && (
                      <div style={{
                        padding: "0 24px 24px", fontSize: 14, color: V.zinc,
                        lineHeight: 1.8,
                      }}
                        dangerouslySetInnerHTML={{
                          __html: (block.content || "")
                            .replace(/\n/g, "<br/>")
                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                            .replace(/## (.*?)(<br\/>)/g, "<h3 style='font-size:16px;font-weight:600;color:#161618;margin:16px 0 8px'>$1</h3>")
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Weekly Plan — tarefas com checkbox ou fallback texto */}
            {tab === "weekly" && (
              <div>
                {planTasks.length > 0 ? (
                  <PlanTasks tasks={planTasks} />
                ) : (
                  /* Fallback: exibicao texto quando nao ha plan_tasks */
                  weeklyPlan.map((week: any, i: number) => {
                    const catColors: Record<string, string> = {
                      presence: V.teal, content: V.amber,
                      authority: "#8B5CF6", engagement: "#E1306C",
                    };
                    return (
                      <div key={i} style={{
                        background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
                        padding: "20px 24px", marginBottom: 12,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              fontFamily: V.mono, fontSize: 11, fontWeight: 600,
                              color: V.teal, background: "rgba(45,155,131,0.1)",
                              width: 32, height: 32, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {week.week}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: V.night }}>
                              {week.title}
                            </div>
                          </div>
                          {week.category && (
                            <span style={{
                              fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em",
                              textTransform: "uppercase", padding: "3px 10px", borderRadius: 100,
                              color: catColors[week.category] || V.ash,
                              background: `${catColors[week.category] || V.ash}15`,
                            }}>
                              {week.category}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7, marginBottom: 10 }}>
                          {week.mainAction}
                        </div>
                        {week.script && (
                          <div style={{
                            background: V.cloud, borderRadius: 8, padding: "12px 16px",
                            fontSize: 13, color: V.zinc, lineHeight: 1.6, marginBottom: 10,
                            borderLeft: `3px solid ${V.amber}`,
                          }}>
                            <strong style={{ color: V.night, fontSize: 12 }}>Roteiro/Template:</strong><br />
                            {week.script}
                          </div>
                        )}
                        {week.kpi && (
                          <div style={{ fontSize: 12, color: V.ash }}>
                            <strong>Meta:</strong> {week.kpi}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab: Briefings */}
            {tab === "briefings" && (
              <div>
                {/* Score Evolution Chart */}
                {snapshots.length > 1 && (() => {
                  const chartData = snapshots
                    .filter((s: any) => s.data?.influenceScore != null)
                    .map((s: any) => ({
                      week: `S${s.week_number}`,
                      influence: Math.round(s.data.influenceScore),
                    }));

                  if (chartData.length < 2) return null;

                  return (
                    <div style={{
                      background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
                      padding: "20px 24px", marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: V.night, marginBottom: 16 }}>
                        Evolução da Influência Digital
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={V.fog} />
                          <XAxis dataKey="week" tick={{ fontSize: 11, fill: V.ash }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: V.ash }} unit="%" />
                          <Tooltip
                            contentStyle={{
                              background: V.night, border: "none", borderRadius: 8,
                              fontSize: 13, color: V.white,
                            }}
                            formatter={(value: number) => [`${value}%`, "Influência"]}
                          />
                          <Line
                            type="monotone" dataKey="influence" stroke={V.teal}
                            strokeWidth={2} dot={{ fill: V.teal, r: 4 }}
                            activeDot={{ r: 6, fill: V.amber }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}

                {briefings.length === 0 ? (
                  <div style={{
                    background: V.white, borderRadius: 14, padding: "40px 24px",
                    textAlign: "center", border: `1px solid ${V.fog}`,
                  }}>
                    <p style={{ fontSize: 15, color: V.zinc, marginBottom: 8 }}>
                      Seu primeiro briefing chega na próxima segunda-feira.
                    </p>
                    <p style={{ fontSize: 13, color: V.ash }}>
                      Toda semana: o que mudou no seu mercado + ação da semana.
                    </p>
                  </div>
                ) : (
                  briefings.map((b: any, i: number) => {
                    let content: any = null;
                    try {
                      content = typeof b.content === "string" ? JSON.parse(b.content) : b.content;
                    } catch {
                      // malformed JSON — render fallback
                    }

                    if (!content) {
                      return (
                        <div key={i} style={{
                          background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
                          padding: "20px 24px", marginBottom: 12,
                        }}>
                          <span style={{ fontFamily: V.mono, fontSize: 11, color: V.amber, fontWeight: 600 }}>
                            Semana {b.week_number}
                          </span>
                          <p style={{ fontSize: 13, color: V.ash, margin: "8px 0 0" }}>
                            Conteúdo indisponível para esta semana.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div key={i} style={{
                        background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
                        padding: "20px 24px", marginBottom: 12,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <span style={{ fontFamily: V.mono, fontSize: 11, color: V.amber, fontWeight: 600 }}>
                            Semana {b.week_number}
                          </span>
                          <span style={{ fontSize: 12, color: V.ash }}>
                            {new Date(b.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {content?.changes?.map((c: any, j: number) => (
                          <div key={j} style={{
                            display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: V.zinc,
                          }}>
                            <span style={{ color: c.direction === "up" ? V.teal : c.direction === "down" ? V.coral : V.ash }}>
                              {c.direction === "up" ? "↑" : c.direction === "down" ? "↓" : "→"}
                            </span>
                            {c.description}
                          </div>
                        ))}
                        {content?.weeklyAction && (
                          <div style={{
                            marginTop: 12, padding: "12px 16px", background: V.cloud,
                            borderRadius: 8, borderLeft: `3px solid ${V.teal}`,
                          }}>
                            <strong style={{ fontSize: 13, color: V.night }}>Ação da semana:</strong>
                            <div style={{ fontSize: 13, color: V.zinc, marginTop: 4, lineHeight: 1.6 }}>
                              {content.weeklyAction}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 32, marginTop: 24, borderTop: `1px solid ${V.fog}` }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night }}>Virô</span>
          <p style={{ fontSize: 11, color: V.ash, fontFamily: V.mono, marginTop: 4 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
