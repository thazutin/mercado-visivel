"use client";

// ============================================================================
// Viro — Task Content Button
// Generates channel-specific content for a plan task via Claude.
// Can be imported into PlanTasks or any weekly plan component.
// File: src/components/TaskContentButton.tsx
// ============================================================================

import { useState } from "react";

import { V } from "@/lib/design-tokens";

interface TaskContentButtonProps {
  /** Task ID — either UUID (from plan_tasks) or "leadId:weekIndex" for weeklyPlan tasks */
  taskId: string;
  /** Task title (for display) */
  taskTitle: string;
  /** Whether the task is completed */
  completed?: boolean;
}

export default function TaskContentButton({ taskId, taskTitle, completed }: TaskContentButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    setContent(null);

    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      setContent(data.content);
    } catch (err) {
      setError((err as Error).message || "Erro ao gerar conteúdo");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Don't show for completed tasks
  if (completed) return null;

  return (
    <div style={{ marginTop: 12 }}>
      {/* Generate button */}
      {!content && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${V.fog}`,
            background: generating ? V.cloud : V.white,
            color: generating ? V.ash : V.teal,
            fontSize: 13,
            fontWeight: 500,
            cursor: generating ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            fontFamily: V.display,
          }}
        >
          {generating ? (
            <>
              <span style={{
                display: "inline-block",
                width: 14,
                height: 14,
                border: `2px solid ${V.fog}`,
                borderTopColor: V.teal,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              Gerando conteudo...
            </>
          ) : (
            <>
              <span style={{ fontSize: 15 }}>&#9998;</span>
              Gerar conteudo
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 8,
          padding: "10px 14px",
          borderRadius: 8,
          background: "rgba(217,83,79,0.08)",
          fontSize: 13,
          color: V.coral,
        }}>
          {error}
        </div>
      )}

      {/* Generated content */}
      {content && (
        <div style={{
          marginTop: 8,
          background: V.cloud,
          borderRadius: 10,
          border: `1px solid ${V.fog}`,
          overflow: "hidden",
        }}>
          {/* Content header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            borderBottom: `1px solid ${V.fog}`,
          }}>
            <span style={{
              fontFamily: V.mono,
              fontSize: 10,
              color: V.teal,
              letterSpacing: "0.05em",
              textTransform: "uppercase" as const,
              fontWeight: 600,
            }}>
              Conteudo gerado
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleCopy}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${V.fog}`,
                  background: copied ? V.teal : V.white,
                  color: copied ? V.white : V.zinc,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {copied ? "Copiado!" : "Copiar texto"}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${V.fog}`,
                  background: V.white,
                  color: V.zinc,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Regerar
              </button>
            </div>
          </div>

          {/* Content body */}
          <div
            style={{
              padding: "16px",
              fontSize: 14,
              color: V.slate,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap" as const,
              maxHeight: 400,
              overflowY: "auto" as const,
            }}
            dangerouslySetInnerHTML={{
              __html: formatMarkdown(content),
            }}
          />
        </div>
      )}

      {/* Inline keyframes for spinner */}
      {generating && (
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </div>
  );
}

// ─── Simple markdown formatter ──────────────────────────────────────

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, '<div style="font-size:15px;font-weight:600;color:#161618;margin:14px 0 6px">$1</div>')
    .replace(/^## (.*$)/gm, '<div style="font-size:16px;font-weight:600;color:#161618;margin:16px 0 8px">$1</div>')
    .replace(/^# (.*$)/gm, '<div style="font-size:17px;font-weight:700;color:#161618;margin:18px 0 8px">$1</div>')
    .replace(/^- (.*$)/gm, '<div style="padding-left:16px;margin:2px 0">&bull; $1</div>')
    .replace(/^(\d+)\. (.*$)/gm, '<div style="padding-left:16px;margin:2px 0">$1. $2</div>')
    .replace(/\n/g, "<br/>");
}
