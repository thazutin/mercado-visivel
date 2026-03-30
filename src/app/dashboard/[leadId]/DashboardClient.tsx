"use client";

import { useState, useEffect, useCallback } from "react";
import InstantValueScreen from "@/components/InstantValueScreen";
import { LockedTab } from "@/components/dashboard/LockedTab";
import { NelsonLogo } from "@/components/NelsonLogo";

function fmtBRL(n: number): string {
  if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `R$${Math.round(n / 1_000)}k`;
  return `R$${n.toLocaleString('pt-BR')}`;
}

function formatLocationDisplay(address: string): string {
  if (!address) return '';
  // Remove CEP, "Brazil", "Brasil" e código postal
  const cleaned = address
    .replace(/\d{5}-?\d{3}/g, '')
    .replace(/,?\s*Bra[sz]il\s*$/i, '')
    .replace(/,?\s*BR\s*$/i, '');
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  // Se tem 3+ partes: "Bairro, Cidade" (pega penúltimo e antepenúltimo relevante)
  if (parts.length >= 3) {
    // Tenta encontrar bairro e cidade
    const city = parts.find(p => /- [A-Z]{2}$/.test(p))?.replace(/\s*-\s*[A-Z]{2}$/, '').trim();
    const neighborhood = parts.length > 2 ? parts[parts.length - 3]?.trim() : null;
    if (neighborhood && city) return `${neighborhood}, ${city}`;
    if (city) return city;
  }
  // Fallback: primeira parte do endereço (antes da primeira vírgula)
  return parts[0] || address;
}

const V = {
  night: "#161618", graphite: "#232326", slate: "#E8E4DE",
  zinc: "#888880", ash: "#888880", fog: "#E8E4DE",
  cloud: "#F7F5F2", white: "#FFFFFF", amber: "#CF8523",
  teal: "#1D9E75", coral: "#D9534F", coralWash: "rgba(217,83,79,0.06)",
  mist: "#C8C8D0", amberWash: "rgba(207,133,35,0.06)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

type TabKey = "diagnostico" | "estruturantes" | "semana";
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
  { key: "estruturantes", label: "Seu Plano" },
  { key: "semana", label: "Esta Semana" },
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

// ─── CopyBlock ──────────────────────────────────────────────────────
function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ background: "#FAF8F5", borderRadius: 8, padding: "8px 10px",
      marginBottom: 6, borderLeft: `3px solid ${V.amber}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: V.amber, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Copy pronto
        </span>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${V.fog}`, background: copied ? V.teal : V.white, color: copied ? V.white : V.zinc, fontSize: 10, cursor: "pointer" }}>
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</p>
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

