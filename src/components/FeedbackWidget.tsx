// ============================================================================
// Virô — Feedback Component
// Lightweight inline feedback collector for trigger points in the journey.
// Usage: <FeedbackWidget leadId="..." triggerPoint="post_instant_value" />
// ============================================================================

"use client";

import { useState, useCallback } from "react";

// ─── DESIGN TOKENS (matching Virô brand) ─────────────────────────────
const C = {
  night: "#161618",
  amber: "#CF8523",
  amberWash: "rgba(207,133,35,0.08)",
  amberWash2: "rgba(207,133,35,0.15)",
  teal: "#2D9B83",
  tealWash: "rgba(45,155,131,0.08)",
  slate: "#3A3A40",
  zinc: "#6E6E78",
  ash: "#9E9EA8",
  fog: "#EAEAEE",
  cloud: "#F4F4F7",
  white: "#FEFEFF",
};

const font = {
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

// ─── TRIGGER POINT CONFIGS ───────────────────────────────────────────
type TriggerPoint =
  | "post_instant_value"
  | "post_diagnosis"
  | "week_2"
  | "week_4"
  | "week_6"
  | "week_10"
  | "week_12";

interface TriggerConfig {
  question: string;
  ratingType: "stars" | "nps" | "boolean";
  commentPrompt: string;
  showComment: boolean;
}

const TRIGGER_CONFIGS: Record<TriggerPoint, TriggerConfig> = {
  post_instant_value: {
    question: "Esses números fazem sentido pra você?",
    ratingType: "stars",
    commentPrompt: "Algo que chamou atenção? (opcional)",
    showComment: true,
  },
  post_diagnosis: {
    question: "O diagnóstico revelou algo que você não sabia?",
    ratingType: "stars",
    commentPrompt: "O que mais te surpreendeu? (opcional)",
    showComment: true,
  },
  week_2: {
    question: "Você já executou alguma ação do plano?",
    ratingType: "boolean",
    commentPrompt: "Qual ação? (opcional)",
    showComment: true,
  },
  week_4: {
    question: "O que está sendo mais útil até agora?",
    ratingType: "stars",
    commentPrompt: "Conta pra gente",
    showComment: true,
  },
  week_6: {
    question: "De 1 a 5, quanto a Virô mudou sua visão do mercado?",
    ratingType: "stars",
    commentPrompt: "Quer elaborar? (opcional)",
    showComment: true,
  },
  week_10: {
    question: "Você recomendaria a Virô pra outro dono de negócio?",
    ratingType: "nps",
    commentPrompt: "O que faria você dar nota 10? (opcional)",
    showComment: true,
  },
  week_12: {
    question: "Última semana. O que faltou? O que sobrou?",
    ratingType: "nps",
    commentPrompt: "Seu feedback final",
    showComment: true,
  },
};

// ─── COMPONENT ───────────────────────────────────────────────────────

interface FeedbackWidgetProps {
  leadId: string;
  triggerPoint: TriggerPoint;
  locale?: "pt" | "en" | "es";
  onSubmitted?: (rating: number) => void;
}

export default function FeedbackWidget({
  leadId,
  triggerPoint,
  locale = "pt",
  onSubmitted,
}: FeedbackWidgetProps) {
  const config = TRIGGER_CONFIGS[triggerPoint];
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "dismissed">("idle");

  const submit = useCallback(async () => {
    if (rating === null) return;
    setState("submitting");

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          triggerPoint,
          rating,
          ratingType: config.ratingType,
          comment,
        }),
      });
      setState("done");
      onSubmitted?.(rating);
    } catch {
      // Silently fail — feedback is non-critical
      setState("done");
    }
  }, [leadId, triggerPoint, rating, comment, config.ratingType, onSubmitted]);

  if (state === "done") {
    return (
      <div style={{
        padding: "16px 20px",
        borderRadius: 12,
        background: C.tealWash,
        border: `1px solid rgba(45,155,131,0.15)`,
        textAlign: "center",
      }}>
        <span style={{ fontFamily: font.body, fontSize: 14, color: C.teal, fontWeight: 500 }}>
          Obrigado pelo feedback ✓
        </span>
      </div>
    );
  }

  if (state === "dismissed") return null;

  return (
    <div style={{
      padding: "20px 24px",
      borderRadius: 14,
      background: C.white,
      border: `1px solid ${C.fog}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
      }}>
        <span style={{
          fontFamily: font.mono,
          fontSize: 10,
          fontWeight: 500,
          color: C.amber,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          feedback
        </span>
        <button
          onClick={() => setState("dismissed")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: font.body,
            fontSize: 18,
            color: C.ash,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Question */}
      <div style={{
        fontFamily: font.display,
        fontSize: 16,
        fontWeight: 600,
        color: C.night,
        marginBottom: 16,
        lineHeight: 1.4,
      }}>
        {config.question}
      </div>

      {/* Rating */}
      {config.ratingType === "stars" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: `1px solid ${
                  (hoverRating || rating || 0) >= star ? C.amber : C.fog
                }`,
                background:
                  (hoverRating || rating || 0) >= star ? C.amberWash2 : C.cloud,
                cursor: "pointer",
                fontFamily: font.display,
                fontSize: 18,
                fontWeight: 600,
                color: (hoverRating || rating || 0) >= star ? C.amber : C.ash,
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {star}
            </button>
          ))}
        </div>
      )}

      {config.ratingType === "nps" && (
        <div style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          flexWrap: "wrap",
        }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
            <button
              key={score}
              onClick={() => setRating(score)}
              style={{
                width: 32,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${rating === score ? C.amber : C.fog}`,
                background: rating === score ? C.amberWash2 : C.cloud,
                cursor: "pointer",
                fontFamily: font.mono,
                fontSize: 12,
                fontWeight: 500,
                color: rating === score ? C.amber : C.zinc,
                transition: "all 0.15s",
              }}
            >
              {score}
            </button>
          ))}
          <div style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
          }}>
            <span style={{ fontFamily: font.mono, fontSize: 10, color: C.ash }}>
              Improvável
            </span>
            <span style={{ fontFamily: font.mono, fontSize: 10, color: C.ash }}>
              Com certeza
            </span>
          </div>
        </div>
      )}

      {config.ratingType === "boolean" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[
            { value: 1, label: "Sim" },
            { value: 0, label: "Ainda não" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRating(opt.value)}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 10,
                border: `1px solid ${rating === opt.value ? C.amber : C.fog}`,
                background: rating === opt.value ? C.amberWash2 : C.cloud,
                cursor: "pointer",
                fontFamily: font.body,
                fontSize: 14,
                fontWeight: 500,
                color: rating === opt.value ? C.amber : C.zinc,
                transition: "all 0.15s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Comment */}
      {config.showComment && rating !== null && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={config.commentPrompt}
          rows={2}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${C.fog}`,
            background: C.cloud,
            fontFamily: font.body,
            fontSize: 14,
            color: C.slate,
            resize: "vertical",
            outline: "none",
            marginBottom: 14,
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Submit */}
      {rating !== null && (
        <button
          onClick={submit}
          disabled={state === "submitting"}
          style={{
            width: "100%",
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: C.night,
            color: C.white,
            fontFamily: font.body,
            fontSize: 14,
            fontWeight: 600,
            cursor: state === "submitting" ? "wait" : "pointer",
            opacity: state === "submitting" ? 0.7 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {state === "submitting" ? "Enviando..." : "Enviar feedback"}
        </button>
      )}
    </div>
  );
}
