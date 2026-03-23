"use client";

import { useState } from "react";
import InstantValueScreen from "@/components/InstantValueScreen";
import { ContentsTab } from "@/components/dashboard/ContentsTab";
import { ChecklistTab } from "@/components/dashboard/ChecklistTab";
import { LockedTab } from "@/components/dashboard/LockedTab";

const V = {
  night: "#161618", graphite: "#232326", slate: "#3A3A40",
  zinc: "#6E6E78", ash: "#9E9EA8", fog: "#EAEAEE",
  cloud: "#F4F4F7", white: "#FEFEFF", amber: "#CF8523",
  teal: "#2D9B83", coral: "#D9534F", coralWash: "rgba(217,83,79,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

type TabKey = "overview" | "diagnosis" | "checklist" | "contents";
type Tier = "free" | "paid" | "subscriber";

interface Props {
  lead: any;
  plan: any;
  diagnosis: any;
  tier: Tier;
  checklist: any | null;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Resultado" },
  { key: "diagnosis", label: "Diagnóstico" },
  { key: "checklist", label: "Checklist" },
  { key: "contents", label: "Conteúdos" },
];

function isTabLocked(tab: TabKey, tier: Tier): false | 1 | 2 {
  if (tab === "overview") return false;
  if (tier === "subscriber") return false;
  if (tier === "paid") {
    if (tab === "contents") return false; // open but with banner
    return false;
  }
  // free
  if (tab === "contents") return 2;
  return 1; // diagnosis, checklist
}

export default function DashboardClient({ lead, plan, diagnosis, tier, checklist }: Props) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const blocks = plan?.content?.blocks || plan?.blocks || [];

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
            {tier === "subscriber"
              ? "Assinante Virô"
              : tier === "paid"
                ? "Diagnóstico completo"
                : "Diagnóstico gratuito"}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {TABS.map(t => {
            const locked = isTabLocked(t.key, tier);
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: tab === t.key ? V.night : V.white,
                color: tab === t.key ? V.white : V.zinc,
                fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                position: "relative",
              }}>
                {t.label}
                {locked && (
                  <span style={{ fontSize: 10, marginLeft: 4 }}>
                    {locked === 2 ? "🔒" : "🔒"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab: Overview */}
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

        {/* Tab: Diagnóstico */}
        {tab === "diagnosis" && (
          isTabLocked("diagnosis", tier) ? (
            <LockedTab
              lockLevel={1}
              ctaLabel="Desbloquear por R$497"
              ctaUrl={`/api/checkout?leadId=${lead.id}`}
            />
          ) : (
            <div>
              {blocks.length === 0 ? (
                <div style={{
                  background: V.white, borderRadius: 14, padding: "40px 24px",
                  textAlign: "center", border: `1px solid ${V.fog}`,
                }}>
                  <p style={{ fontSize: 14, color: V.zinc }}>Diagnóstico sendo gerado...</p>
                </div>
              ) : (
                blocks.map((block: any, i: number) => (
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
                ))
              )}
            </div>
          )
        )}

        {/* Tab: Checklist */}
        {tab === "checklist" && (
          isTabLocked("checklist", tier) ? (
            <LockedTab
              lockLevel={1}
              ctaLabel="Desbloquear por R$497"
              ctaUrl={`/api/checkout?leadId=${lead.id}`}
            />
          ) : (
            <ChecklistTab leadId={lead.id} checklist={checklist} />
          )
        )}

        {/* Tab: Conteúdos */}
        {tab === "contents" && (
          isTabLocked("contents", tier) ? (
            <LockedTab
              lockLevel={2}
              ctaLabel="Assinar por R$99/mês"
              ctaUrl={`/api/checkout/subscription?leadId=${lead.id}`}
            />
          ) : (
            <ContentsTab
              leadId={lead.id}
              showUpgradeBanner={tier === "paid"}
            />
          )
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