// ─── Relatório Setorial ──────────────────────────────────────────────
function RelatorioSetorialBlock({ relatorio }: { relatorio: any }) {
  if (!relatorio || !relatorio.destaque) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: V.night, borderRadius: 12, padding: "16px 18px", marginBottom: 10 }}>
        <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber,
          letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
          Contexto do mercado · {relatorio.data_ref || ''}
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: V.white,
          margin: "0 0 12px", lineHeight: 1.4 }}>
          {relatorio.destaque}
        </p>
        {relatorio.oportunidade_da_semana && (
          <div style={{ background: "rgba(207,133,35,0.12)", borderRadius: 8,
            padding: "10px 12px", borderLeft: `3px solid ${V.amber}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: V.amber,
              textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Oportunidade desta semana
            </div>
            <p style={{ fontSize: 13, color: V.mist, margin: 0, lineHeight: 1.5 }}>
              {relatorio.oportunidade_da_semana}
            </p>
          </div>
        )}
      </div>
      {relatorio.tendencias && relatorio.tendencias.length > 0 && (
        <div>
          {relatorio.tendencias.slice(0, 3).map((t: any, i: number) => (
            <div key={i} style={{ background: V.white, borderRadius: 10,
              border: `1px solid ${V.fog}`, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>
                  {t.titulo}
                </span>
                <span style={{
                  fontFamily: V.mono, fontSize: 9, padding: "2px 7px",
                  borderRadius: 100, fontWeight: 600,
                  background: t.relevancia === 'alta' ? "rgba(45,155,131,0.12)" : V.fog,
                  color: t.relevancia === 'alta' ? V.teal : V.ash,
                }}>
                  {t.relevancia}
                </span>
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px", lineHeight: 1.5 }}>
                {t.descricao}
              </p>
              {t.acao_sugerida && (
                <p style={{ fontSize: 11, color: V.teal, margin: 0, fontWeight: 500 }}>
                  → {t.acao_sugerida}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {relatorio.contexto_competitivo && (
        <div style={{ background: V.cloud, borderRadius: 10, padding: "12px 14px",
          border: `1px solid ${V.fog}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: V.zinc,
            textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Contexto competitivo
          </div>
          <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
            {relatorio.contexto_competitivo}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Itens Estruturantes Tab ─────────────────────────────────────────
function ItensEstruturantesTab({ leadId, planReady, plan }: {
  leadId: string; planReady: boolean; plan: any;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/checklists?leadId=${leadId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.items) setItems(data.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [leadId]);

  const toggleItem = async (itemId: string, completed: boolean) => {
    await fetch('/api/checklists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, completed }),
    });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, completed } : i));
  };

  if (!planReady) return <Spinner text="Identificando o que precisa estar no lugar primeiro..." />;
  if (loading) return <Spinner text="Um segundo..." />;

  const summary = plan?.content?.itensEstrurantesSummary || '';

  const PILAR_MAP: Record<string, { label: string; color: string; icon: string }> = {
    descoberta: { label: 'Seja Encontrável', color: V.teal, icon: '🔍' },
    credibilidade: { label: 'Construa Credibilidade', color: V.amber, icon: '⭐' },
    reputacao: { label: 'Construa Credibilidade', color: V.amber, icon: '⭐' },
    presenca: { label: 'Participe da Cultura', color: '#8B5CF6', icon: '📣' },
  };

  const sorted = [...items].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const grupos = {
    encontravel: sorted.filter(i => i.dimensao === 'descoberta'),
    credibilidade: sorted.filter(i => ['credibilidade', 'reputacao'].includes(i.dimensao)),
    cultura: sorted.filter(i => i.dimensao === 'presenca'),
  };
  const ungrouped = sorted.filter(i => !['descoberta', 'credibilidade', 'reputacao', 'presenca'].includes(i.dimensao));

  const completed = items.filter(i => i.completed).length;
  const total = items.length;

  const renderItem = (item: any) => {
    const pilarInfo = PILAR_MAP[item.dimensao] || { label: item.dimensao, color: V.ash, icon: '📋' };
    return (
      <div key={item.id} style={{
        background: item.completed ? "rgba(45,155,131,0.04)" : V.white,
        borderRadius: 12, border: `1px solid ${item.completed ? V.teal + '40' : V.fog}`,
        padding: "14px 16px", marginBottom: 10,
        opacity: item.completed ? 0.7 : 1,
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <button
            onClick={() => toggleItem(item.id, !item.completed)}
            style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${item.completed ? V.teal : V.fog}`,
              background: item.completed ? V.teal : V.white,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", marginTop: 1,
            }}
          >
            {item.completed && (
              <span style={{ color: V.white, fontSize: 12, fontWeight: 700 }}>✓</span>
            )}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center",
              marginBottom: 6, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: V.night,
                textDecoration: item.completed ? "line-through" : "none" }}>
                {item.title}
              </span>
              <span style={{
                fontFamily: V.mono, fontSize: 9, padding: "2px 6px",
                borderRadius: 100, background: V.fog, color: V.ash,
              }}>
                {item.deadline || item.prazo}
              </span>
            </div>
            {item.description && (
              <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 8px",
                lineHeight: 1.5 }}>
                {item.description}
              </p>
            )}
            {item.action && !item.completed && (
              <div style={{ background: V.cloud, borderRadius: 8,
                padding: "8px 10px", marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: V.zinc,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  marginBottom: 4 }}>
                  Como fazer
                </div>
                <p style={{ fontSize: 12, color: V.night, margin: 0,
                  lineHeight: 1.5 }}>
                  {item.action}
                </p>
              </div>
            )}
            {item.copy_pronto && !item.completed && (
              <CopyBlock text={item.copy_pronto} />
            )}
            {item.verification && !item.completed && (
              <p style={{ fontSize: 11, color: V.teal, margin: 0,
                fontWeight: 500 }}>
                ✓ Verificar: {item.verification}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGrupo = (key: string, grupoItems: any[], pilarLabel: string, pilarIcon: string, pilarColor: string) => {
    if (grupoItems.length === 0) return null;
    const grupoCompleted = grupoItems.filter(i => i.completed).length;
    const grupoPct = Math.round((grupoCompleted / grupoItems.length) * 100);
    return (
      <div key={key} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>{pilarIcon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: V.night }}>{pilarLabel}</span>
          </div>
          <span style={{ fontFamily: V.mono, fontSize: 11, fontWeight: 600, color: pilarColor }}>
            {grupoCompleted}/{grupoItems.length}
          </span>
        </div>
        <div style={{ height: 4, background: V.fog, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ height: "100%", borderRadius: 2, background: pilarColor, width: `${grupoPct}%`, transition: "width 0.3s ease" }} />
        </div>
        {grupoItems.map(renderItem)}
      </div>
    );
  };

  return (
    <div>
      {summary && (
        <div style={{ background: V.amberWash, borderRadius: 10, padding: "12px 14px",
          marginBottom: 16, borderLeft: `3px solid ${V.amber}` }}>
          <p style={{ fontSize: 13, color: V.night, margin: 0, lineHeight: 1.5 }}>
            {summary}
          </p>
        </div>
      )}
      {total > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            marginBottom: 6, fontSize: 12, color: V.zinc }}>
            <span>{completed} de {total} itens concluídos</span>
            <span style={{ fontWeight: 600, color: V.teal }}>
              {Math.round((completed / total) * 100)}%
            </span>
          </div>
          <div style={{ height: 6, background: V.fog, borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, background: V.teal,
              width: `${Math.round((completed / total) * 100)}%`,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: V.ash, textAlign: "center", padding: "24px 0" }}>
          Nenhum item estruturante gerado ainda.
        </p>
      ) : (
        <>
          {renderGrupo('encontravel', grupos.encontravel, 'Seja Encontrável', '🔍', V.teal)}
          {renderGrupo('credibilidade', grupos.credibilidade, 'Construa Credibilidade', '⭐', V.amber)}
          {renderGrupo('cultura', grupos.cultura, 'Participe da Cultura', '📣', '#8B5CF6')}
          {ungrouped.length > 0 && renderGrupo('outros', ungrouped, 'Outros', '📋', V.ash)}
        </>
      )}
    </div>
  );
}

// ─── Influence Chart ─────────────────────────────────────────────────
function InfluenceChart({ snapshots, currentScore, product }: {
  snapshots: any[];
  currentScore: number;
  product: string;
}) {
  const points = [
    { label: 'Início', score: currentScore, week: 0 },
    ...snapshots
      .sort((a: any, b: any) => a.week_number - b.week_number)
      .map((s: any) => ({
        label: `Sem ${s.week_number}`,
        score: s.data?.influence?.influence?.totalInfluence ?? s.data?.influenceScore ?? null,
        week: s.week_number,
      }))
      .filter((p: any) => p.score !== null),
  ];

  if (points.length <= 1) return null;

  const maxScore = Math.max(...points.map((p: any) => p.score), 40);
  const minScore = Math.max(0, Math.min(...points.map((p: any) => p.score)) - 5);
  const range = maxScore - minScore || 1;

  const W = 300, H = 100, PAD = 20;
  const xStep = (W - PAD * 2) / (points.length - 1);

  const toX = (i: number) => PAD + i * xStep;
  const toY = (score: number) => H - PAD - ((score - minScore) / range) * (H - PAD * 2);

  const pathD = points.map((p: any, i: number) =>
    `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.score).toFixed(1)}`
  ).join(' ');

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const improved = lastPoint.score > firstPoint.score;

  return (
    <div style={{ background: V.white, borderRadius: 12, padding: "16px 18px",
      border: `1px solid ${V.fog}`, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Evolução da influência</div>
          <div style={{ fontSize: 11, color: V.ash, marginTop: 2 }}>{product}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 700,
            color: improved ? V.teal : V.coral }}>
            {improved ? '+' : ''}{(lastPoint.score - firstPoint.score).toFixed(0)}pp
          </div>
          <div style={{ fontSize: 10, color: V.ash }}>desde o início</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, overflow: "visible" }}>
        {[0, 0.5, 1].map(t => (
          <line key={t}
            x1={PAD} y1={toY(minScore + t * range)}
            x2={W - PAD} y2={toY(minScore + t * range)}
            stroke={V.fog} strokeWidth="1" />
        ))}
        <path d={pathD} fill="none"
          stroke={improved ? V.teal : V.coral} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p: any, i: number) => (
          <circle key={i} cx={toX(i)} cy={toY(p.score)} r="3"
            fill={i === points.length - 1 ? (improved ? V.teal : V.coral) : V.white}
            stroke={improved ? V.teal : V.coral} strokeWidth="2" />
        ))}
        {points.map((p: any, i: number) => (
          <text key={i} x={toX(i)} y={H - 2}
            textAnchor="middle" fontSize="8" fill={V.ash}>
            {p.label}
          </text>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>
          {firstPoint.score}% início
        </span>
        <span style={{ fontFamily: V.mono, fontSize: 10,
          color: improved ? V.teal : V.coral, fontWeight: 600 }}>
          {lastPoint.score}% agora
        </span>
      </div>
    </div>
  );
}

// ─── Pilares Score Card ─────────────────────────────────────────────
function PilaresScoreCard({ breakdown, levers, clientType }: {
  breakdown: any;
  levers: any[];
  clientType?: string;
}) {
  if (!breakdown) return null;

  const d1 = breakdown.d1_descoberta ?? breakdown.d1_discovery ?? 0;
  const d2 = breakdown.d2_credibilidade ?? breakdown.d2_credibility ?? 0;
  const d3 = breakdown.d3_presenca ?? breakdown.d3_reach ?? 0;
  const d4 = breakdown.d4_reputacao ?? 0;

  const pilares = [
    {
      id: 'encontravel',
      label: 'Seja Encontrável',
      icon: '🔍',
      score: Math.round(d1),
      color: V.teal,
      desc: 'Google, Maps, IA, SEO',
      dimensoes: ['descoberta'],
    },
    {
      id: 'credibilidade',
      label: 'Construa Credibilidade',
      icon: '⭐',
      score: Math.round((d2 + d4) / 2),
      color: V.amber,
      desc: 'Reviews, fotos, site, proposta de valor',
      dimensoes: ['credibilidade', 'reputacao'],
    },
    {
      id: 'cultura',
      label: 'Participe da Cultura',
      icon: '📣',
      score: Math.round(d3),
      color: '#8B5CF6',
      desc: 'Conteúdo, menções, alcance, parcerias',
      dimensoes: ['presenca'],
    },
  ];

  const scoreGeral = breakdown.total ?? Math.round(d1 * 0.35 + ((d2 + d4) / 2) * 0.40 + d3 * 0.25);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Score geral */}
      <div style={{ background: V.night, borderRadius: 12,
        padding: "16px 18px", marginBottom: 10,
        display: "flex", alignItems: "center",
        justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash,
            letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
            Posição Competitiva
          </div>
          <div style={{ fontSize: 13, color: V.mist }}>
            quanto mais perto de 100, maior a probabilidade de ser escolhido
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: V.teal,
            lineHeight: 1, fontFamily: V.display }}>
            {scoreGeral}
          </div>
        </div>
      </div>
      <div style={{ height: 6, background: V.graphite, borderRadius: 3, overflow: "hidden", marginBottom: 4, marginTop: -6 }}>
        <div style={{ height: "100%", background: V.teal, borderRadius: 3, width: `${scoreGeral}%`, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: V.mono, fontSize: 9, color: V.mist }}>Posição atual</span>
        <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash }}>Meta: 100</span>
      </div>

      {/* 3 pilares */}
      {pilares.map(pilar => {
        const pilarLevers = levers.filter(l =>
          pilar.dimensoes.includes(l.dimension)
        );
        return (
          <div key={pilar.id} style={{
            background: V.white, borderRadius: 12,
            border: `1px solid ${V.fog}`,
            padding: "14px 16px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{pilar.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: V.night }}>
                    {pilar.label}
                  </div>
                  <div style={{ fontSize: 11, color: V.ash }}>{pilar.desc}</div>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800,
                color: pilar.color, flexShrink: 0, marginLeft: 12 }}>
                {pilar.score}
              </div>
            </div>
            <div style={{ height: 4, background: V.fog,
              borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: pilar.color,
                width: `${pilar.score}%`,
                transition: "width 0.6s ease",
              }} />
            </div>
            {pilarLevers.length > 0 && (
              <div>
                {pilarLevers.slice(0, 2).map((lever: any, i: number) => (
                  <div key={i} style={{
                    background: V.cloud, borderRadius: 8,
                    padding: "8px 10px", marginBottom: 6,
                    borderLeft: `3px solid ${pilar.color}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600,
                      color: V.night, marginBottom: 2 }}>
                      {lever.action}
                    </div>
                    <div style={{ display: "flex", gap: 8,
                      alignItems: "center", flexWrap: "wrap" as const }}>
                      {lever.currentValue && (
                        <span style={{ fontSize: 10, color: V.ash }}>
                          Hoje: {lever.currentValue}
                        </span>
                      )}
                      {lever.targetValue && (
                        <span style={{ fontSize: 10, color: pilar.color,
                          fontWeight: 600 }}>
                          → Meta: {lever.targetValue}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: V.ash,
                        fontFamily: V.mono }}>
                        +{lever.impact}pts · {lever.horizon}
                      </span>
                    </div>
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

// ─── Projeção Financeira ─────────────────────────────────────────────
function ProjecaoCard({ projecao }: { projecao: any }) {
  if (!projecao) return null;
  const gapCaptura = projecao.gapCaptura ?? projecao.gapMensal ?? 0;
  if (gapCaptura <= 0 && projecao.mercadoTotal <= 0) return null;

  const gapPequeno = (projecao.clientesGap || 0) === 0 || (projecao.gapCaptura || 0) < 500;
  const destacarFamilias = gapPequeno && (projecao.familiasGap || 0) > 0;

  const camada1 = (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #3A3A40" }}>
      <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash,
        letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
        Captura imediata · buscas ativas no seu raio
      </div>
      {destacarFamilias ? (
        <div style={{ fontSize: 12, color: "#9E9EA8" }}>
          Via buscas ativas: {fmtBRL(projecao.receitaAtual)}/mês hoje → {fmtBRL(projecao.receitaPotencial)}/mês com plano
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div style={{ background: "#232326", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#C8C8D0" }}>
                {fmtBRL(projecao.receitaAtual)}/mês
              </div>
              <div style={{ fontSize: 10, color: "#6E6E78", marginTop: 2 }}>
                você compete hoje ({projecao.influenciaAtual}%)
              </div>
            </div>
            <div style={{ background: "#232326", borderRadius: 8, padding: "10px 12px",
              border: "1px solid rgba(207,133,35,0.3)" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#E6A445" }}>
                {fmtBRL(projecao.receitaPotencial)}/mês
              </div>
              <div style={{ fontSize: 10, color: "#6E6E78", marginTop: 2 }}>
                com o plano ({projecao.influenciaMeta}%)
              </div>
            </div>
          </div>
          {(projecao.clientesGap ?? 0) > 0 && (
            <div style={{ fontSize: 12, color: "#C8C8D0", textAlign: "center" }}>
              +{projecao.clientesGap} cliente{projecao.clientesGap !== 1 ? 's' : ''}/mês
              via buscas ativas · {fmtBRL(gapCaptura)} incremental
            </div>
          )}
        </>
      )}
    </div>
  );

  const camada2 = projecao.audienciaTarget > 0 ? (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #3A3A40" }}>
      <div style={{ fontFamily: V.mono, fontSize: 9,
        color: destacarFamilias ? "#2D9B83" : V.ash,
        letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
        Mercado alcançável
      </div>
      {destacarFamilias ? (
        <>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#2D9B83" }}>
              +{(projecao.familiasGap ?? 0).toLocaleString('pt-BR')}
            </span>
            <span style={{ fontSize: 13, color: "#C8C8D0", marginLeft: 8 }}>
              pessoas adicionais
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#9E9EA8", marginBottom: 6 }}>
            pessoas adicionais que passam a considerar você com o plano
          </div>
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#2D9B83" }}>
              +{(projecao.familiasGap ?? 0).toLocaleString('pt-BR')}
            </span>
            <span style={{ fontSize: 12, color: V.ash, marginLeft: 6 }}>
              pessoas adicionais com o plano
            </span>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: V.ash }}>
            <div>{(projecao.familiasAtual ?? 0).toLocaleString('pt-BR')} hoje</div>
            <div style={{ color: "#2D9B83" }}>{(projecao.familiasPotencial ?? 0).toLocaleString('pt-BR')} com plano</div>
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: "#6E6E78", marginTop: destacarFamilias ? 0 : 6 }}>
        Mercado total: {projecao.audienciaTarget.toLocaleString('pt-BR')} pessoas ·
        potencial {fmtBRL(projecao.mercadoTotal)}/mês
      </div>
    </div>
  ) : null;

  return (
    <div style={{ background: V.night, borderRadius: 14, padding: "20px", marginBottom: 16 }}>
      <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em",
        textTransform: "uppercase", marginBottom: 16 }}>
        O que está em jogo
      </div>

      {destacarFamilias ? <>{camada2}{camada1}</> : <>{camada1}{camada2}</>}

      {projecao.posicaoLider && projecao.nomeLider && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: V.mono, fontSize: 9, color: "#E05252",
            letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
            Risco competitivo
          </div>
          <div style={{ fontSize: 12, color: "#C8C8D0", lineHeight: 1.6 }}>
            <strong style={{ color: "#E05252" }}>{projecao.nomeLider}</strong> disputa{' '}
            {fmtBRL(projecao.receitaLider)}/mês vs seus {fmtBRL(projecao.receitaAtual)}/mês.
            {' '}Se continuar crescendo enquanto você não age, o gap aumenta.
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #3A3A40",
        fontSize: 10, color: V.ash, lineHeight: 1.6, textAlign: "center" }}>
        Ticket estimado: {fmtBRL(projecao.ticketMedio)} · Conversão: {(projecao.taxaConversao * 100).toFixed(0)}%
        {projecao.ticketRationale && (
          <div style={{ marginTop: 4, fontStyle: "italic", color: "#3A3A40" }}>
            {projecao.ticketRationale}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Levers Card ─────────────────────────────────────────────────────
function LeversCard({ levers }: { levers: any[] }) {
  if (!levers || levers.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 10 }}>
        O que move seu score de influência
      </div>
      {levers.map((lever: any, i: number) => {
        const dimColor = lever.dimension === 'alcance' ? '#8B5CF6'
          : lever.dimension === 'descoberta' ? '#2D9B83' : '#CF8523';
        const dimLabel = lever.dimension === 'alcance' ? 'Alcance'
          : lever.dimension === 'descoberta' ? 'Descoberta' : 'Credibilidade';
        return (
          <div key={i} style={{ padding: "12px 14px", marginBottom: 8, borderRadius: 10,
            background: V.cloud, border: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontFamily: V.mono, fontSize: 9, padding: "2px 7px", borderRadius: 100,
                  background: `${dimColor}15`, color: dimColor, fontWeight: 600 }}>{dimLabel}</span>
                <span style={{ fontFamily: V.mono, fontSize: 9, padding: "2px 7px", borderRadius: 100,
                  background: V.fog, color: V.ash }}>{lever.horizon}</span>
              </div>
              <span style={{ fontFamily: V.mono, fontSize: 11, fontWeight: 700, color: '#2D9B83' }}>
                +{lever.impact}pts
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: V.night, margin: "0 0 4px", lineHeight: 1.4 }}>
              {lever.action}
            </p>
            {lever.currentValue && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 11, color: V.ash, fontFamily: V.mono }}>{lever.currentValue}</span>
                {lever.targetValue && <>
                  <span style={{ fontSize: 10, color: V.ash }}>→</span>
                  <span style={{ fontSize: 11, color: '#2D9B83', fontFamily: V.mono }}>{lever.targetValue}</span>
                </>}
              </div>
            )}
          </div>
        );
      })}
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

// ─── Contents Section ────────────────────────────────────────────────
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

  if (tier === "paid") {
    return (
      <div>
        <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>
          Semana 1
        </div>
        {contents.map((c: any) => <ContentCard key={c.id} c={c} leadId={leadId} />)}
        <div style={{
          background: "rgba(45,155,131,0.06)", border: "1px solid rgba(45,155,131,0.15)",
          borderRadius: 12, padding: "18px 20px", marginTop: 8, textAlign: "center",
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
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [planStatus, setPlanStatus] = useState(lead.plan_status);
  const [pollTimeout, setPollTimeout] = useState(false);

  useEffect(() => {
    fetch(`/api/snapshots?leadId=${lead.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.snapshots) setSnapshots(data.snapshots); })
      .catch(() => {});
  }, [lead.id]);

  // Poll plan_status when generating
  useEffect(() => {
    if (planStatus === "ready") return;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/diagnose?leadId=${lead.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.plan_status === "ready" || data.planReady) {
            setPlanStatus("ready");
            clearInterval(poll);
            window.location.reload();
          }
        }
      } catch { /* ignore */ }
      if (attempts >= 18) { // 3 minutes (18 x 10s)
        setPollTimeout(true);
        clearInterval(poll);
      }
    }, 10_000);
    return () => clearInterval(poll);
  }, [lead.id, planStatus]);

  const planReady = planStatus === "ready";

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <NelsonLogo size={48} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: V.night, margin: 0 }}>
            {lead.name || lead.product} · {formatLocationDisplay(lead.region)}
          </h1>
        </div>

        {/* Banner: generating */}
        {tier !== "free" && !planReady && (
          <div style={{
            background: pollTimeout ? "rgba(217,83,79,0.08)" : "rgba(207,133,35,0.08)",
            border: `1px solid ${pollTimeout ? "rgba(217,83,79,0.2)" : "rgba(207,133,35,0.2)"}`,
            borderRadius: 12, padding: "14px 18px", marginBottom: 16,
            fontSize: 13, color: pollTimeout ? V.coral : V.amber, fontWeight: 500, lineHeight: 1.5,
          }}>
            {pollTimeout
              ? "Está demorando mais que o esperado. Tente recarregar a página ou volte em alguns minutos."
              : "✓ Recebi. Estou montando seu plano agora. O básico bem feito, relatório do seu mercado e posts prontos em até 15 minutos."}
          </div>
        )}

        {/* Tabs (sticky) */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, position: "sticky", top: 0, zIndex: 10, background: V.cloud, padding: "12px 0", marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t.key ? V.night : V.white,
              color: tab === t.key ? V.white : V.zinc,
              fontSize: 12, fontWeight: 500, transition: "all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ TAB: DIAGNÓSTICO ═══ */}
        {tab === "diagnostico" && (
          <div>
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

            <Section title="Diagnóstico completo" defaultOpen={tier !== "free" && !planReady}>
              {tier === "free" ? (
                <LockedTab lockLevel={1} ctaLabel="Desbloquear por R$497" ctaUrl="#" leadId={lead.id} />
              ) : !planReady ? (
                <Spinner text="Analisando seus dados..." />
              ) : (
                <div>
                  <MacroContextBlock macroContext={diagnosis?.macro_context} />
                  <PilaresScoreCard
                    breakdown={lead.diagnosis_display?.influenceBreakdown4D || lead.diagnosis_display?.influenceBreakdown}
                    levers={lead.diagnosis_display?.influenceBreakdown?.levers || lead.diagnosis_display?.influenceBreakdown4D?.levers || []}
                    clientType={lead.client_type}
                  />
                  <InfluenceChart
                    snapshots={snapshots}
                    currentScore={lead.diagnosis_display?.influencePercent || 0}
                    product={lead.product}
                  />
                  <ProjecaoCard projecao={lead.diagnosis_display?.projecaoFinanceira} />
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ═══ TAB: ITENS ESTRUTURANTES ═══ */}
        {tab === "estruturantes" && (
          <div>
            {tier === "free" ? (
              <LockedTab lockLevel={1} ctaLabel="Desbloquear por R$497" ctaUrl="#" leadId={lead.id} />
            ) : (
              <ItensEstruturantesTab
                leadId={lead.id}
                planReady={planReady}
                plan={plan}
              />
            )}
          </div>
        )}

        {/* ═══ TAB: ESTA SEMANA ═══ */}
        {tab === "semana" && (
          <div>
            {tier === "free" ? (
              <LockedTab lockLevel={1} ctaLabel="Desbloquear por R$497" ctaUrl="#" leadId={lead.id} />
            ) : !planReady ? (
              <Spinner text="Buscando o que mudou no seu mercado esta semana..." />
            ) : (
              <div>
                <RelatorioSetorialBlock relatorio={plan?.content?.relatorioSetorial} />
                <Section title="Posts desta semana" defaultOpen={true}>
                  <ContentsSection leadId={lead.id} tier={tier} />
                </Section>
                <div style={{ background: V.white, borderRadius: 12,
                  padding: "16px 18px", marginTop: 16,
                  border: `1px solid ${V.fog}` }}>
                  <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash,
                    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                    Próximas semanas
                  </div>
                  <p style={{ fontSize: 13, color: V.night, margin: "0 0 12px",
                    lineHeight: 1.6 }}>
                    Toda sexta-feira: novo contexto de mercado, posts atualizados e briefings conectados ao que está acontecendo no seu setor esta semana.
                  </p>
                  <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px" }}>
                    R$ 99/mês · cancele quando quiser
                  </p>
                  <button onClick={async () => {
                    try {
                      const res = await fetch("/api/checkout/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id }) });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch { /* ignore */ }
                  }} style={{ display: "block", width: "100%", background: V.amber, color: V.white,
                    textAlign: "center", padding: "12px", borderRadius: 8, border: "none",
                    fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Assinar atualização semanal
                  </button>
                </div>
                {tier === "subscriber" && (
                  <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: V.ash }}>
                    Assinatura mensal · R$99/mês · cancele quando quiser ·{' '}
                    <a href="https://wa.me/5511999999999?text=Quero gerenciar minha assinatura Virô"
                      target="_blank" style={{ color: V.amber, textDecoration: "underline" }}>
                      Gerenciar assinatura →
                    </a>
                  </div>
                )}
              </div>
            )}
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
