"use client";

import { useState } from "react";

const V = {
  night: "#161618", zinc: "#6E6E78", ash: "#9E9EA8", fog: "#EAEAEE",
  cloud: "#F4F4F7", white: "#FEFEFF", amber: "#CF8523",
  teal: "#2D9B83", coral: "#D9534F",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

const PRIORITY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  alta: { color: V.coral, bg: "rgba(217,83,79,0.08)", label: "Alta" },
  "média": { color: V.amber, bg: "rgba(207,133,35,0.08)", label: "Média" },
  baixa: { color: V.ash, bg: "rgba(158,158,168,0.08)", label: "Baixa" },
};

const PRIORITY_ORDER: Record<string, number> = { alta: 0, "média": 1, baixa: 2 };

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: "alta" | "média" | "baixa";
  status: "pending" | "done";
}

interface Props {
  leadId: string;
  checklist: { items: ChecklistItem[] } | null;
}

export function ChecklistTab({ leadId, checklist }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(checklist?.items || []);

  if (!checklist || items.length === 0) {
    return (
      <div style={{
        background: V.white, borderRadius: 14, padding: "40px 24px",
        textAlign: "center", border: `1px solid ${V.fog}`,
      }}>
        <p style={{ fontSize: 15, color: V.zinc, marginBottom: 8 }}>
          Checklist sendo gerado...
        </p>
        <p style={{ fontSize: 13, color: V.ash }}>
          Seu checklist de melhorias estará disponível em instantes.
        </p>
      </div>
    );
  }

  // Group by category
  const grouped = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category)!.push(item);
  }
  // Sort items within each category by priority
  for (const [, catItems] of grouped) {
    catItems.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
  }

  const doneCount = items.filter(i => i.status === "done").length;

  async function toggleItem(itemId: string) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newStatus = item.status === "done" ? "pending" : "done";

    // Optimistic update
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));

    try {
      await fetch(`/api/checklist/${leadId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: item.status } : i));
      console.error("Erro ao atualizar item:", err);
    }
  }

  return (
    <div>
      {/* Progress bar */}
      <div style={{
        background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
        padding: "16px 24px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: V.zinc, fontWeight: 500 }}>Progresso</span>
          <span style={{ fontSize: 13, color: V.teal, fontWeight: 600 }}>
            {doneCount}/{items.length}
          </span>
        </div>
        <div style={{
          height: 6, borderRadius: 3, background: V.fog, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 3, background: V.teal,
            width: `${items.length > 0 ? (doneCount / items.length) * 100 : 0}%`,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>

      {/* Categories */}
      {[...grouped.entries()].map(([category, catItems]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: V.amber,
            fontFamily: V.mono, letterSpacing: "0.05em",
            textTransform: "uppercase", marginBottom: 8, padding: "0 4px",
          }}>
            {category}
          </div>

          {catItems.map((item) => {
            const pStyle = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.baixa;
            const isDone = item.status === "done";

            return (
              <div key={item.id} style={{
                background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
                padding: "16px 20px", marginBottom: 8,
                opacity: isDone ? 0.6 : 1, transition: "opacity 0.2s",
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItem(item.id)}
                    style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: isDone ? "none" : `2px solid ${V.fog}`,
                      background: isDone ? V.teal : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", marginTop: 1,
                    }}
                  >
                    {isDone && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600, color: V.night,
                        textDecoration: isDone ? "line-through" : "none",
                      }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px",
                        borderRadius: 100, color: pStyle.color, background: pStyle.bg,
                        fontFamily: V.mono, letterSpacing: "0.03em",
                        textTransform: "uppercase",
                      }}>
                        {pStyle.label}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 13, color: V.ash, margin: 0, lineHeight: 1.5,
                    }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
