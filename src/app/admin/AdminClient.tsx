// ============================================================================
// Virô — Admin Dashboard (Client)
// Funnel visualization, leads table, feedback overview, audit
// ============================================================================
// File: src/app/admin/AdminClient.tsx

"use client";

import { useState } from "react";

const C = {
  night: "#161618", slate: "#3A3A40", zinc: "#6E6E78", ash: "#9E9EA8",
  fog: "#EAEAEE", cloud: "#F4F4F7", white: "#FEFEFF",
  amber: "#CF8523", amberWash: "rgba(207,133,35,0.08)",
  teal: "#2D9B83", tealWash: "rgba(45,155,131,0.08)",
  coral: "#D9534F", coralWash: "rgba(217,83,79,0.08)",
};
const font = {
  display: "'Satoshi', -apple-system, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

type Tab = "funnel" | "leads" | "feedback" | "audit";

interface Props {
  funnelCounts: Record<string, number>;
  leads: any[];
  feedback: any[];
  diagnoses: any[];
  plans: any[];
}

export default function AdminClient({ funnelCounts, leads, feedback, diagnoses, plans }: Props) {
  const [tab, setTab] = useState<Tab>("funnel");
  const [auditId, setAuditId] = useState<string | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: C.cloud }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(254,254,255,0.92)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.fog}`, padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: C.night }}>Virô</span>
          <span style={{ fontFamily: font.mono, fontSize: 10, color: C.amber, background: C.amberWash, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>admin</span>
          <div style={{ flex: 1 }} />
          {(["funnel", "leads", "feedback", "audit"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontFamily: font.display, fontSize: 13, fontWeight: 500,
              color: tab === t ? C.amber : C.zinc,
              background: tab === t ? C.amberWash : "transparent",
              border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            }}>
              {t === "funnel" ? "Funil" : t === "leads" ? "Leads" : t === "feedback" ? "Feedback" : "Auditoria"}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 80px" }}>
        {tab === "funnel" && <FunnelView counts={funnelCounts} leads={leads} />}
        {tab === "leads" && <LeadsView leads={leads} plans={plans} />}
        {tab === "feedback" && <FeedbackView feedback={feedback} />}
        {tab === "audit" && <AuditView diagnoses={diagnoses} auditId={auditId} onSelect={setAuditId} />}
      </main>
    </div>
  );
}

// ─── FUNNEL ──────────────────────────────────────────────────────────

function FunnelView({ counts, leads }: { counts: Record<string, number>; leads: any[] }) {
  const steps = [
    { key: "page_view", label: "Visitas" },
    { key: "form_started", label: "Iniciou form" },
    { key: "form_completed", label: "Completou form" },
    { key: "instant_value_viewed", label: "Viu resultado" },
    { key: "checkout_initiated", label: "Iniciou checkout" },
    { key: "payment_success", label: "Pagou" },
    { key: "dashboard_viewed", label: "Viu dashboard" },
  ];

  const maxCount = Math.max(...steps.map((s) => counts[s.key] || 0), 1);
  const paidLeads = leads.filter((l) => l.status === "paid").length;
  const totalLeads = leads.length;

  return (
    <div>
      {/* Top stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total leads", value: totalLeads, color: C.night },
          { label: "Pagos", value: paidLeads, color: C.teal },
          { label: "Conversão", value: totalLeads > 0 ? `${((paidLeads / totalLeads) * 100).toFixed(1)}%` : "—", color: C.amber },
          { label: "Último 30d", value: Object.values(counts).reduce((s, v) => s + v, 0), color: C.zinc },
        ].map((stat, i) => (
          <div key={i} style={{ flex: 1, background: C.white, borderRadius: 12, padding: "18px 20px", border: `1px solid ${C.fog}` }}>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.ash, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: stat.color, letterSpacing: "-0.02em" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Funnel bars */}
      <div style={{ background: C.white, borderRadius: 14, padding: 24, border: `1px solid ${C.fog}` }}>
        <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.night, marginBottom: 20 }}>Funil (últimos 30 dias)</div>
        {steps.map((step, i) => {
          const count = counts[step.key] || 0;
          const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const prevCount = i > 0 ? counts[steps[i - 1].key] || 0 : count;
          const convRate = prevCount > 0 && i > 0 ? ((count / prevCount) * 100).toFixed(0) : "";

          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <div style={{ fontFamily: font.display, fontSize: 13, color: C.zinc, minWidth: 130, textAlign: "right" }}>{step.label}</div>
              <div style={{ flex: 1, background: C.cloud, borderRadius: 6, height: 28, overflow: "hidden", position: "relative" }}>
                <div style={{
                  width: `${Math.max(width, 2)}%`, height: "100%", borderRadius: 6,
                  background: i === steps.length - 1 ? C.teal : C.night,
                  transition: "width 0.5s ease",
                }} />
                <span style={{
                  position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                  fontFamily: font.mono, fontSize: 11, fontWeight: 600,
                  color: width > 20 ? C.white : C.slate,
                }}>
                  {count}
                </span>
              </div>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: C.ash, minWidth: 40, textAlign: "right" }}>
                {convRate ? `${convRate}%` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LEADS ───────────────────────────────────────────────────────────

function LeadsView({ leads, plans }: { leads: any[]; plans: any[] }) {
  const planMap = new Map(plans.map((p) => [p.lead_id, p]));

  return (
    <div style={{ background: C.white, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.fog}` }}>
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.fog}` }}>
        <span style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.night }}>Leads ({leads.length})</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.display, fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.cloud }}>
              {["Email", "Produto", "Região", "Status", "Plano", "Semanas", "Data"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.ash, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: font.mono }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const plan = planMap.get(lead.id);
              return (
                <tr key={lead.id} style={{ borderBottom: `1px solid ${C.fog}` }}>
                  <td style={{ padding: "10px 14px", color: C.night, fontWeight: 500 }}>{lead.email}</td>
                  <td style={{ padding: "10px 14px", color: C.slate }}>{lead.product}</td>
                  <td style={{ padding: "10px 14px", color: C.zinc }}>{lead.region}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <StatusBadge status={lead.status} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <StatusBadge status={lead.plan_status || "none"} />
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: font.mono, fontSize: 12, color: C.zinc }}>
                    {lead.weeks_active || 0}/12
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: font.mono, fontSize: 11, color: C.ash }}>
                    {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string }> = {
    paid: { bg: C.tealWash, color: C.teal },
    ready: { bg: C.tealWash, color: C.teal },
    completed: { bg: C.amberWash, color: C.amber },
    processing: { bg: C.amberWash, color: C.amber },
    generating: { bg: C.amberWash, color: C.amber },
    error: { bg: C.coralWash, color: C.coral },
    none: { bg: C.cloud, color: C.ash },
  };
  const c = config[status] || config.none;
  return (
    <span style={{
      fontFamily: font.mono, fontSize: 10, fontWeight: 500,
      color: c.color, background: c.bg, padding: "3px 8px", borderRadius: 4,
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      {status}
    </span>
  );
}

// ─── FEEDBACK ────────────────────────────────────────────────────────

function FeedbackView({ feedback }: { feedback: any[] }) {
  const triggers = ["post_instant_value", "post_diagnosis", "week_2", "week_4", "week_6", "week_10", "week_12"];
  const triggerLabels: Record<string, string> = {
    post_instant_value: "Pós resultado",
    post_diagnosis: "Pós diagnóstico",
    week_2: "Semana 2",
    week_4: "Semana 4",
    week_6: "Semana 6",
    week_10: "Semana 10",
    week_12: "Semana 12",
  };

  const byTrigger = triggers.map((t) => {
    const items = feedback.filter((f) => f.trigger_point === t);
    const avgRating = items.length > 0
      ? items.reduce((s, f) => s + (f.rating || 0), 0) / items.length
      : 0;
    const lowRatings = items.filter((f) => f.rating !== null && f.rating <= 2).length;
    const withComments = items.filter((f) => f.comment && f.comment.trim()).length;
    return { trigger: t, label: triggerLabels[t], count: items.length, avgRating, lowRatings, withComments, items };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {byTrigger.map((bt) => (
          <div key={bt.trigger} style={{
            flex: "1 1 140px", background: C.white, borderRadius: 12, padding: "16px 18px",
            border: `1px solid ${bt.lowRatings > 0 ? "rgba(217,83,79,0.2)" : C.fog}`,
          }}>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.ash, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{bt.label}</div>
            <div style={{ fontFamily: font.display, fontSize: 24, fontWeight: 700, color: C.night, letterSpacing: "-0.02em" }}>
              {bt.count > 0 ? bt.avgRating.toFixed(1) : "—"}
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 10, color: C.zinc, marginTop: 4 }}>
              {bt.count} resposta{bt.count !== 1 ? "s" : ""}{bt.lowRatings > 0 ? ` · ${bt.lowRatings} baixa${bt.lowRatings > 1 ? "s" : ""}` : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Recent comments */}
      <div style={{ background: C.white, borderRadius: 14, padding: 24, border: `1px solid ${C.fog}` }}>
        <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.night, marginBottom: 16 }}>Comentários recentes</div>
        {feedback.filter((f) => f.comment && f.comment.trim()).length === 0 ? (
          <div style={{ fontFamily: font.display, fontSize: 14, color: C.ash }}>Nenhum comentário ainda.</div>
        ) : (
          feedback.filter((f) => f.comment && f.comment.trim()).slice(0, 20).map((f, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: i < 19 ? `1px solid ${C.fog}` : "none" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                <span style={{
                  fontFamily: font.mono, fontSize: 10, color: C.amber, background: C.amberWash,
                  padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                }}>
                  {triggerLabels[f.trigger_point] || f.trigger_point}
                </span>
                <span style={{ fontFamily: font.mono, fontSize: 10, color: f.rating <= 2 ? C.coral : C.teal }}>
                  {f.rating_type === "nps" ? `NPS ${f.rating}` : `${f.rating}/5`}
                </span>
                <span style={{ fontFamily: font.mono, fontSize: 10, color: C.ash }}>
                  {new Date(f.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div style={{ fontFamily: font.display, fontSize: 14, color: C.slate, lineHeight: 1.5 }}>
                "{f.comment}"
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── AUDIT ───────────────────────────────────────────────────────────

function AuditView({ diagnoses, auditId, onSelect }: { diagnoses: any[]; auditId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* List */}
      <div style={{ width: 350, background: C.white, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.fog}` }}>
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.fog}` }}>
          <span style={{ fontFamily: font.display, fontSize: 14, fontWeight: 600, color: C.night }}>Diagnósticos ({diagnoses.length})</span>
        </div>
        {diagnoses.map((d) => (
          <button key={d.id} onClick={() => onSelect(d.id === auditId ? null : d.id)} style={{
            width: "100%", padding: "12px 18px", border: "none", borderBottom: `1px solid ${C.fog}`,
            background: d.id === auditId ? C.amberWash : "transparent",
            cursor: "pointer", textAlign: "left",
          }}>
            <div style={{ fontFamily: font.display, fontSize: 13, fontWeight: 500, color: C.night }}>
              Lead: {d.lead_id?.slice(0, 8)}...
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: C.zinc }}>
                Vol: {d.total_volume} · Inf: {d.influence_percent}%
              </span>
              <StatusBadge status={d.confidence_level || "low"} />
            </div>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div style={{ flex: 1, background: C.white, borderRadius: 14, padding: 24, border: `1px solid ${C.fog}`, minHeight: 400 }}>
        {auditId ? (
          <AuditDetail diagnosis={diagnoses.find((d) => d.id === auditId)} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.ash, fontFamily: font.display }}>
            Selecione um diagnóstico para auditar
          </div>
        )}
      </div>
    </div>
  );
}

function AuditDetail({ diagnosis }: { diagnosis: any }) {
  if (!diagnosis) return null;

  return (
    <div>
      <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600, color: C.night, marginBottom: 16 }}>
        Auditoria: {diagnosis.lead_id?.slice(0, 8)}...
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          { label: "Volume total", value: diagnosis.total_volume },
          { label: "Influência", value: `${diagnosis.influence_percent}%` },
          { label: "Market low", value: `R$${(diagnosis.market_low || 0).toLocaleString("pt-BR")}` },
          { label: "Market high", value: `R$${(diagnosis.market_high || 0).toLocaleString("pt-BR")}` },
          { label: "Confiança", value: diagnosis.confidence_level },
          { label: "Fontes", value: diagnosis.source },
        ].map((m, i) => (
          <div key={i} style={{ flex: "1 1 120px", background: C.cloud, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontFamily: font.mono, fontSize: 9, color: C.ash, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontFamily: font.display, fontSize: 15, fontWeight: 600, color: C.night }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: font.mono, fontSize: 10, color: C.ash, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
        Raw Data (JSON)
      </div>
      <pre style={{
        background: C.night, color: "#8BE9FD", borderRadius: 10, padding: 16,
        fontFamily: font.mono, fontSize: 11, lineHeight: 1.6,
        overflow: "auto", maxHeight: 400,
      }}>
        {JSON.stringify(diagnosis, null, 2)}
      </pre>
    </div>
  );
}
