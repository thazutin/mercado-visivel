"use client";

import { useState } from "react";

import { V } from "@/lib/design-tokens";

interface Lead {
  id: string; email: string; whatsapp: string; product: string; region: string;
  status: string; plan_status: string; created_at: string; paid_at: string | null;
  instagram: string; challenge: string; differentiator: string;
}

interface Props {
  leads: Lead[];
  stats: {
    total: number; paid: number; processing: number; withPlan: number;
    diagnosesCount: number; conversionRate: string; avgPipelineMs: number;
  };
  pipelineRuns: any[];
}

export default function AdminClient({ leads, stats, pipelineRuns }: Props) {
  const [tab, setTab] = useState<"funnel" | "leads" | "pipeline">("funnel");
  const [search, setSearch] = useState("");

  const filteredLeads = leads.filter(l =>
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.product?.toLowerCase().includes(search.toLowerCase()) ||
    l.region?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: V.night, margin: 0 }}>Virô Admin</h1>
            <p style={{ fontSize: 13, color: V.ash, margin: "4px 0 0" }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <a href="/" style={{ fontSize: 13, color: V.zinc, textDecoration: "none" }}>← Voltar ao site</a>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Leads", value: stats.total, color: V.night },
            { label: "Diagnósticos", value: stats.diagnosesCount, color: V.amber },
            { label: "Pagos", value: stats.paid, color: V.teal },
            { label: "Com Plano", value: stats.withPlan, color: V.teal },
            { label: "Conversão", value: `${stats.conversionRate}%`, color: stats.paid > 0 ? V.teal : V.ash },
            { label: "Pipeline Avg", value: `${(stats.avgPipelineMs / 1000).toFixed(1)}s`, color: V.zinc },
          ].map((s, i) => (
            <div key={i} style={{
              background: V.white, borderRadius: 12, padding: "16px",
              border: `1px solid ${V.fog}`, textAlign: "center",
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: V.ash, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {(["funnel", "leads", "pipeline"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t ? V.night : V.white,
              color: tab === t ? V.white : V.zinc,
              fontSize: 13, fontWeight: 500,
            }}>
              {t === "funnel" ? "Funil" : t === "leads" ? "Leads" : "Pipeline"}
            </button>
          ))}
        </div>

        {/* Tab: Funnel */}
        {tab === "funnel" && (
          <div style={{ background: V.white, borderRadius: 14, padding: 24, border: `1px solid ${V.fog}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: V.night, marginBottom: 20 }}>Funil de Conversão</h3>
            {[
              { label: "Diagnósticos realizados", value: stats.diagnosesCount, pct: 100 },
              { label: "Checkout iniciado", value: "—", pct: 0 },
              { label: "Pagamento confirmado", value: stats.paid, pct: stats.diagnosesCount > 0 ? (stats.paid / stats.diagnosesCount) * 100 : 0 },
              { label: "Plano gerado", value: stats.withPlan, pct: stats.paid > 0 ? (stats.withPlan / stats.paid) * 100 : 0 },
            ].map((step, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: V.zinc }}>{step.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{step.value}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: V.fog, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    background: i === 0 ? V.amber : V.teal,
                    width: `${Math.max(step.pct, 2)}%`,
                    transition: "width 0.5s",
                  }} />
                </div>
              </div>
            ))}

            {/* Recent products */}
            <h4 style={{ fontSize: 14, fontWeight: 600, color: V.night, marginTop: 28, marginBottom: 12 }}>Produtos mais buscados</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(
                leads.reduce((acc: Record<string, number>, l) => {
                  const p = l.product?.toLowerCase().trim();
                  if (p) acc[p] = (acc[p] || 0) + 1;
                  return acc;
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([product, count], i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: "4px 12px", borderRadius: 100,
                    background: V.cloud, color: V.zinc,
                  }}>
                    {product} ({count})
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Tab: Leads */}
        {tab === "leads" && (
          <div style={{ background: V.white, borderRadius: 14, padding: 24, border: `1px solid ${V.fog}` }}>
            <input
              type="text"
              placeholder="Buscar por email, produto ou região..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 16px", borderRadius: 8,
                border: `1px solid ${V.fog}`, fontSize: 13, marginBottom: 16,
                outline: "none",
              }}
            />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${V.fog}` }}>
                    {["Email", "Produto", "Região", "Status", "Plano", "Data"].map(h => (
                      <th key={h} style={{
                        padding: "8px 12px", textAlign: "left", fontSize: 10,
                        textTransform: "uppercase", letterSpacing: "0.05em", color: V.ash, fontWeight: 500,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.slice(0, 50).map(l => (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${V.fog}` }}>
                      <td style={{ padding: "10px 12px", color: V.night }}>{l.email}</td>
                      <td style={{ padding: "10px 12px", color: V.zinc }}>{l.product}</td>
                      <td style={{ padding: "10px 12px", color: V.zinc }}>{l.region}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 100,
                          background: l.status === "paid" ? "rgba(45,155,131,0.1)" : l.status === "processing" ? "rgba(207,133,35,0.1)" : V.cloud,
                          color: l.status === "paid" ? V.teal : l.status === "processing" ? V.amber : V.ash,
                        }}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 100,
                          background: l.plan_status === "ready" ? "rgba(45,155,131,0.1)" : V.cloud,
                          color: l.plan_status === "ready" ? V.teal : V.ash,
                        }}>
                          {l.plan_status || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: V.ash, fontSize: 12 }}>
                        {new Date(l.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredLeads.length > 50 && (
              <p style={{ fontSize: 12, color: V.ash, marginTop: 12 }}>Mostrando 50 de {filteredLeads.length}</p>
            )}
          </div>
        )}

        {/* Tab: Pipeline */}
        {tab === "pipeline" && (
          <div style={{ background: V.white, borderRadius: 14, padding: 24, border: `1px solid ${V.fog}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: V.night, marginBottom: 20 }}>Performance do Pipeline</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${V.fog}` }}>
                    {["Data", "Duração", "Confiança", "Fontes"].map(h => (
                      <th key={h} style={{
                        padding: "8px 12px", textAlign: "left", fontSize: 10,
                        textTransform: "uppercase", letterSpacing: "0.05em", color: V.ash, fontWeight: 500,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipelineRuns.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${V.fog}` }}>
                      <td style={{ padding: "10px 12px", color: V.zinc, fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: V.night }}>
                        {(r.total_duration_ms / 1000).toFixed(1)}s
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 100,
                          background: r.confidence_level === "high" ? "rgba(45,155,131,0.1)" : r.confidence_level === "medium" ? "rgba(207,133,35,0.1)" : V.cloud,
                          color: r.confidence_level === "high" ? V.teal : r.confidence_level === "medium" ? V.amber : V.ash,
                        }}>
                          {r.confidence_level}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: V.ash }}>
                        {(r.sources_used || []).length} fontes
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
