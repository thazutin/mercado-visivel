"use client";

import { useState } from "react";

const V = {
  night: "#161618", graphite: "#232326", slate: "#3A3A40",
  zinc: "#6E6E78", ash: "#9E9EA8", fog: "#EAEAEE",
  cloud: "#F4F4F7", white: "#FEFEFF", amber: "#CF8523",
  teal: "#2D9B83",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

interface Props {
  leadId: string;
  product: string;
  alreadySubmitted: boolean;
}

export default function FeedbackClient({ leadId, product, alreadySubmitted }: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [bestPart, setBestPart] = useState("");
  const [improvement, setImprovement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(alreadySubmitted);

  async function handleSubmit() {
    if (score === null) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, score, bestPart, improvement }),
      });
      setDone(true);
    } catch {
      alert("Erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: V.night, display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}>
            <span style={{ fontFamily: V.display, fontWeight: 700, fontSize: 20, color: V.white }}>V</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: V.night, margin: "0 0 12px" }}>
            Obrigado pelo feedback!
          </h1>
          <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7 }}>
            Sua opinião nos ajuda a melhorar o Virô para todos os negócios locais.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "40px 24px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: V.night, display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <span style={{ fontFamily: V.display, fontWeight: 700, fontSize: 20, color: V.white }}>V</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: V.night, margin: "0 0 8px" }}>
            Como foi sua experiência?
          </h1>
          <p style={{ fontSize: 14, color: V.zinc }}>
            Feedback sobre o acompanhamento de <strong>{product}</strong>
          </p>
        </div>

        {/* NPS */}
        <div style={{
          background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
          padding: "24px", marginBottom: 16,
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: V.night, margin: "0 0 16px" }}>
            De 0 a 10, qual a chance de recomendar o Virô?
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setScore(i)}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: "none", cursor: "pointer",
                  background: score === i ? V.night : V.cloud,
                  color: score === i ? V.white : V.zinc,
                  fontSize: 14, fontWeight: 600, transition: "all 0.15s",
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: V.ash }}>Nada provável</span>
            <span style={{ fontSize: 11, color: V.ash }}>Muito provável</span>
          </div>
        </div>

        {/* Best part */}
        <div style={{
          background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
          padding: "24px", marginBottom: 16,
        }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: V.night, display: "block", marginBottom: 8 }}>
            O que mais gostou? <span style={{ fontWeight: 400, color: V.ash }}>(opcional)</span>
          </label>
          <textarea
            value={bestPart}
            onChange={e => setBestPart(e.target.value)}
            placeholder="Ex: os briefings semanais, os dados do mercado..."
            rows={3}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${V.fog}`,
              fontSize: 14, color: V.night, resize: "vertical", fontFamily: "inherit",
              background: V.cloud,
            }}
          />
        </div>

        {/* Improvement */}
        <div style={{
          background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
          padding: "24px", marginBottom: 24,
        }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: V.night, display: "block", marginBottom: 8 }}>
            O que poderia melhorar? <span style={{ fontWeight: 400, color: V.ash }}>(opcional)</span>
          </label>
          <textarea
            value={improvement}
            onChange={e => setImprovement(e.target.value)}
            placeholder="Ex: gostaria de mais detalhes sobre concorrentes..."
            rows={3}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${V.fog}`,
              fontSize: 14, color: V.night, resize: "vertical", fontFamily: "inherit",
              background: V.cloud,
            }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={score === null || submitting}
          style={{
            width: "100%", padding: "14px", borderRadius: 10, border: "none",
            background: score !== null ? V.night : V.fog,
            color: score !== null ? V.white : V.ash,
            fontSize: 15, fontWeight: 600, cursor: score !== null ? "pointer" : "default",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Enviando..." : "Enviar feedback"}
        </button>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 32, marginTop: 24 }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.night }}>Virô</span>
          <p style={{ fontSize: 11, color: V.ash, fontFamily: V.mono, marginTop: 4 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
