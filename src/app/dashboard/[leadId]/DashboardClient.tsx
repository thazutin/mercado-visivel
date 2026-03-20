"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import PlanTasks from "@/components/PlanTasks";
import type { PlanTask } from "@/components/PlanTasks";
import TaskContentButton from "@/components/TaskContentButton";
import InstantValueScreen from "@/components/InstantValueScreen";
import { ContentsTab } from "@/components/dashboard/ContentsTab";

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`;
  return n.toLocaleString("pt-BR");
}

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
  const [tab, setTab] = useState<"overview" | "plan" | "weekly" | "briefings">("overview");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const blocks = plan?.content?.blocks || plan?.blocks || [];
  const weeklyPlan = plan?.content?.weeklyPlan || plan?.content?.weekly_plan || plan?.weekly_plan || plan?.weeklyPlan || [];
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
                { key: "overview", label: "Resultado" },
                { key: "plan", label: "Diagnóstico" },
                { key: "weekly", label: "Plano Semanal" },
                { key: "briefings", label: "Conteúdos" },
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

            {/* Tab: Overview — componente real do diagnóstico inicial */}
            {tab === "overview" && (
              <div>
                {lead.diagnosis_display ? (
                  <InstantValueScreen
                    product={lead.product}
                    region={lead.region}
                    results={lead.diagnosis_display}
                    onCheckout={() => {}}
                    leadId={lead.id}
                    hideCTA
                  />
                ) : (
                  <div style={{ background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`, padding: "24px" }}>
                    <p style={{ fontSize: 14, color: V.zinc }}>Diagnóstico inicial não disponível.</p>
                  </div>
                )}
              </div>
            )}

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

            {/* Tab: Conteúdos */}
            {tab === "briefings" && (
              <ContentsTab leadId={lead.id} />
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
