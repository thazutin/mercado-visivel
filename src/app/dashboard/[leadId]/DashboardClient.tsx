"use client";

import { useState, useEffect, useCallback } from "react";
import InstantValueScreen from "@/components/InstantValueScreen";
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

type TabKey = "diagnostico" | "plano";
type Tier = "free" | "paid" | "subscriber";

interface Props {
  lead: any;
  plan: any;
  diagnosis: any;
  tier: Tier;
  checklist: any | null;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "plano", label: "Plano de Ação" },
];

// ─── Accordion Section ───────────────────────────────────────────────
function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 20px", border: `1px solid ${V.fog}`, borderRadius: open ? "14px 14px 0 0" : 14,
        background: V.white, cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: V.night }}>{title}</span>
        <span style={{ fontSize: 16, color: V.ash, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>
      {open && (
        <div style={{ border: `1px solid ${V.fog}`, borderTop: "none", borderRadius: "0 0 14px 14px", background: V.white, padding: "20px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────
function Spinner({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${V.fog}`,
        borderTopColor: V.amber, borderRadius: "50%",
        animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>{text}</p>
    </div>
  );
}

// ─── Seasonality (inline) ────────────────────────────────────────────
function SeasonalityBlock({ seasonality }: { seasonality: any }) {
  const hasData = seasonality?.months?.length > 0 && seasonality.months.some((m: any) => m.volume > 0);
  const maxVolume = hasData ? Math.max(...seasonality.months.map((m: any) => m.volume)) : 1;

  if (!hasData) return <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>Dados de sazonalidade indisponíveis para este mercado.</p>;

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 12 }}>Sazonalidade</div>
      <p style={{ fontSize: 13, color: V.zinc, marginBottom: 12, lineHeight: 1.6 }}>
        Pico em <strong style={{ color: V.teal }}>{seasonality.peak_month}</strong>, menor movimento em <strong style={{ color: V.coral }}>{seasonality.low_month}</strong>.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {seasonality.months.map((m: any) => {
          const pct = maxVolume > 0 ? Math.max((m.volume / maxVolume) * 100, 2) : 2;
          const isPeak = m.month === seasonality.peak_month;
          const isLow = m.month === seasonality.low_month;
          return (
            <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.zinc, width: 28, textAlign: "right", flexShrink: 0 }}>{m.month}</span>
              <div style={{ flex: 1, height: 16, background: V.cloud, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: isPeak ? V.teal : isLow ? V.coral : V.ash, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: V.mono, color: V.ash, width: 40, textAlign: "right", flexShrink: 0 }}>{m.volume.toLocaleString("pt-BR")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Macro Context ───────────────────────────────────────────────────
function MacroContextBlock({ macroContext }: { macroContext: any }) {
  const placeholder = "Integração com dados macroeconômicos em breve.";
  const summary = macroContext?.summary;
  const isPlaceholder = !summary || summary === placeholder;

  return (
    <div style={{ background: V.cloud, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>Contexto</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 8 }}>Cenário atual do mercado</div>
      <p style={{ fontSize: 13, color: isPlaceholder ? V.ash : V.zinc, margin: 0, lineHeight: 1.6 }}>{isPlaceholder ? placeholder : summary}</p>
    </div>
  );
}

// ─── Content Card ────────────────────────────────────────────────────
const CHANNEL_LABELS: Record<string, { icon: string; color: string }> = {
  instagram_feed: { icon: "📸", color: "#E1306C" },
  instagram_stories: { icon: "📱", color: "#833AB4" },
  google_business: { icon: "📍", color: "#4285F4" },
  whatsapp_status: { icon: "💬", color: "#25D366" },
};

function ContentCard({ c, leadId }: { c: any; leadId: string }) {
  const [copied, setCopied] = useState(false);
  const ch = CHANNEL_LABELS[c.channel_key] || { icon: "📝", color: V.ash };
  const fullText = c.hashtags?.length
    ? `${c.content}\n\n${c.hashtags.map((h: string) => h.startsWith("#") ? h : `#${h}`).join(" ")}`
    : c.content;

  return (
    <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px 18px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 100, background: `${ch.color}12`, fontSize: 11, fontWeight: 500, color: ch.color }}>
          <span>{ch.icon}</span> {c.channel}
        </div>
        {c.best_time && <span style={{ fontSize: 10, color: V.ash, fontFamily: V.mono }}>{c.best_time}</span>}
      </div>
      {c.hook && (
        <div style={{ fontSize: 15, fontWeight: 700, color: V.night, lineHeight: 1.4, marginBottom: 10 }}>
          {c.hook}
        </div>
      )}
      {c.image_url ? (
        <div style={{ marginBottom: 10, borderRadius: 8, overflow: "hidden" }}>
          <img src={c.image_url} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
        </div>
      ) : (c.channel_key === "instagram_feed" || c.channel_key === "instagram_stories") ? (
        <div style={{ marginBottom: 10, borderRadius: 8, height: 180, background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 12, color: V.ash }}>Imagem sendo gerada...</span>
        </div>
      ) : null}
      <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 10 }}>{c.content}</div>
      {c.hashtags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {c.hashtags.map((h: string, i: number) => (
            <span key={i} style={{ fontSize: 11, color: V.teal, background: "rgba(45,155,131,0.08)", padding: "2px 7px", borderRadius: 6 }}>
              {h.startsWith("#") ? h : `#${h}`}
            </span>
          ))}
        </div>
      )}
      {c.tip && (
        <div style={{ padding: "8px 12px", background: V.cloud, borderRadius: 8, borderLeft: `3px solid ${V.amber}`, fontSize: 12, color: V.zinc, marginBottom: 10 }}>
          <strong style={{ color: V.night, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>Dica:</strong> {c.tip}
        </div>
      )}
      {c.strategic_intent && (
        <div style={{
          padding: "10px 14px",
          background: "rgba(45,155,131,0.06)",
          borderRadius: 8,
          borderLeft: `3px solid ${V.teal}`,
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: V.teal, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Por que este conteúdo
          </div>
          <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.6 }}>
            {c.strategic_intent}
          </div>
        </div>
      )}
      <button onClick={() => { navigator.clipboard.writeText(fullText); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{
        padding: "6px 14px", borderRadius: 8, border: `1px solid ${V.fog}`,
        background: copied ? V.teal : V.white, color: copied ? V.white : V.zinc,
        fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
      }}>
        {copied ? "Copiado!" : "Copiar texto"}
      </button>
    </div>
  );
}

// ─── Contents Section (inline, replaces ContentsTab) ─────────────────
function ContentsSection({ leadId, tier }: { leadId: string; tier: Tier }) {
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchContents = useCallback(async () => {
    try {
      const res = await fetch(`/api/contents?leadId=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.contents || [];
        setContents(items);
        return items;
      }
    } catch { /* ignore */ } finally { setLoading(false); }
    return [];
  }, [leadId]);

  useEffect(() => {
    fetchContents().then(items => { if (items.length === 0) setPolling(true); });
  }, [fetchContents]);

  useEffect(() => {
    if (!polling) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const items = await fetchContents();
      if (items.length > 0 || attempts >= 12) { setPolling(false); clearInterval(interval); }
    }, 10_000);
    return () => clearInterval(interval);
  }, [polling, fetchContents]);

  if (loading || (contents.length === 0 && polling)) {
    return <Spinner text="Seus conteúdos estão sendo gerados..." />;
  }

  if (contents.length === 0) {
    return <p style={{ fontSize: 13, color: V.ash, textAlign: "center", padding: "24px 0" }}>Nenhum conteúdo gerado ainda.</p>;
  }

  // For paid (non-subscriber), show week 1 + upsell
  if (tier === "paid") {
    return (
      <div>
        <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
          Semana 1
        </div>
        {contents.map((c: any) => <ContentCard key={c.id} c={c} leadId={leadId} />)}
        <div style={{
          background: "rgba(45,155,131,0.06)", border: "1px solid rgba(45,155,131,0.15)",
          borderRadius: 12, padding: "18px 20px", marginTop: 8,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 4 }}>
            Próximos conteúdos disponíveis toda sexta-feira para assinantes
          </p>
          <p style={{ fontSize: 12, color: V.zinc, marginBottom: 12 }}>
            4 posts + 3 briefings toda semana, gerados com base no seu mercado.
          </p>
          <button onClick={async () => {
            try {
              const res = await fetch("/api/checkout/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
              const data = await res.json();
              if (data.url) window.location.href = data.url;
            } catch { /* ignore */ }
          }} style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: V.teal, color: V.white, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Assinar por R$99/mês
          </button>
        </div>
      </div>
    );
  }

  // Subscriber: group by created_at week (simplified: just show all)
  const nextFriday = new Date();
  nextFriday.setDate(nextFriday.getDate() + ((5 - nextFriday.getDay() + 7) % 7 || 7));
  const nextFridayStr = nextFriday.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

  return (
    <div>
      <div style={{
        background: "rgba(45,155,131,0.06)", border: "1px solid rgba(45,155,131,0.15)",
        borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: V.teal, fontWeight: 500,
      }}>
        Próximos conteúdos: sexta-feira, {nextFridayStr}
      </div>
      {contents.map((c: any) => <ContentCard key={c.id} c={c} leadId={leadId} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function DashboardClient({ lead, plan, diagnosis, tier, checklist }: Props) {
  const [tab, setTab] = useState<TabKey>("diagnostico");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const blocks = plan?.content?.blocks || plan?.blocks || [];
  const planReady = lead.plan_status === "ready";

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: V.night, display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <span style={{ fontFamily: V.display, fontWeight: 700, fontSize: 20, color: V.white }}>V</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: V.night, margin: 0 }}>
            {lead.product} · {lead.region}
          </h1>
        </div>

        {/* Banner: generating */}
        {tier !== "free" && !planReady && (
          <div style={{
            background: "rgba(207,133,35,0.08)", border: "1px solid rgba(207,133,35,0.2)",
            borderRadius: 12, padding: "14px 18px", marginBottom: 16,
            fontSize: 13, color: V.amber, fontWeight: 500, lineHeight: 1.5,
          }}>
            ✓ Pagamento confirmado — diagnóstico completo e plano de ação ficam prontos em até 15 minutos.
          </div>
        )}

        {/* Tabs (sticky) */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, position: "sticky", top: 0, zIndex: 10, background: V.cloud, padding: "12px 0", marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4 }}>
          {TABS.map(t => (
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

        {/* ═══ TAB: DIAGNÓSTICO ═══ */}
        {tab === "diagnostico" && (
          <div>
            {/* 1.1 Diagnóstico Inicial */}
            <Section title="Diagnóstico inicial">
              {lead.diagnosis_display ? (
                <InstantValueScreen
                  product={lead.product}
                  region={lead.region}
                  results={lead.diagnosis_display}
                  onCheckout={() => {}}
                  leadId={lead.id}
                  hideCTA
                  hideWorkRoutes
                />
              ) : (
                <p style={{ fontSize: 13, color: V.ash }}>Diagnóstico inicial não disponível.</p>
              )}
            </Section>

            {/* 1.2 Diagnóstico Completo — open if generating (spinner) */}
            <Section title="Diagnóstico completo" defaultOpen={tier !== "free" && !planReady}>
              {tier === "free" ? (
                <LockedTab lockLevel={1} ctaLabel="Desbloquear por R$497" ctaUrl="#" leadId={lead.id} />
              ) : !planReady ? (
                <Spinner text="Gerando diagnóstico completo..." />
              ) : blocks.length === 0 ? (
                <p style={{ fontSize: 13, color: V.ash }}>Nenhum bloco disponível.</p>
              ) : (
                <div>
                  <MacroContextBlock macroContext={diagnosis?.macro_context} />
                  {blocks.map((block: any, i: number) => {
                    const isDemandBlock = block.id === "demand_map";
                    const isExpanded = expandedBlock === block.id;
                    return (
                      <div key={block.id || i} style={{ background: V.cloud, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                        <button onClick={() => setExpandedBlock(isExpanded ? null : block.id)} style={{
                          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "14px 18px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
                        }}>
                          <div>
                            <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 }}>Bloco {i + 1}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: V.night }}>{block.title}</div>
                          </div>
                          <span style={{ fontSize: 16, color: V.ash, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: "0 18px 18px" }}>
                            <div style={{ fontSize: 13, color: V.zinc, lineHeight: 1.8 }}
                              dangerouslySetInnerHTML={{
                                __html: (block.content || "")
                                  .replace(/\n/g, "<br/>")
                                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                  .replace(/## (.*?)(<br\/>)/g, "<h3 style='font-size:15px;font-weight:600;color:#161618;margin:14px 0 6px'>$1</h3>")
                              }}
                            />
                            {isDemandBlock && (
                              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${V.fog}` }}>
                                <SeasonalityBlock seasonality={diagnosis?.seasonality} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ═══ TAB: PLANO DE AÇÃO ═══ */}
        {tab === "plano" && (
          <div>
            {/* 2.1 Itens estruturantes */}
            <Section title="Itens estruturantes">
              {tier === "free" ? (
                <LockedTab lockLevel={1} ctaLabel="Desbloquear por R$497" ctaUrl="#" leadId={lead.id} />
              ) : !planReady ? (
                <Spinner text="Gerando plano de ação..." />
              ) : (
                <ChecklistTab leadId={lead.id} checklist={checklist} />
              )}
            </Section>

            {/* 2.2 Conteúdos semanais */}
            <Section title="Conteúdos semanais">
              {tier === "free" ? (
                <LockedTab lockLevel={1} ctaLabel="Desbloqueie com o Diagnóstico Completo" ctaUrl="#" leadId={lead.id} />
              ) : (
                <ContentsSection leadId={lead.id} tier={tier} />
              )}
            </Section>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 28, marginTop: 20, borderTop: `1px solid ${V.fog}` }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night }}>Virô</span>
          <p style={{ fontSize: 11, color: V.ash, fontFamily: V.mono, marginTop: 4 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
