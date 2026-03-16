"use client";

import { useState, useCallback } from "react";
import TaskContentButton from "@/components/TaskContentButton";

// ─── Design tokens (mesmo padrão do DashboardClient) ──────────────
const V = {
  night: "#161618", graphite: "#232326", slate: "#3A3A40",
  zinc: "#6E6E78", ash: "#9E9EA8", fog: "#EAEAEE",
  cloud: "#F4F4F7", white: "#FEFEFF", amber: "#CF8523",
  teal: "#2D9B83", coral: "#D9534F",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
  google_maps: { label: "Google Maps", color: V.teal },
  instagram: { label: "Instagram", color: "#E1306C" },
  geral: { label: "Geral", color: "#8B5CF6" },
};

export interface PlanTask {
  id: number;
  lead_id: string;
  week: number;
  channel: string;
  title: string;
  description: string;
  completed: boolean;
  completed_at: string | null;
}

interface Props {
  tasks: PlanTask[];
}

export default function PlanTasks({ tasks: initialTasks }: Props) {
  const [tasks, setTasks] = useState<PlanTask[]>(initialTasks);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // Agrupar por semana
  const weeks = Array.from(new Set(tasks.map(t => t.week))).sort((a, b) => a - b);

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const toggleTask = useCallback(async (taskId: number) => {
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null }
        : t
    ));
    setTogglingIds(prev => new Set(prev).add(taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: "PATCH" });
      if (!res.ok) {
        // Reverter se falhou
        setTasks(prev => prev.map(t =>
          t.id === taskId
            ? { ...t, completed: !t.completed, completed_at: t.completed ? null : t.completed_at }
            : t
        ));
      }
    } catch {
      // Reverter em caso de erro de rede
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, completed: !t.completed, completed_at: t.completed ? null : t.completed_at }
          : t
      ));
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, []);

  if (tasks.length === 0) {
    return (
      <div style={{
        background: V.white, borderRadius: 14, padding: "40px 24px",
        textAlign: "center", border: `1px solid ${V.fog}`,
      }}>
        <p style={{ fontSize: 15, color: V.zinc, margin: 0 }}>
          Nenhuma tarefa disponivel ainda.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Barra de progresso geral */}
      <div style={{
        background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
        padding: "20px 24px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: V.night }}>
            Progresso do Plano
          </span>
          <span style={{ fontFamily: V.mono, fontSize: 13, color: V.teal, fontWeight: 600 }}>
            {completedCount}/{totalCount} ({progressPct}%)
          </span>
        </div>
        <div style={{
          width: "100%", height: 8, background: V.fog, borderRadius: 100,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${progressPct}%`, height: "100%",
            background: `linear-gradient(90deg, ${V.teal}, ${V.amber})`,
            borderRadius: 100, transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Semanas com tarefas */}
      {weeks.map(weekNum => {
        const weekTasks = tasks.filter(t => t.week === weekNum);
        const weekCompleted = weekTasks.filter(t => t.completed).length;
        const weekTotal = weekTasks.length;
        const allDone = weekCompleted === weekTotal;

        return (
          <div key={weekNum} style={{
            background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
            padding: "20px 24px", marginBottom: 12,
          }}>
            {/* Header da semana */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  fontFamily: V.mono, fontSize: 11, fontWeight: 600,
                  color: allDone ? V.white : V.teal,
                  background: allDone ? V.teal : "rgba(45,155,131,0.1)",
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s ease",
                }}>
                  {allDone ? "\u2713" : weekNum}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: V.night }}>
                  Semana {weekNum}
                </span>
              </div>
              <span style={{
                fontFamily: V.mono, fontSize: 11, color: allDone ? V.teal : V.ash,
              }}>
                {weekCompleted}/{weekTotal}
              </span>
            </div>

            {/* Tarefas */}
            {weekTasks.map(task => {
              const ch = CHANNEL_CONFIG[task.channel] || CHANNEL_CONFIG.geral;
              const isToggling = togglingIds.has(task.id);

              return (
                <div
                  key={task.id}
                  style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "10px 0",
                    borderTop: `1px solid ${V.fog}`,
                    opacity: isToggling ? 0.6 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task.id)}
                    disabled={isToggling}
                    style={{
                      width: 22, height: 22, minWidth: 22,
                      borderRadius: 6,
                      border: `2px solid ${task.completed ? V.teal : V.ash}`,
                      background: task.completed ? V.teal : "transparent",
                      cursor: isToggling ? "wait" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginTop: 2, padding: 0,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {task.completed && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke={V.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  {/* Conteudo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 500,
                        color: task.completed ? V.ash : V.night,
                        textDecoration: task.completed ? "line-through" : "none",
                        transition: "all 0.2s",
                      }}>
                        {task.title}
                      </span>
                      <span style={{
                        fontFamily: V.mono, fontSize: 9, letterSpacing: "0.05em",
                        textTransform: "uppercase" as const, padding: "2px 8px", borderRadius: 100,
                        color: ch.color, background: `${ch.color}15`,
                        whiteSpace: "nowrap" as const,
                      }}>
                        {ch.label}
                      </span>
                    </div>
                    {task.description && (
                      <p style={{
                        fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0,
                        textDecoration: task.completed ? "line-through" : "none",
                        opacity: task.completed ? 0.6 : 1,
                      }}>
                        {task.description}
                      </p>
                    )}
                    {/* Botão de geração de conteúdo (Feature 3) */}
                    <TaskContentButton
                      taskId={String(task.id)}
                      taskTitle={task.title}
                      completed={task.completed}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
